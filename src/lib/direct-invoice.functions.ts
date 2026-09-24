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
  /** Client agreed to receive invoice reminder texts. Requires a phone number. */
  smsOptIn?: boolean;
  projectType: string;
  internalNotes?: string;
  description: string;
  issueDate?: string;
  dueDate?: string;
  scheduledSendDate?: string;
  lineItems: EstimateLineItem[];
  discountCents?: number;
  paymentKind: PaymentPlanKind;
  customPayments?: {
    label: string;
    amountCents: number;
    scheduledSendDate?: string;
    dueDate?: string;
  }[];
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


/**
 * Moves every invoice on one project over to another project belonging to the
 * same client, continuing the destination's payment order. Used to consolidate
 * duplicate one-off projects created by direct invoicing.
 */
export const moveInvoicesToProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { fromQuoteId: string; toQuoteId: string }) => {
    if (!data?.fromQuoteId || !data?.toQuoteId) throw new Error("Choose a project to move into");
    if (data.fromQuoteId === data.toQuoteId) throw new Error("Choose a different project");
    return data;
  })
  .handler(
    guarded("moveInvoicesToProject", "moving the invoices", async ({ data, context }) => {
      const { requireAdmin, adminDb, writeAudit } = await import("@/lib/blex.server");
      await requireAdmin(context.supabase, context.userId);
      const db = adminDb();

      const { data: quotes } = await db
        .from("quotes")
        .select("id, quote_number, contact_email")
        .in("id", [data.fromQuoteId, data.toQuoteId]);
      const from = (quotes ?? []).find((row) => row.id === data.fromQuoteId);
      const to = (quotes ?? []).find((row) => row.id === data.toQuoteId);
      if (!from || !to) throw new Error("One of those projects could not be found");
      if (
        String(from.contact_email ?? "").toLowerCase() !==
        String(to.contact_email ?? "").toLowerCase()
      ) {
        throw new Error("Invoices can only move between projects for the same client");
      }

      const { data: moving } = await db
        .from("invoices")
        .select("id, sequence, agreement_id")
        .eq("quote_id", data.fromQuoteId)
        .order("sequence", { ascending: true });
      const list = (moving ?? []) as Record<string, unknown>[];
      if (!list.length) throw new Error("That project has no invoices to move");
      if (list.some((row) => row.agreement_id)) {
        throw new Error("Invoices tied to a signed agreement cannot be moved");
      }

      const { data: last } = await db
        .from("invoices")
        .select("sequence")
        .eq("quote_id", data.toQuoteId)
        .order("sequence", { ascending: false })
        .limit(1)
        .maybeSingle();
      let next = Number(last?.sequence ?? 0);

      for (const row of list) {
        next += 1;
        const { error } = await db
          .from("invoices")
          .update({ quote_id: data.toQuoteId, sequence: next })
          .eq("id", String(row.id));
        if (error) throw new Error(error.message);
      }

      await writeAudit({
        actorId: context.userId,
        action: "invoice.moved_project",
        entity: "quote",
        entityId: data.toQuoteId,
        metadata: {
          from_quote: from.quote_number,
          to_quote: to.quote_number,
          invoices: list.length,
        },
      });

      return {
        moved: list.length,
        toQuoteId: data.toQuoteId,
        toQuoteNumber: String(to.quote_number ?? ""),
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
            sms_opt_in: data.smsOptIn === true && !!data.phone?.trim(),
            sms_opt_in_at:
              data.smsOptIn === true && data.phone?.trim() ? new Date().toISOString() : null,
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

      const MONTH_MS = 30 * 86_400_000;
      const rows = entries.map((entry) => {
        // Custom split rows carry no send date of their own, so space them a
        // month apart — otherwise they would sit forever without being emailed.
        const custom = data.customPayments?.[entry.sequence - 1];
        const selectedSendDate =
          entry.sequence === 1 ? data.scheduledSendDate : custom?.scheduledSendDate;
        const sendAt = selectedSendDate
          ? `${selectedSendDate}T14:00:00.000Z`
          : entry.sequence === 1
            ? null
            : (entry.scheduledSendAt ??
              new Date(anchor.getTime() + (entry.sequence - 1) * MONTH_MS).toISOString());
        const dueDate =
          entry.sequence === 1
            ? (data.dueDate ?? entry.dueDate)
            : (custom?.dueDate ?? entry.dueDate ??
              (sendAt ? new Date(new Date(sendAt).getTime() + 7 * 86_400_000).toISOString().slice(0, 10) : null));
        return {
          quote_id: quoteId,
          agreement_id: null,
          sequence: entry.sequence + seqOffset,
          amount_cents: entry.amountCents,
          description: single
            ? data.description.trim()
            : `${data.description.trim()} — ${entry.label}`,
          due_date: dueDate,
          scheduled_send_at: sendAt,
          issue_date: entry.sequence === 1 ? (data.issueDate ?? null) : null,
          // Later payments must be "scheduled" with a send date or the nightly
          // worker never mails them; only the first is held for the manual send.
          status: sendAt ? "scheduled" : "draft",
          line_items: entry.sequence === 1 ? data.lineItems : [],
          subtotal_cents: entry.sequence === 1 ? subtotalCents : entry.amountCents,
          discount_cents: entry.sequence === 1 ? discountCents : 0,
        };
      });


      const { data: inserted, error: invoiceError } = await db
        .from("invoices")
        .insert(rows as never)
        .select("id, sequence, invoice_number");
      if (invoiceError) throw new Error(invoiceError.message);

      const first = (inserted ?? []).find((row) => Number(row.sequence) === seqOffset + 1);
      let sent = false;
      let deliveryError: string | null = null;
      if (data.sendNow && first) {
        const { dispatchInvoice } = await import("@/lib/invoicing.server");
        const result = await dispatchInvoice(first.id as string);
        sent = result.emailed;
        deliveryError = result.emailed ? null : (result.reason ?? "unknown error");
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
          sent,
          delivery_error: deliveryError,
        },
      });

      return {
        quoteId,
        quoteNumber,

        invoiceCount: rows.length,
        totalCents,
        sent,
        deliveryError,
        scheduledCount: rows.length - 1,
        firstInvoiceNumber: (first?.invoice_number as string | undefined) ?? null,
      };
    }),
  );
