import { createServerFn } from "@tanstack/react-start";

import type { ProposalRecord } from "@/lib/quote-schema";

export const getProposalByToken = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string }) => {
    if (!/^[a-f0-9]{16,96}$/i.test(data.token)) throw new Error("Invalid link");
    return data;
  })
  .handler(async ({ data }) => {
    const { adminDb } = await import("@/lib/blex.server");
    const db = adminDb();

    const { data: proposal } = await db
      .from("proposals")
      .select("id, status, content, sent_at, client_response_note, quote_id")
      .eq("review_token", data.token)
      .maybeSingle();

    if (!proposal || proposal.status === "draft") return { proposal: null };

    const { data: quote } = await db
      .from("quotes")
      .select("quote_number, contact_name, project_type")
      .eq("id", proposal.quote_id)
      .maybeSingle();

    return {
      proposal: {
        id: proposal.id as string,
        status: proposal.status as ProposalRecord["status"],
        content: proposal.content as string,
        sentAt: (proposal.sent_at as string | null) ?? null,
        note: (proposal.client_response_note as string | null) ?? null,
      },
      quote: quote
        ? {
            number: quote.quote_number as string,
            name: quote.contact_name as string,
            projectType: quote.project_type as string,
          }
        : null,
    };
  });

export const respondToProposal = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { token: string; action: "approved" | "changes_requested" | "declined"; note?: string }) => {
      if (!/^[a-f0-9]{16,96}$/i.test(data.token)) throw new Error("Invalid link");
      if (!["approved", "changes_requested", "declined"].includes(data.action)) {
        throw new Error("Unknown action");
      }
      return { ...data, note: data.note?.slice(0, 2000) };
    },
  )
  .handler(async ({ data }) => {
    const { adminDb, writeAudit } = await import("@/lib/blex.server");
    const db = adminDb();

    const { data: proposal } = await db
      .from("proposals")
      .select("id, status, quote_id")
      .eq("review_token", data.token)
      .maybeSingle();
    if (!proposal || proposal.status === "draft") throw new Error("This link is no longer active.");

    await db
      .from("proposals")
      .update({
        status: data.action,
        client_response_note: data.note ?? null,
        responded_at: new Date().toISOString(),
      })
      .eq("id", proposal.id);

    const quoteStatus =
      data.action === "approved" ? "approved" : data.action === "declined" ? "declined" : "reviewing";
    await db.from("quotes").update({ status: quoteStatus }).eq("id", proposal.quote_id);

    await writeAudit({
      actorLabel: "prospect",
      action: `proposal.${data.action}`,
      entity: "quote",
      entityId: proposal.quote_id as string,
    });

    return { status: data.action };
  });
