import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { EstimateLineItem, PaymentPlanKind } from "@/lib/documents/types";
import { guarded } from "@/lib/errors";

export type DirectInvoiceInput = {
  /** When set, the invoice is added to this existing project instead of creating one. */
  quoteId?: string;
  contactName: string;
  contactEmail: string;
  company?: string;
  phone?: string;
  projectType: string;
  internalNotes?: string;
  description: string;
  issueDate?: string;
  dueDate?: string;
  lineItems: EstimateLineItem[];
  discountCents?: number;
  paymentKind: PaymentPlanKind;
  customPayments?: { label: string; amountCents: number }[];
  sendNow: boolean;
};

export type DirectInvoiceClient = {
  email: string;
  name: string;
  company: string | null;
};

export type DirectInvoiceProject = {
  id: string;
  quoteNumber: string;
  name: string;
  status: string;
};

/** Projects already on file for one client, so invoices can join an existing one. */
export const listClientProjects = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { email: string }) => {
    if (!data?.email?.trim()) throw new Error("Choose a client first");
    return { email: data.email.trim().toLowerCase() };
  })
  .handler(
    guarded("listClientProjects", "loading that client's projects", async ({ data, context }) => {
      const { requireAdmin, adminDb } = await import("@/lib/blex.server");
      await requireAdmin(context.supabase, context.userId);
      const { data: rows } = await adminDb()
        .from("quotes")
        .select("id, quote_number, project_type, status, created_at")
        .eq("contact_email", data.email)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(100);

      return {
        projects: ((rows ?? []) as Record<string, unknown>[]).map((row) => ({
          id: String(row.id),
          quoteNumber: String(row.quote_number ?? ""),
          name: String(row.project_type ?? "Project"),
          status: String(row.status ?? ""),
        })) as DirectInvoiceProject[],
      };
    }),
  );


/** Clients we already have on file, for the "existing client" picker. */
export const listInvoiceClients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: Record<string, never>) => data)
  .handler(
    guarded("listInvoiceClients", "loading your clients", async ({ context }) => {
      const { requireAdmin, adminDb } = await import("@/lib/blex.server");
      await requireAdmin(context.supabase, context.userId);
      const { data } = await adminDb()
        .from("quotes")
        .select("contact_email, contact_name, company, created_at")
        .order("created_at", { ascending: false })
        .limit(500);

      const seen = new Map<string, DirectInvoiceClient>();
      for (const row of data ?? []) {
        const email = String(row.contact_email ?? "").toLowerCase();
        if (!email || seen.has(email)) continue;
        seen.set(email, {
          email,
          name: String(row.contact_name ?? email),
          company: (row.company as string | null) ?? null,
        });
      }
      return { clients: [...seen.values()] };
    }),
  );

/**
 * Creates a client + project record and its invoice(s) directly, with no
 * proposal, estimate or SOW attached. Splitting reuses the same payment plan
 * builder the SOW schedule uses, so amounts always add back to the total.
 */
export const createDirectInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: DirectInvoiceInput) => {
    if (!data.contactName?.trim()) throw new Error("Enter the client contact name");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.contactEmail ?? "")) {
      throw new Error("Enter a valid client email address");
    }
    if (!data.description?.trim()) throw new Error("Add a short description for the invoice");
    const items = (data.lineItems ?? []).filter(
      (item) => item.label?.trim() && Number.isFinite(item.amountCents) && item.amountCents > 0,
    );
    if (!items.length) throw new Error("Add at least one service or product line");
    return { ...data, lineItems: items };
  })
  .handler(
    guarded("createDirectInvoice", "creating the invoice", async ({ data, context }) => {
      const { requireAdmin, adminDb, writeAudit } = await import("@/lib/blex.server");
      await requireAdmin(context.supabase, context.userId);
      const { buildPaymentPlan, paymentPlanToInvoiceEntries } = await import(
        "@/lib/documents/compose"
      );
      const db = adminDb();

      const subtotalCents = data.lineItems.reduce(
        (sum, item) => sum + Math.round(item.amountCents),
        0,
      );
      const discountCents = Math.min(subtotalCents, Math.max(0, Math.round(data.discountCents ?? 0)));
      const totalCents = subtotalCents - discountCents;
      if (totalCents <= 0) throw new Error("The invoice total must be greater than zero");

      const plan = buildPaymentPlan(data.paymentKind, totalCents, data.customPayments);
      if (!plan.rows.length) throw new Error("Choose how this invoice should be paid");
      const planTotal = plan.rows.reduce((sum, row) => sum + row.amountCents, 0);
      if (planTotal !== totalCents) {
        throw new Error("The payment split must add up to the invoice total");
      }

      const email = data.contactEmail.trim().toLowerCase();
      const projectType = data.projectType?.trim() || "Direct invoice";

      let quoteId: string;
      let quoteNumber: string;
      let seqOffset = 0;

      if (data.quoteId) {
        const { data: existing } = await db
          .from("quotes")
          .select("id, quote_number, contact_email")
          .eq("id", data.quoteId)
          .maybeSingle();
        if (!existing) throw new Error("That project could not be found");
        if (String(existing.contact_email ?? "").toLowerCase() !== email) {
          throw new Error("That project belongs to a different client");
        }
        quoteId = existing.id as string;
        quoteNumber = existing.quote_number as string;

        const { data: last } = await db
          .from("invoices")
          .select("sequence")
          .eq("quote_id", quoteId)
          .order("sequence", { ascending: false })
          .limit(1)
          .maybeSingle();
        seqOffset = Number(last?.sequence ?? 0);
      } else {
        const { data: quote, error: quoteError } = await db
          .from("quotes")
          .insert({
            status: "invoicing",
            project_type: projectType,
            industry: "Not stated",
            services: ["Direct invoice"],
            goals: data.description.trim(),
            budget: "Not stated",
            timeline: "Not stated",
            contact_name: data.contactName.trim(),
            contact_email: email,
            company: data.company?.trim() || null,
            phone: data.phone?.trim() || null,
            consent: true,
            internal_notes: data.internalNotes?.trim() || "Direct-billed — no quote or proposal.",
          })
          .select("id, quote_number")
          .single();
        if (quoteError || !quote)
          throw new Error(quoteError?.message ?? "Could not create the project");
        quoteId = quote.id as string;
        quoteNumber = quote.quote_number as string;
      }

      const anchor = data.issueDate ? new Date(`${data.issueDate}T00:00:00.000Z`) : new Date();
      const entries = paymentPlanToInvoiceEntries(plan, anchor);
      const single = entries.length === 1;

      const rows = entries.map((entry) => ({
        quote_id: quoteId,
        agreement_id: null,
        sequence: entry.sequence + seqOffset,
        amount_cents: entry.amountCents,
        description: single
          ? data.description.trim()
          : `${data.description.trim()} — ${entry.label}`,
        due_date:
          entry.sequence === 1 && data.dueDate ? data.dueDate : entry.dueDate,
        scheduled_send_at: entry.scheduledSendAt,
        issue_date: data.issueDate ?? null,
        status: "draft",
        line_items: entry.sequence === 1 ? data.lineItems : [],
        subtotal_cents: entry.sequence === 1 ? subtotalCents : entry.amountCents,
        discount_cents: entry.sequence === 1 ? discountCents : 0,
      }));


      const { data: inserted, error: invoiceError } = await db
        .from("invoices")
        .insert(rows as never)
        .select("id, sequence, invoice_number");
      if (invoiceError) throw new Error(invoiceError.message);

      const first = (inserted ?? []).find((row) => Number(row.sequence) === seqOffset + 1);
      if (data.sendNow && first) {
        const { dispatchInvoice } = await import("@/lib/invoicing.server");
        await dispatchInvoice(first.id as string);
      }

      await writeAudit({
        actorId: context.userId,
        action: "invoice.created_direct",
        entity: "quote",
        entityId: quoteId,
        metadata: {
          quote_number: quoteNumber,
          invoices: rows.length,
          total_cents: totalCents,
          sent: Boolean(data.sendNow && first),
        },
      });

      return {
        quoteId,
        quoteNumber,

        invoiceCount: rows.length,
        totalCents,
        sent: Boolean(data.sendNow && first),
        firstInvoiceNumber: (first?.invoice_number as string | undefined) ?? null,
      };
    }),
  );
