import { createServerFn, getRequestHeader } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Client-portal reads/writes for the engagement pipeline. Visibility is always
 * proven through the caller's own Supabase client (RLS); the service role is
 * only used afterwards to perform the write or mint a signed URL.
 */
export const getMyEngagement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { quoteId: string }) => {
    if (!UUID.test(data.quoteId)) throw new Error("Unknown project");
    return data;
  })
  .handler(async ({ data, context }) => {
    const db = context.supabase;

    const [estimates, agreements, invoices, documents] = await Promise.all([
      db
        .from("estimates")
        .select("id, status, doc, total_cents, duration_note, sent_at, expires_at, responded_at, response_note")
        .eq("quote_id", data.quoteId)
        .order("created_at", { ascending: false }),
      db
        .from("agreements")
        .select("id, agreement_number, status, doc, total_cents, sent_at, signed_at, signer_name")
        .eq("quote_id", data.quoteId)
        .order("created_at", { ascending: false }),
      db
        .from("invoices")
        .select("id, invoice_number, sequence, amount_cents, status, due_date, sent_at, paid_at, pay_token")
        .eq("quote_id", data.quoteId)
        .order("sequence"),
      db
        .from("documents")
        .select("id, entity, entity_id, kind, format, created_at")
        .eq("quote_id", data.quoteId)
        .order("created_at", { ascending: false }),
    ]);

    return {
      estimate: (estimates.data ?? [])[0] ?? null,
      agreement: (agreements.data ?? [])[0] ?? null,
      invoices: invoices.data ?? [],
      documents: documents.data ?? [],
    };
  });

export const getMyDocumentUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { documentId: string }) => {
    if (!UUID.test(data.documentId)) throw new Error("Unknown document");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { data: doc } = await context.supabase
      .from("documents")
      .select("id, storage_path, format")
      .eq("id", data.documentId)
      .maybeSingle();
    if (!doc) throw new Error("Document not found");

    const { signedDocumentUrl } = await import("@/lib/engagement.server");
    return { url: await signedDocumentUrl((doc as { storage_path: string }).storage_path) };
  });

/** Approve, request changes on, or decline the proposal from the portal. */
export const respondToMyProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      proposalId: string;
      action: "approved" | "changes_requested" | "declined";
      note?: string;
    }) => {
      if (!UUID.test(data.proposalId)) throw new Error("Unknown proposal");
      if (!["approved", "changes_requested", "declined"].includes(data.action)) {
        throw new Error("Unknown action");
      }
      return { ...data, note: data.note?.slice(0, 2000) };
    },
  )
  .handler(async ({ data, context }) => {
    const { data: visible } = await context.supabase
      .from("proposals")
      .select("id, quote_id, status")
      .eq("id", data.proposalId)
      .maybeSingle();
    if (!visible) throw new Error("Proposal not found");

    const { adminDb, writeAudit } = await import("@/lib/blex.server");
    const { emailThankYouDeclined, notifyTeam } = await import("@/lib/engagement.server");
    const db = adminDb();

    await db
      .from("proposals")
      .update({
        status: data.action,
        client_response_note: data.note ?? null,
        responded_at: new Date().toISOString(),
      })
      .eq("id", data.proposalId);

    const quoteStatus =
      data.action === "approved" ? "approved" : data.action === "declined" ? "declined" : "reviewing";
    await db.from("quotes").update({ status: quoteStatus }).eq("id", visible.quote_id);

    const { data: quote } = await db
      .from("quotes")
      .select("quote_number, contact_name, contact_email")
      .eq("id", visible.quote_id)
      .maybeSingle();

    if (quote && data.action === "declined") {
      await emailThankYouDeclined({
        to: quote.contact_email as string,
        name: quote.contact_name as string,
        quoteNumber: quote.quote_number as string,
        note: data.note ?? null,
      });
    }
    if (quote) {
      await notifyTeam(
        `Proposal ${data.action.replace("_", " ")} — ${quote.quote_number as string}`,
        [
          `${quote.contact_name as string} ${data.action.replace("_", " ")} the proposal.`,
          data.note ? `Note: ${data.note}` : "",
        ].filter(Boolean),
        quote.contact_email as string,
      );
    }

    await writeAudit({
      actorId: context.userId,
      actorLabel: String(context.claims["email"] ?? ""),
      action: `proposal.${data.action}`,
      entity: "quote",
      entityId: visible.quote_id as string,
    });

    return { status: data.action };
  });

/** Approve or decline the priced estimate. */
export const respondToMyEstimate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { estimateId: string; action: "approved" | "declined"; note?: string }) => {
      if (!UUID.test(data.estimateId)) throw new Error("Unknown estimate");
      if (!["approved", "declined"].includes(data.action)) throw new Error("Unknown action");
      return { ...data, note: data.note?.slice(0, 2000) };
    },
  )
  .handler(async ({ data, context }) => {
    const { data: visible } = await context.supabase
      .from("estimates")
      .select("id, quote_id, status")
      .eq("id", data.estimateId)
      .maybeSingle();
    if (!visible) throw new Error("Estimate not found");
    if (visible.status !== "sent") throw new Error("This estimate is no longer open for response.");

    const { adminDb, writeAudit } = await import("@/lib/blex.server");
    const { emailThankYouDeclined, notifyTeam } = await import("@/lib/engagement.server");
    const db = adminDb();

    await db
      .from("estimates")
      .update({
        status: data.action,
        response_note: data.note ?? null,
        responded_at: new Date().toISOString(),
      })
      .eq("id", data.estimateId);

    await db
      .from("quotes")
      .update({ status: data.action === "approved" ? "estimate_approved" : "declined" })
      .eq("id", visible.quote_id);

    const { data: quote } = await db
      .from("quotes")
      .select("quote_number, contact_name, contact_email")
      .eq("id", visible.quote_id)
      .maybeSingle();

    if (quote && data.action === "declined") {
      await emailThankYouDeclined({
        to: quote.contact_email as string,
        name: quote.contact_name as string,
        quoteNumber: quote.quote_number as string,
        note: data.note ?? null,
      });
    }
    if (quote) {
      await notifyTeam(
        `Estimate ${data.action} — ${quote.quote_number as string}`,
        [
          `${quote.contact_name as string} ${data.action} the estimate.`,
          data.note ? `Note: ${data.note}` : "",
          data.action === "approved" ? "Next step: generate the SOW agreement." : "",
        ].filter(Boolean),
        quote.contact_email as string,
      );
    }

    await writeAudit({
      actorId: context.userId,
      action: `estimate.${data.action}`,
      entity: "quote",
      entityId: visible.quote_id as string,
    });

    return { status: data.action };
  });

/** Electronic signature on the SOW; triggers the invoice schedule. */
export const signMyAgreement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { agreementId: string; fullName: string; agreed: boolean }) => {
    if (!UUID.test(data.agreementId)) throw new Error("Unknown agreement");
    if (!data.agreed) throw new Error("Please confirm you agree to sign electronically.");
    if (data.fullName.trim().length < 3) throw new Error("Type your full legal name to sign.");
    return { ...data, fullName: data.fullName.trim().slice(0, 120) };
  })
  .handler(async ({ data, context }) => {
    const { data: visible } = await context.supabase
      .from("agreements")
      .select("id, quote_id, status, doc, agreement_number")
      .eq("id", data.agreementId)
      .maybeSingle();
    if (!visible) throw new Error("Agreement not found");
    if (visible.status === "signed") return { alreadySigned: true };
    if (visible.status !== "sent") throw new Error("This agreement is not open for signature.");

    const { adminDb, writeAudit } = await import("@/lib/blex.server");
    const { storeDocument, notifyTeam } = await import("@/lib/engagement.server");
    const { createInvoiceSchedule } = await import("@/lib/invoicing.server");
    const db = adminDb();

    const signedAt = new Date();
    const ip =
      getRequestHeader("cf-connecting-ip") ??
      getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ??
      null;
    const userAgent = getRequestHeader("user-agent") ?? null;

    const signedDoc = {
      ...(visible.doc as Record<string, unknown>),
      acceptance: {
        ...((visible.doc as { acceptance?: Record<string, unknown> }).acceptance ?? {}),
        signerName: data.fullName,
        signatureText: data.fullName,
        signedAt: signedAt.toLocaleString("en-US"),
      },
    };

    const stored = await storeDocument({
      quoteId: visible.quote_id as string,
      entity: "agreement",
      entityId: visible.id as string,
      kind: "sow_signed",
      doc: signedDoc as never,
      slug: visible.agreement_number as string,
    });
    const pdf = stored.find((file) => file.format === "pdf");

    await db
      .from("agreements")
      .update({
        status: "signed",
        doc: signedDoc,
        signed_at: signedAt.toISOString(),
        signer_name: data.fullName,
        signer_email: String(context.claims["email"] ?? ""),
        signer_ip: ip,
        signer_user_agent: userAgent,
        document_hash: pdf?.sha256 ?? null,
        signed_pdf_path: pdf?.path ?? null,
      })
      .eq("id", visible.id);

    await db.from("quotes").update({ status: "signed" }).eq("id", visible.quote_id);
    await createInvoiceSchedule(visible.id as string);

    await notifyTeam(`SOW signed — ${visible.agreement_number as string}`, [
      `${data.fullName} signed ${visible.agreement_number as string} at ${signedAt.toLocaleString("en-US")}.`,
      "The first invoice has been issued. Work begins once it is paid.",
    ]);

    await writeAudit({
      actorId: context.userId,
      actorLabel: data.fullName,
      action: "agreement.signed",
      entity: "quote",
      entityId: visible.quote_id as string,
      metadata: { agreement: visible.agreement_number, hash: pdf?.sha256 ?? null },
    });

    return { signed: true };
  });
