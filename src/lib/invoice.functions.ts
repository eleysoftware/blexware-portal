import { createServerFn } from "@tanstack/react-start";

const TOKEN = /^[a-f0-9]{16,96}$/i;

const HIDDEN_STATUSES = ["scheduled", "void", "cancelled"];

export const getInvoiceByToken = createServerFn({ method: "POST" })
  .validator((data: { token: string }) => {
    if (!TOKEN.test(data.token)) throw new Error("Invalid link");
    return data;
  })
  .handler(async ({ data }) => {
    const { loadInvoiceByToken, markInvoiceViewed } = await import("@/lib/invoicing.server");
    const { isPaymentsConfigured } = await import("@/lib/payments/hyperswitch.server");

    const loaded = await loadInvoiceByToken(data.token);
    if (!loaded) return { invoice: null, client: null, paymentsEnabled: false };

    const { invoice, quote } = loaded;
    const status = String(invoice["status"]);
    if (HIDDEN_STATUSES.includes(status)) {
      return { invoice: null, client: null, paymentsEnabled: false };
    }

    await markInvoiceViewed(invoice["id"] as string, status, invoice["viewed_at"]);

    const amountCents = Number(invoice["amount_cents"]);
    const paidCents = Number(invoice["amount_paid_cents"] ?? 0);

    return {
      paymentsEnabled: isPaymentsConfigured(),
      invoice: {
        number: String(invoice["invoice_number"]),
        sequence: Number(invoice["sequence"]),
        amountCents,
        paidCents,
        balanceCents: Math.max(0, amountCents - paidCents),
        status: status === "sent" ? "viewed" : status,
        currency: String(invoice["currency"] ?? "usd"),
        description: (invoice["description"] as string | null) ?? null,
        issueDate: (invoice["issue_date"] as string | null) ?? (invoice["sent_at"] as string | null) ?? null,
        dueDate: (invoice["due_date"] as string | null) ?? null,
        paidAt: (invoice["paid_at"] as string | null) ?? null,
      },
      client: quote
        ? {
            name: String(quote["contact_name"]),
            company: (quote["company"] as string | null) ?? null,
            quoteNumber: String(quote["quote_number"]),
          }
        : null,
    };
  });

/** Server creates the payment (amount computed server-side) and returns only client-safe data. */
export const beginInvoicePayment = createServerFn({ method: "POST" })
  .validator((data: { token: string }) => {
    if (!TOKEN.test(data.token)) throw new Error("Invalid link");
    return data;
  })
  .handler(async ({ data }) => {
    const { startInvoicePayment } = await import("@/lib/invoicing.server");
    return startInvoicePayment(data.token);
  });

/** Backend-authoritative status check after the checkout widget finishes. */
export const confirmInvoicePayment = createServerFn({ method: "POST" })
  .validator((data: { token: string; reference: string }) => {
    if (!TOKEN.test(data.token)) throw new Error("Invalid link");
    if (!/^[a-f0-9]{8,64}$/i.test(data.reference)) throw new Error("Invalid payment reference");
    return data;
  })
  .handler(async ({ data }) => {
    const { adminDb } = await import("@/lib/blex.server");
    const { syncPayment } = await import("@/lib/invoicing.server");

    const { data: attempt } = await adminDb()
      .from("invoice_payments")
      .select("hyperswitch_payment_id, status")
      .eq("payment_reference", data.reference)
      .maybeSingle();
    if (!attempt?.hyperswitch_payment_id) return { status: "unknown" as const };

    await syncPayment(attempt.hyperswitch_payment_id as string);

    const { data: refreshed } = await adminDb()
      .from("invoice_payments")
      .select("status, payment_method")
      .eq("payment_reference", data.reference)
      .maybeSingle();

    return {
      status: (refreshed?.status as string | undefined) ?? "processing",
      paymentMethod: (refreshed?.payment_method as string | null) ?? null,
    };
  });
