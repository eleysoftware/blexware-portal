import { createServerFn } from "@tanstack/react-start";

const TOKEN = /^[a-f0-9]{16,96}$/i;

export const getInvoiceByToken = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string }) => {
    if (!TOKEN.test(data.token)) throw new Error("Invalid link");
    return data;
  })
  .handler(async ({ data }) => {
    const { adminDb } = await import("@/lib/blex.server");
    const db = adminDb();

    const { data: invoice } = await db
      .from("invoices")
      .select("id, invoice_number, sequence, amount_cents, status, due_date, sent_at, paid_at, quote_id")
      .eq("pay_token", data.token)
      .maybeSingle();
    if (!invoice || invoice.status === "scheduled" || invoice.status === "void") {
      return { invoice: null, client: null };
    }

    const { data: quote } = await db
      .from("quotes")
      .select("quote_number, contact_name, company")
      .eq("id", invoice.quote_id)
      .maybeSingle();

    return {
      invoice: {
        number: invoice.invoice_number as string,
        sequence: Number(invoice.sequence),
        amountCents: Number(invoice.amount_cents),
        status: invoice.status as "sent" | "paid",
        dueDate: (invoice.due_date as string | null) ?? null,
        paidAt: (invoice.paid_at as string | null) ?? null,
      },
      client: quote
        ? {
            name: quote.contact_name as string,
            company: (quote.company as string | null) ?? null,
            quoteNumber: quote.quote_number as string,
          }
        : null,
    };
  });

export const startInvoiceCheckout = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string }) => {
    if (!TOKEN.test(data.token)) throw new Error("Invalid link");
    return data;
  })
  .handler(async ({ data }) => {
    const { createCheckoutSession } = await import("@/lib/invoicing.server");
    return { url: await createCheckoutSession(data.token) };
  });
