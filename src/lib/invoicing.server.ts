// Server-only invoicing helpers. Payments are processor-agnostic: everything
// goes through PaymentService (Hyperswitch), never a processor SDK.
import { adminDb, writeAudit } from "@/lib/blex.server";
import { paymentPlanToInvoiceEntries, buildPaymentPlan } from "@/lib/documents/compose";
import type { PaymentPlan, ProjectDocument } from "@/lib/documents/types";
import { emailInvoice, siteUrl } from "@/lib/engagement-email.server";

/** Builds the invoice schedule from the agreement's payment plan. */
export async function createInvoiceSchedule(
  agreementId: string,
  options: { firstDueDate?: string | null } = {},
) {
  const db = adminDb();
  const { data: agreement } = await db
    .from("agreements")
    .select("id, quote_id, total_cents, doc, created_at")
    .eq("id", agreementId)
    .maybeSingle();
  if (!agreement) throw new Error("Agreement not found");

  const totalCents = Number(agreement.total_cents);
  const stored = (agreement.doc as ProjectDocument | null)?.paymentPlan;
  const paymentPlan: PaymentPlan = stored?.rows?.length ? stored : buildPaymentPlan("installments", totalCents);
  const { data: existing } = await db
    .from("invoices")
    .select("id, sequence, scheduled_send_at")
    .eq("agreement_id", agreementId)
    .order("sequence");
  const firstScheduled = existing?.find((row) => Number(row.sequence) === 1)?.scheduled_send_at;
  const anchor = firstScheduled
    ? new Date(firstScheduled as string)
    : new Date(agreement.created_at as string);
  const plan = paymentPlanToInvoiceEntries(paymentPlan, anchor);
  const existingSequences = new Set((existing ?? []).map((row) => Number(row.sequence)));
  const rows = plan.filter((entry) => !existingSequences.has(entry.sequence)).map((entry) => ({
    quote_id: agreement.quote_id,
    agreement_id: agreement.id,
    sequence: entry.sequence,
    amount_cents: entry.amountCents,
    due_date: entry.sequence === 1 && options.firstDueDate ? options.firstDueDate : entry.dueDate,
    scheduled_send_at: entry.scheduledSendAt,
    status: "scheduled",
  }));

  const { data: inserted, error } = rows.length
    ? await db.from("invoices").insert(rows).select("id, sequence")
    : { data: [], error: null };
  if (error) throw new Error(error.message);

  await db.from("quotes").update({ status: "invoicing" }).eq("id", agreement.quote_id);

  for (const entry of plan.filter((item) => item.send === "on_sign" && !existingSequences.has(item.sequence))) {
    const row = (inserted ?? []).find((invoice) => invoice.sequence === entry.sequence);
    if (row) await dispatchInvoice(row.id as string);
  }

  return { created: rows.length };
}

export type ProjectPaymentSummary = {
  totalCents: number;
  paidCents: number;
  balanceCents: number;
  remainingInvoices: number;
  installments: Array<{
    sequence: number;
    amountCents: number;
    paidCents: number;
    balanceCents: number;
    status: string;
    scheduledSendAt: string | null;
    dueDate: string | null;
    issued: boolean;
  }>;
};

/** Reconciles the contractual payment plan with issued and scheduled invoice rows. */
export async function getProjectPaymentSummary(quoteId: string): Promise<ProjectPaymentSummary> {
  const db = adminDb();
  const [{ data: agreement }, { data: invoiceRows }] = await Promise.all([
    db
      .from("agreements")
      .select("id, total_cents, doc, created_at")
      .eq("quote_id", quoteId)
      .neq("status", "void")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("invoices")
      .select("sequence, amount_cents, amount_paid_cents, status, scheduled_send_at, due_date, sent_at")
      .eq("quote_id", quoteId)
      .not("status", "in", "(void,cancelled)")
      .order("sequence"),
  ]);

  const invoices = (invoiceRows ?? []) as InvoiceRow[];
  const totalCents = agreement
    ? Number(agreement.total_cents)
    : invoices.reduce((sum, row) => sum + Number(row["amount_cents"]), 0);
  const storedPlan = (agreement?.doc as ProjectDocument | null)?.paymentPlan;
  const firstScheduled = invoices.find((row) => Number(row["sequence"]) === 1)?.["scheduled_send_at"];
  const anchorValue = firstScheduled ?? agreement?.created_at ?? new Date().toISOString();
  const plan = storedPlan?.rows?.length
    ? paymentPlanToInvoiceEntries(storedPlan, new Date(String(anchorValue)))
    : invoices.map((row) => ({
        sequence: Number(row["sequence"]),
        amountCents: Number(row["amount_cents"]),
        dueDate: (row["due_date"] as string | null) ?? null,
        scheduledSendAt: (row["scheduled_send_at"] as string | null) ?? null,
        send: "manual" as const,
        label: `Invoice ${String(row["sequence"])}`,
      }));
  const bySequence = new Map(invoices.map((row) => [Number(row["sequence"]), row]));
  const installments = plan.map((entry) => {
    const row = bySequence.get(entry.sequence);
    const amountCents = row ? Number(row["amount_cents"]) : entry.amountCents;
    const paidCents = row ? Number(row["amount_paid_cents"] ?? 0) : 0;
    const status = row ? String(row["status"]) : "scheduled";
    return {
      sequence: entry.sequence,
      amountCents,
      paidCents,
      balanceCents: Math.max(0, amountCents - paidCents),
      status,
      scheduledSendAt: row
        ? ((row["scheduled_send_at"] as string | null) ?? null)
        : entry.scheduledSendAt,
      dueDate: row ? ((row["due_date"] as string | null) ?? null) : entry.dueDate,
      issued: Boolean(row && status !== "scheduled"),
    };
  });
  const paidCents = installments.reduce((sum, row) => sum + row.paidCents, 0);
  return {
    totalCents,
    paidCents,
    balanceCents: Math.max(0, totalCents - paidCents),
    remainingInvoices: installments.filter((row) => row.balanceCents > 0).length,
    installments,
  };
}

/**
 * Marks checkout attempts the client abandoned (never reached the gateway, or
 * stalled awaiting customer action) as expired so the admin ledger stays clean.
 * Money is never touched — only `created`/`action_required` rows older than 30
 * minutes are affected, so in-flight checkouts are left alone.
 */
export async function expireStaleAttempts(quoteId: string) {
  const db = adminDb();
  const { data: invoices } = await db.from("invoices").select("id").eq("quote_id", quoteId);
  const ids = (invoices ?? []).map((row) => row.id as string);
  if (!ids.length) return { expired: 0 };

  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: expired } = await db
    .from("invoice_payments")
    .update({ status: "expired" })
    .in("invoice_id", ids)
    .in("status", ["created", "action_required"])
    .lt("created_at", cutoff)
    .select("id");

  return { expired: expired?.length ?? 0 };
}

/** Repairs a partially-created schedule without changing existing invoices. */

export async function ensureInvoiceScheduleForQuote(quoteId: string) {
  const db = adminDb();
  const [{ data: agreement }, { count: existingInvoiceCount }] = await Promise.all([
    db
    .from("agreements")
    .select("id")
    .eq("quote_id", quoteId)
    .eq("status", "signed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle(),
    db.from("invoices").select("id", { count: "exact", head: true }).eq("quote_id", quoteId),
  ]);
  // Repair only projects whose invoice lifecycle has already started. Initial
  // schedule creation remains the explicit countersign action.
  return agreement && (existingInvoiceCount ?? 0) > 0
    ? createInvoiceSchedule(agreement.id as string)
    : { created: 0 };
}

/** Marks an invoice as sent and emails the client a pay link. */
export async function dispatchInvoice(invoiceId: string) {
  const db = adminDb();
  const { data: invoice } = await db
    .from("invoices")
    .select("id, quote_id, agreement_id, invoice_number, sequence, amount_cents, due_date, pay_token, status")
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
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      issue_date: new Date().toISOString().slice(0, 10),
    })
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

  await renderInvoiceDocument(invoice.id as string);

  await writeAudit({
    actorLabel: "system",
    action: "invoice.sent",
    entity: "quote",
    entityId: invoice.quote_id as string,
    metadata: { invoice: invoice.invoice_number, emailed: result.sent },
  });

  return { emailed: result.sent };
}

/**
 * Renders the formatted invoice letter (PDF + Word) into the documents bucket.
 * Called when an invoice is sent and again when a payment lands, so downloads
 * always reflect the current paid/balance state.
 */
export async function renderInvoiceDocument(invoiceId: string) {
  const db = adminDb();
  const { data: invoice } = await db.from("invoices").select("*").eq("id", invoiceId).maybeSingle();
  if (!invoice) return;

  const [{ data: quote }, agreementResult, { count }] = await Promise.all([
    db
      .from("quotes")
      .select("contact_name, contact_email, company, quote_number")
      .eq("id", invoice.quote_id as string)
      .maybeSingle(),
    invoice.agreement_id
      ? db
          .from("agreements")
          .select("agreement_number, total_cents")
          .eq("id", invoice.agreement_id as string)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    db
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("quote_id", invoice.quote_id as string)
      .not("status", "eq", "void"),
  ]);
  if (!quote) return;

  const { buildInvoiceDoc } = await import("@/lib/documents/compose");
  const { storeDocument } = await import("@/lib/document-storage.server");
  const doc = buildInvoiceDoc({
    invoice: invoice as never,
    quote: quote as never,
    agreement: (agreementResult.data ?? null) as never,
    invoiceCount: count ?? 1,
    payUrl: `${siteUrl()}/invoice/${invoice.pay_token as string}`,
  });

  try {
    await storeDocument({
      quoteId: invoice.quote_id as string,
      entity: "invoice",
      entityId: invoice.id as string,
      kind: "invoice",
      doc,
      slug: invoice.invoice_number as string,
    });
  } catch (error) {
    console.error("[invoice:render]", (error as Error).message);
  }
}

type InvoiceRow = Record<string, unknown>;

const OPEN_STATUSES = ["draft", "scheduled", "sent", "viewed", "partially_paid", "overdue"];

function balanceOf(invoice: InvoiceRow): number {
  return Math.max(0, Number(invoice["amount_cents"]) - Number(invoice["amount_paid_cents"] ?? 0));
}

/** Loads an invoice by its public pay token together with the client details. */
export async function loadInvoiceByToken(payToken: string) {
  const db = adminDb();
  const { data: invoice } = await db
    .from("invoices")
    .select(
      "id, quote_id, invoice_number, sequence, amount_cents, amount_paid_cents, currency, status, due_date, issue_date, description, sent_at, paid_at, viewed_at",
    )
    .eq("pay_token", payToken)
    .maybeSingle();
  if (!invoice) return null;

  const { data: quote } = await db
    .from("quotes")
    .select("quote_number, contact_name, contact_email, company")
    .eq("id", invoice.quote_id)
    .maybeSingle();

  const { data: agreement } = await db
    .from("agreements")
    .select("id, agreement_number, total_cents")
    .eq("quote_id", invoice.quote_id)
    .eq("status", "signed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const project = await getProjectPaymentSummary(invoice.quote_id as string);

  return {
    invoice: invoice as InvoiceRow,
    quote: (quote ?? null) as InvoiceRow | null,
    agreement: (agreement ?? null) as InvoiceRow | null,
    project,
  };
}

/** Records the first view of an invoice (audit + status transition). */
export async function markInvoiceViewed(invoiceId: string, status: string, viewedAt: unknown) {
  if (viewedAt) return;
  const db = adminDb();
  const patch: Record<string, unknown> = { viewed_at: new Date().toISOString() };
  if (status === "sent") patch["status"] = "viewed";
  await db.from("invoices").update(patch).eq("id", invoiceId);
}

/**
 * Creates a Hyperswitch payment for an invoice. The amount is always computed
 * server-side from the stored invoice; the browser cannot influence it. The
 * client only chooses the method family (bank/ACH or card).
 */
export async function startInvoicePayment(
  payToken: string,
  method: "bank" | "card" = "bank",
  scope: "invoice" | "project" = "invoice",
) {
  const { PaymentService } = await import("@/lib/payments/service.server");
  const { getPaymentMethodSettings } = await import("@/lib/settings.server");
  const enabled = await getPaymentMethodSettings();
  if (!enabled[method]) {
    throw new Error(
      method === "bank"
        ? "Bank (ACH) payments aren't available right now. Please pay by credit or debit card."
        : "Card payments aren't available right now. Please contact us to arrange payment.",
    );
  }
  const db = adminDb();
  const loaded = await loadInvoiceByToken(payToken);
  if (!loaded) throw new Error("Invoice not found");

  const { invoice, quote, project } = loaded;
  const status = String(invoice["status"]);
  if (!OPEN_STATUSES.includes(status)) {
    throw new Error("This invoice is not open for payment.");
  }
  const invoiceBalance = balanceOf(invoice);
  const amountCents = scope === "project" ? Math.max(invoiceBalance, project.balanceCents) : invoiceBalance;
  if (amountCents <= 0) throw new Error("This invoice is already paid in full.");


  const { data: attempt, error: attemptError } = await db
    .from("invoice_payments")
    .insert({
      invoice_id: invoice["id"],
      amount_cents: amountCents,
      currency: String(invoice["currency"] ?? "usd"),
      status: "created",
      metadata: { method_choice: method },
    })
    .select("id, payment_reference")
    .single();
  if (attemptError || !attempt) throw new Error("Could not start the payment. Please try again.");

  const snapshot = await PaymentService.createPayment({
    amountCents,
    currency: String(invoice["currency"] ?? "usd"),
    reference: attempt.payment_reference as string,
    description: `BLEXware ${String(invoice["invoice_number"])}`,
    customerEmail: (quote?.["contact_email"] as string | undefined) ?? null,
    customerName: (quote?.["contact_name"] as string | undefined) ?? null,
    returnUrl: `${siteUrl()}/invoice/${payToken}?ref=${attempt.payment_reference as string}`,
    methods: method,
    metadata: { invoice_payment_id: attempt.id as string, invoice_number: String(invoice["invoice_number"]) },
  });

  await db
    .from("invoice_payments")
    .update({
      hyperswitch_payment_id: snapshot.providerPaymentId,
      hyperswitch_connector: snapshot.connector,
      status: snapshot.status,
    })
    .eq("id", attempt.id);

  await writeAudit({
    actorLabel: "client",
    action: "payment.created",
    entity: "invoice",
    entityId: invoice["id"] as string,
    metadata: { amount_cents: amountCents, reference: attempt.payment_reference, method },
  });

  const config = PaymentService.publicConfig();
  return {
    clientSecret: snapshot.clientSecret,
    publishableKey: config.publishableKey,
    profileId: config.profileId,
    environment: config.environment,
    amountCents,
    method,
    reference: attempt.payment_reference as string,
  };
}


/**
 * Applies an authoritative payment status to BLEXware records. Idempotent:
 * duplicate or out-of-order deliveries never double-credit an invoice.
 */
export async function applyPaymentStatus(input: {
  providerPaymentId: string;
  status: import("@/lib/payments/service.server").PaymentStatus;
  amountCents?: number;
  paymentMethod?: string | null;
  connector?: string | null;
  processorTransactionId?: string | null;
  failureCode?: string | null;
  failureMessage?: string | null;
}) {
  const db = adminDb();
  const { data: attempt } = await db
    .from("invoice_payments")
    .select("id, invoice_id, amount_cents, status, currency")
    .eq("hyperswitch_payment_id", input.providerPaymentId)
    .maybeSingle();
  if (!attempt) return { applied: false as const };

  const previous = String(attempt.status);
  const alreadySucceeded = previous === "succeeded";

  await db
    .from("invoice_payments")
    .update({
      status: input.status,
      payment_method: input.paymentMethod ?? null,
      hyperswitch_connector: input.connector ?? null,
      processor_transaction_id: input.processorTransactionId ?? null,
      failure_code: input.failureCode ?? null,
      failure_message: input.failureMessage ?? null,
      ...(input.status === "succeeded" && !alreadySucceeded ? { paid_at: new Date().toISOString() } : {}),
    })
    .eq("id", attempt.id);

  const { data: invoice } = await db
    .from("invoices")
    .select("id, quote_id, invoice_number, amount_cents, amount_paid_cents, status, sequence, pay_token")
    .eq("id", attempt.invoice_id)
    .maybeSingle();
  if (!invoice) return { applied: false as const };

  const { data: quote } = await db
    .from("quotes")
    .select("contact_name, contact_email")
    .eq("id", invoice.quote_id)
    .maybeSingle();
  const url = `${siteUrl()}/invoice/${invoice.pay_token as string}`;
   const { emailPaymentUpdate, emailReceipt, notifyTeam } = await import("@/lib/engagement-email.server");

  if (input.status === "succeeded" && !alreadySucceeded) {
    const credited = Number(input.amountCents ?? attempt.amount_cents);
    const paid = Number(invoice.amount_paid_cents ?? 0) + credited;
    const balance = Math.max(0, Number(invoice.amount_cents) - paid);
    const nextStatus = balance === 0 ? "paid" : "partially_paid";

    await db
      .from("invoices")
      .update({
        amount_paid_cents: paid,
        status: nextStatus,
        ...(balance === 0 ? { paid_at: new Date().toISOString() } : {}),
      })
      .eq("id", invoice.id);

    // Re-render the invoice document so downloads show the new paid/balance state.
    await renderInvoiceDocument(invoice.id as string);

    const project = await getProjectPaymentSummary(invoice.quote_id as string);
    const nextInstallment = project.installments.find((row) => row.balanceCents > 0);

    if (quote) {
      await emailReceipt({
        to: quote.contact_email as string,
        name: quote.contact_name as string,
        invoiceNumber: invoice.invoice_number as string,
        amountCents: credited,
        projectBalanceCents: project.balanceCents,
        remainingInvoices: project.remainingInvoices,
        nextScheduledSendAt: nextInstallment?.scheduledSendAt ?? null,
      });
      if (project.balanceCents === 0) {
        await emailPaymentUpdate({
          to: quote.contact_email as string,
          name: quote.contact_name as string,
          invoiceNumber: invoice.invoice_number as string,
          amountCents: credited,
          kind: "paid_in_full",
        });
      }
      await notifyTeam(`Payment received — ${invoice.invoice_number as string}`, [
        `${quote.contact_name as string} (${quote.contact_email as string}) paid ${invoice.invoice_number as string}.`,
        `Project balance: ${project.balanceCents === 0 ? "paid in full" : `$${(project.balanceCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`}.`,
        Number(invoice.sequence) === 1 && balance === 0 ? "This was the first invoice — work can begin." : "",
      ].filter(Boolean));
    }

    if (project.balanceCents === 0) {
      await db.from("quotes").update({ status: "completed" }).eq("id", invoice.quote_id);
    }
  }

  if (input.status === "processing" && previous !== "processing" && quote) {
    await emailPaymentUpdate({
      to: quote.contact_email as string,
      name: quote.contact_name as string,
      invoiceNumber: invoice.invoice_number as string,
      amountCents: Number(attempt.amount_cents),
      kind: "processing",
      url,
    });
  }

  if (input.status === "failed" && previous !== "failed" && quote) {
    await emailPaymentUpdate({
      to: quote.contact_email as string,
      name: quote.contact_name as string,
      invoiceNumber: invoice.invoice_number as string,
      amountCents: Number(attempt.amount_cents),
      kind: "failed",
      url,
    });
  }

  await writeAudit({
    actorLabel: "payments",
    action: `payment.${input.status}`,
    entity: "invoice",
    entityId: invoice.id as string,
    metadata: {
      invoice: invoice.invoice_number,
      provider_payment_id: input.providerPaymentId,
      amount_cents: input.amountCents ?? attempt.amount_cents,
    },
  });

  return { applied: true as const, invoicePaymentId: attempt.id as string };
}

/** Pulls the authoritative status from the payment service and applies it. */
export async function syncPayment(providerPaymentId: string) {
  const { PaymentService } = await import("@/lib/payments/service.server");
  const snapshot = await PaymentService.getPayment(providerPaymentId);
  return applyPaymentStatus({
    providerPaymentId: snapshot.providerPaymentId,
    status: snapshot.status,
    amountCents: snapshot.amountCents,
    paymentMethod: snapshot.paymentMethod,
    connector: snapshot.connector,
    processorTransactionId: snapshot.processorTransactionId,
    failureCode: snapshot.failureCode,
    failureMessage: snapshot.failureMessage,
  });
}

/** Issues a full or partial refund against a recorded payment. */
export async function refundInvoicePayment(input: {
  invoicePaymentId: string;
  amountCents: number;
  reason?: string | null;
  actorId?: string | null;
}) {
  const { PaymentService } = await import("@/lib/payments/service.server");
  const db = adminDb();
  const { data: attempt } = await db
    .from("invoice_payments")
    .select("id, invoice_id, amount_cents, status, hyperswitch_payment_id")
    .eq("id", input.invoicePaymentId)
    .maybeSingle();
  if (!attempt || attempt.status !== "succeeded" || !attempt.hyperswitch_payment_id) {
    throw new Error("Only settled payments can be refunded.");
  }
  if (input.amountCents <= 0 || input.amountCents > Number(attempt.amount_cents)) {
    throw new Error("Refund amount is outside the payment amount.");
  }

  const refund = await PaymentService.refundPayment({
    providerPaymentId: attempt.hyperswitch_payment_id as string,
    amountCents: input.amountCents,
    reason: input.reason ?? null,
  });

  await db.from("refunds").insert({
    invoice_payment_id: attempt.id,
    amount_cents: input.amountCents,
    reason: input.reason ?? null,
    initiated_by: input.actorId ?? null,
    initiated_label: "admin",
    hyperswitch_refund_id: refund.refundId,
    status: refund.status,
  });

  await writeAudit({
    actorId: input.actorId ?? null,
    actorLabel: "admin",
    action: "payment.refund_requested",
    entity: "invoice",
    entityId: attempt.invoice_id as string,
    metadata: { amount_cents: input.amountCents, refund_id: refund.refundId, status: refund.status },
  });

  return { status: refund.status, refundId: refund.refundId };
}

/** Applies a confirmed refund status coming from a webhook. */
export async function applyRefundStatus(input: {
  refundId: string;
  status: string;
  amountCents: number;
  processorRefundId?: string | null;
}) {
  const db = adminDb();
  const { data: refund } = await db
    .from("refunds")
    .select("id, invoice_payment_id, status")
    .eq("hyperswitch_refund_id", input.refundId)
    .maybeSingle();
  if (!refund) return;
  if (refund.status === input.status) return;

  await db
    .from("refunds")
    .update({ status: input.status, processor_refund_id: input.processorRefundId ?? null })
    .eq("id", refund.id);

  if (input.status !== "succeeded") return;

  const { data: attempt } = await db
    .from("invoice_payments")
    .select("id, invoice_id, amount_cents")
    .eq("id", refund.invoice_payment_id)
    .maybeSingle();
  if (!attempt) return;

  const refunded = input.amountCents >= Number(attempt.amount_cents) ? "refunded" : "partially_refunded";
  await db.from("invoice_payments").update({ status: refunded }).eq("id", attempt.id);

  const { data: invoice } = await db
    .from("invoices")
    .select("id, quote_id, invoice_number, amount_cents, amount_paid_cents")
    .eq("id", attempt.invoice_id)
    .maybeSingle();
  if (!invoice) return;

  const paid = Math.max(0, Number(invoice.amount_paid_cents ?? 0) - input.amountCents);
  await db
    .from("invoices")
    .update({ amount_paid_cents: paid, status: paid > 0 ? "partially_paid" : "sent", paid_at: null })
    .eq("id", invoice.id);

  const { data: quote } = await db
    .from("quotes")
    .select("contact_name, contact_email")
    .eq("id", invoice.quote_id)
    .maybeSingle();
  if (quote) {
     const { emailPaymentUpdate } = await import("@/lib/engagement-email.server");
    await emailPaymentUpdate({
      to: quote.contact_email as string,
      name: quote.contact_name as string,
      invoiceNumber: invoice.invoice_number as string,
      amountCents: input.amountCents,
      kind: "refunded",
    });
  }

  await writeAudit({
    actorLabel: "payments",
    action: "payment.refunded",
    entity: "invoice",
    entityId: invoice.id as string,
    metadata: { amount_cents: input.amountCents, refund_id: input.refundId },
  });
}

/** Records a payment BLEXware received outside the platform (check, transfer). */
export async function recordOfflinePayment(input: {
  invoiceId: string;
  amountCents: number;
  note?: string | null;
  actorId?: string | null;
}) {
  const db = adminDb();
  const { data: attempt, error } = await db
    .from("invoice_payments")
    .insert({
      invoice_id: input.invoiceId,
      amount_cents: input.amountCents,
      status: "created",
      payment_method: "offline",
      metadata: { note: input.note ?? null },
    })
    .select("id, payment_reference")
    .single();
  if (error || !attempt) throw new Error("Could not record the payment.");

  const providerPaymentId = `offline_${attempt.payment_reference as string}`;
  await db
    .from("invoice_payments")
    .update({ hyperswitch_payment_id: providerPaymentId })
    .eq("id", attempt.id);

  await applyPaymentStatus({
    providerPaymentId,
    status: "succeeded",
    amountCents: input.amountCents,
    paymentMethod: "offline",
  });

  await writeAudit({
    actorId: input.actorId ?? null,
    actorLabel: "admin",
    action: "payment.offline_recorded",
    entity: "invoice",
    entityId: input.invoiceId,
    metadata: { amount_cents: input.amountCents, note: input.note ?? null },
  });

  return { ok: true };
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

  // Overdue sweep: unpaid invoices past their due date.
  const today = new Date().toISOString().slice(0, 10);
  const { data: overdue } = await db
    .from("invoices")
    .select("id")
    .in("status", ["sent", "viewed", "partially_paid"])
    .lt("due_date", today);
  for (const invoice of overdue ?? []) {
    await db.from("invoices").update({ status: "overdue" }).eq("id", invoice.id);
  }

  // Reconciliation: re-check payments still reported as processing.
  const { data: pending } = await db
    .from("invoice_payments")
    .select("hyperswitch_payment_id")
    .in("status", ["processing", "action_required"])
    .not("hyperswitch_payment_id", "is", null)
    .limit(50);
  for (const payment of pending ?? []) {
    try {
      await syncPayment(payment.hyperswitch_payment_id as string);
    } catch (error) {
      console.error("[cron:reconcile]", error);
    }
  }

  return {
    invoicesSent: due?.length ?? 0,
    proposalsClosed: staleProposals?.length ?? 0,
    estimatesExpired: staleEstimates?.length ?? 0,
    invoicesOverdue: overdue?.length ?? 0,
    paymentsReconciled: pending?.length ?? 0,
  };
}
