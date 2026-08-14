// Server-only invoicing + Stripe payment helpers.
import { adminDb, writeAudit } from "@/lib/blex.server";
import { computeInvoicePlan } from "@/lib/documents/compose";
import { emailInvoice, emailReceipt, notifyTeam, siteUrl } from "@/lib/engagement.server";

const STRIPE_API = "https://api.stripe.com/v1";

function stripeKey(): string {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) throw new Error("Online payments are not configured yet.");
  return key;
}

function formEncode(payload: Record<string, string>): string {
  return new URLSearchParams(payload).toString();
}

/** Builds the $600 installment schedule for a signed agreement. */
export async function createInvoiceSchedule(agreementId: string) {
  const db = adminDb();
  const { data: agreement } = await db
    .from("agreements")
    .select("id, quote_id, total_cents")
    .eq("id", agreementId)
    .maybeSingle();
  if (!agreement) throw new Error("Agreement not found");

  const { data: existing } = await db.from("invoices").select("id").eq("agreement_id", agreementId).limit(1);
  if (existing?.length) return { created: 0 };

  const plan = computeInvoicePlan(Number(agreement.total_cents));
  const rows = plan.map((entry) => ({
    quote_id: agreement.quote_id,
    agreement_id: agreement.id,
    sequence: entry.sequence,
    amount_cents: entry.amountCents,
    due_date: entry.dueDate,
    scheduled_send_at: entry.scheduledSendAt,
    status: "scheduled",
  }));
  const { data: inserted, error } = await db.from("invoices").insert(rows).select("id, sequence");
  if (error) throw new Error(error.message);

  await db.from("quotes").update({ status: "invoicing" }).eq("id", agreement.quote_id);

  const first = (inserted ?? []).find((row) => row.sequence === 1);
  if (first) await dispatchInvoice(first.id as string);

  return { created: rows.length };
}

/** Marks an invoice as sent and emails the client a pay link. */
export async function dispatchInvoice(invoiceId: string) {
  const db = adminDb();
  const { data: invoice } = await db
    .from("invoices")
    .select("id, quote_id, invoice_number, sequence, amount_cents, due_date, pay_token, status")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!invoice) throw new Error("Invoice not found");
  if (invoice.status === "paid" || invoice.status === "void") return { emailed: false };

  const { data: quote } = await db
    .from("quotes")
    .select("contact_name, contact_email")
    .eq("id", invoice.quote_id)
    .maybeSingle();
  if (!quote) throw new Error("Quote not found");

  await db
    .from("invoices")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", invoice.id);

  const result = await emailInvoice({
    to: quote.contact_email as string,
    name: quote.contact_name as string,
    invoiceNumber: invoice.invoice_number as string,
    amountCents: Number(invoice.amount_cents),
    dueDate: (invoice.due_date as string | null) ?? null,
    url: `${siteUrl()}/invoice/${invoice.pay_token as string}`,
    first: Number(invoice.sequence) === 1,
  });

  await writeAudit({
    actorLabel: "system",
    action: "invoice.sent",
    entity: "quote",
    entityId: invoice.quote_id as string,
    metadata: { invoice: invoice.invoice_number, emailed: result.sent },
  });

  return { emailed: result.sent };
}

/** Creates a Stripe Checkout session for a single invoice. */
export async function createCheckoutSession(payToken: string): Promise<string> {
  const db = adminDb();
  const { data: invoice } = await db
    .from("invoices")
    .select("id, invoice_number, amount_cents, status, quote_id")
    .eq("pay_token", payToken)
    .maybeSingle();
  if (!invoice) throw new Error("Invoice not found");
  if (invoice.status === "paid") throw new Error("This invoice is already paid.");

  const { data: quote } = await db
    .from("quotes")
    .select("contact_email")
    .eq("id", invoice.quote_id)
    .maybeSingle();

  const response = await fetch(`${STRIPE_API}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formEncode({
      mode: "payment",
      success_url: `${siteUrl()}/invoice/${payToken}?paid=1`,
      cancel_url: `${siteUrl()}/invoice/${payToken}`,
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": String(invoice.amount_cents),
      "line_items[0][price_data][product_data][name]": `BLEXware ${invoice.invoice_number as string}`,
      "metadata[invoice_id]": invoice.id as string,
      ...(quote?.contact_email ? { customer_email: String(quote.contact_email) } : {}),
    }),
  });

  if (!response.ok) {
    console.error("[stripe:checkout]", response.status, await response.text());
    throw new Error("Could not start the payment. Please try again.");
  }
  const session = (await response.json()) as { id: string; url: string };

  await db.from("invoices").update({ stripe_session_id: session.id }).eq("id", invoice.id);
  return session.url;
}

/** Idempotently records a payment and schedules follow-up work. */
export async function markInvoicePaid(input: {
  invoiceId: string;
  amountCents: number;
  providerRef: string;
}) {
  const db = adminDb();
  const { data: invoice } = await db
    .from("invoices")
    .select("id, quote_id, invoice_number, status, sequence")
    .eq("id", input.invoiceId)
    .maybeSingle();
  if (!invoice) return;

  const { error: paymentError } = await db.from("payments").insert({
    invoice_id: invoice.id,
    amount_cents: input.amountCents,
    provider: "stripe",
    provider_ref: input.providerRef,
    status: "succeeded",
  });
  if (paymentError && !paymentError.message.includes("duplicate")) {
    console.error("[stripe:payment]", paymentError.message);
  }
  if (invoice.status === "paid") return;

  await db
    .from("invoices")
    .update({ status: "paid", paid_at: new Date().toISOString(), stripe_payment_intent: input.providerRef })
    .eq("id", invoice.id);

  const { data: quote } = await db
    .from("quotes")
    .select("quote_number, contact_name, contact_email")
    .eq("id", invoice.quote_id)
    .maybeSingle();

  if (quote) {
    await emailReceipt({
      to: quote.contact_email as string,
      name: quote.contact_name as string,
      invoiceNumber: invoice.invoice_number as string,
      amountCents: input.amountCents,
    });
    await notifyTeam(`Payment received — ${invoice.invoice_number as string}`, [
      `${quote.contact_name as string} (${quote.contact_email as string}) paid ${invoice.invoice_number as string}.`,
      Number(invoice.sequence) === 1 ? "This was the first invoice — work can begin." : "",
    ].filter(Boolean));
  }

  const { data: outstanding } = await db
    .from("invoices")
    .select("id")
    .eq("quote_id", invoice.quote_id)
    .neq("status", "paid")
    .neq("status", "void");
  if (!outstanding?.length) {
    await db.from("quotes").update({ status: "completed" }).eq("id", invoice.quote_id);
  }

  await writeAudit({
    actorLabel: "stripe",
    action: "invoice.paid",
    entity: "quote",
    entityId: invoice.quote_id as string,
    metadata: { invoice: invoice.invoice_number, amount_cents: input.amountCents },
  });
}

/** Cron worker: send due invoices and close expired proposals/estimates. */
export async function runScheduledWork() {
  const db = adminDb();
  const now = new Date().toISOString();

  const { data: due } = await db
    .from("invoices")
    .select("id")
    .eq("status", "scheduled")
    .eq("paused", false)
    .lte("scheduled_send_at", now);
  for (const invoice of due ?? []) {
    try {
      await dispatchInvoice(invoice.id as string);
    } catch (error) {
      console.error("[cron:invoice]", error);
    }
  }

  const { data: staleProposals } = await db
    .from("proposals")
    .select("id, quote_id")
    .eq("status", "sent")
    .lt("expires_at", now);
  for (const proposal of staleProposals ?? []) {
    await db
      .from("proposals")
      .update({ status: "declined", responded_at: now, client_response_note: "Automatically closed after 5 days." })
      .eq("id", proposal.id);
    await db.from("quotes").update({ status: "declined" }).eq("id", proposal.quote_id);
    await writeAudit({
      actorLabel: "system",
      action: "proposal.auto_declined",
      entity: "quote",
      entityId: proposal.quote_id as string,
    });
  }

  const { data: staleEstimates } = await db
    .from("estimates")
    .select("id, quote_id")
    .eq("status", "sent")
    .lt("expires_at", now);
  for (const estimate of staleEstimates ?? []) {
    await db.from("estimates").update({ status: "expired", responded_at: now }).eq("id", estimate.id);
    await writeAudit({
      actorLabel: "system",
      action: "estimate.expired",
      entity: "quote",
      entityId: estimate.quote_id as string,
    });
  }

  return {
    invoicesSent: due?.length ?? 0,
    proposalsClosed: staleProposals?.length ?? 0,
    estimatesExpired: staleEstimates?.length ?? 0,
  };
}
