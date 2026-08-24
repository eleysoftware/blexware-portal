import { createServerFn } from "@tanstack/react-start";
import { guarded } from "@/lib/errors";

import type { ProposalRecord } from "@/lib/quote-schema";

export const getProposalByToken = createServerFn({ method: "POST" })
  .validator((data: { token: string }) => {
    if (!/^[a-f0-9]{16,96}$/i.test(data.token)) throw new Error("Invalid link");
    return data;
  })
  .handler(
    guarded("getProposalByToken", "loading the proposal", async ({ data }) => {
      const { adminDb } = await import("@/lib/blex.server");
      const db = adminDb();

      const { data: proposal } = await db
        .from("proposals")
        .select("id, status, content, sent_at, client_response_note, quote_id, doc")
        .eq("review_token", data.token)
        .maybeSingle();

      if (!proposal || proposal.status === "draft") return { proposal: null, documents: [] };

      const [{ data: quote }, { data: documents }] = await Promise.all([
        db
          .from("quotes")
          .select("quote_number, contact_name, project_type")
          .eq("id", proposal.quote_id)
          .maybeSingle(),
        db
          .from("documents")
          .select("id, entity, entity_id, kind, format")
          .eq("entity", "proposal")
          .eq("entity_id", proposal.id)
          .order("created_at", { ascending: false }),
      ]);

      return {
        proposal: {
          id: proposal.id as string,
          status: proposal.status as ProposalRecord["status"],
          content: proposal.content as string,
          doc: (proposal.doc as import("@/lib/documents/types").ProjectDocument | null) ?? null,
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
        documents: (documents ?? []) as {
          id: string;
          entity: string;
          entity_id: string;
          kind: string;
          format: string;
        }[],
      };
    }),
  );

export const getProposalDocumentUrl = createServerFn({ method: "POST" })
  .validator((data: { token: string; documentId: string }) => {
    if (!/^[a-f0-9]{16,96}$/i.test(data.token)) throw new Error("Invalid link");
    if (!/^[0-9a-f-]{36}$/i.test(data.documentId)) throw new Error("Unknown document");
    return data;
  })
  .handler(
    guarded("getProposalDocumentUrl", "preparing the download", async ({ data }) => {
      const { adminDb } = await import("@/lib/blex.server");
      const db = adminDb();

      const { data: proposal } = await db
        .from("proposals")
        .select("id, status")
        .eq("review_token", data.token)
        .maybeSingle();
      if (!proposal || proposal.status === "draft") throw new Error("This link is no longer active.");

      const { data: doc } = await db
        .from("documents")
        .select("id, storage_path")
        .eq("id", data.documentId)
        .eq("entity", "proposal")
        .eq("entity_id", proposal.id)
        .maybeSingle();
      if (!doc) throw new Error("Document not found");

       const { signedDocumentUrl } = await import("@/lib/document-storage.server");
      return { url: await signedDocumentUrl(doc.storage_path as string) };
    }),
  );

export const respondToProposal = createServerFn({ method: "POST" })
  .validator(
    (data: { token: string; action: "approved" | "changes_requested" | "declined"; note?: string }) => {
      if (!/^[a-f0-9]{16,96}$/i.test(data.token)) throw new Error("Invalid link");
      if (!["approved", "changes_requested", "declined"].includes(data.action)) {
        throw new Error("Unknown action");
      }
      return { ...data, note: data.note?.slice(0, 2000) };
    },
  )
  .handler(
    guarded("respondToProposal", "saving your response", async ({ data }) => {
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
    }),
  );
