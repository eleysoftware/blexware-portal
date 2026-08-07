import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  ProposalRecord,
  QuoteFileRecord,
  QuoteRecord,
  QuoteStatus,
} from "@/lib/quote-schema";
import { quoteStatuses } from "@/lib/quote-schema";

export const listQuotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { status?: string; search?: string }) => data ?? {})
  .handler(async ({ data, context }) => {
    const { requireAdmin, adminDb } = await import("@/lib/blex.server");
    await requireAdmin(context.supabase, context.userId);

    let query = adminDb()
      .from("quotes")
      .select(
        "id, quote_number, status, project_type, industry, budget, timeline, contact_name, contact_email, company, created_at",
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(200);

    if (data.status && data.status !== "all") query = query.eq("status", data.status);
    if (data.search?.trim()) {
      const term = `%${data.search.trim()}%`;
      query = query.or(
        `quote_number.ilike.${term},contact_name.ilike.${term},contact_email.ilike.${term},company.ilike.${term}`,
      );
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const counts: Record<string, number> = {};
    for (const status of quoteStatuses) counts[status] = 0;
    const { data: all } = await adminDb()
      .from("quotes")
      .select("status")
      .is("deleted_at", null);
    for (const row of (all ?? []) as { status: string }[]) {
      counts[row.status] = (counts[row.status] ?? 0) + 1;
    }

    return { quotes: (rows ?? []) as Partial<QuoteRecord>[], counts };
  });

export const getQuoteDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { requireAdmin, adminDb } = await import("@/lib/blex.server");
    await requireAdmin(context.supabase, context.userId);
    const db = adminDb();

    const { data: quote, error } = await db
      .from("quotes")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!quote) throw new Error("Quote not found");

    const { data: files } = await db
      .from("quote_files")
      .select("id, original_name, byte_size, mime_type, created_at")
      .eq("quote_id", data.id)
      .order("created_at");

    const { data: proposals } = await db
      .from("proposals")
      .select("*")
      .eq("quote_id", data.id)
      .order("created_at", { ascending: false });

    const { data: audit } = await db
      .from("audit_log")
      .select("id, action, actor_label, created_at, metadata")
      .eq("entity_id", data.id)
      .order("created_at", { ascending: false })
      .limit(30);

    return {
      quote: quote as QuoteRecord,
      files: (files ?? []) as QuoteFileRecord[],
      proposals: (proposals ?? []) as ProposalRecord[],
      audit: (audit ?? []) as {
        id: string;
        action: string;
        actor_label: string | null;
        created_at: string;
      }[],
    };
  });

export const updateQuoteStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; status: QuoteStatus }) => {
    if (!quoteStatuses.includes(data.status)) throw new Error("Unknown status");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { requireAdmin, adminDb, writeAudit } = await import("@/lib/blex.server");
    await requireAdmin(context.supabase, context.userId);

    const { error } = await adminDb()
      .from("quotes")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await writeAudit({
      actorId: context.userId,
      actorLabel: String(context.claims['email'] ?? context.userId),
      action: "quote.status_changed",
      entity: "quote",
      entityId: data.id,
      metadata: { status: data.status },
    });
    return { ok: true };
  });

export const getQuoteFileUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { fileId: string }) => data)
  .handler(async ({ data, context }) => {
    const { requireAdmin, adminDb, writeAudit, QUOTE_BUCKET } = await import(
      "@/lib/blex.server"
    );
    await requireAdmin(context.supabase, context.userId);
    const db = adminDb();

    const { data: file } = await db
      .from("quote_files")
      .select("storage_path, quote_id, original_name")
      .eq("id", data.fileId)
      .maybeSingle();
    if (!file) throw new Error("File not found");

    const { data: signed, error } = await db.storage
      .from(QUOTE_BUCKET)
      .createSignedUrl(file.storage_path as string, 120);
    if (error || !signed) throw new Error("Could not create download link");

    await writeAudit({
      actorId: context.userId,
      actorLabel: String(context.claims['email'] ?? context.userId),
      action: "quote_file.downloaded",
      entity: "quote",
      entityId: file.quote_id as string,
      metadata: { file: file.original_name },
    });

    return { url: signed.signedUrl as string };
  });

export const generateProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { quoteId: string }) => data)
  .handler(async ({ data, context }) => {
    const { requireAdmin, adminDb, writeAudit } = await import("@/lib/blex.server");
    await requireAdmin(context.supabase, context.userId);
    const db = adminDb();

    const { data: quote } = await db
      .from("quotes")
      .select("*")
      .eq("id", data.quoteId)
      .maybeSingle();
    if (!quote) throw new Error("Quote not found");

    const apiKey = process.env['LOVABLE_API_KEY'];
    if (!apiKey) throw new Error("AI is not configured for this project yet.");

    const prompt = [
      `Prospect: ${quote.contact_name}${quote.company ? ` (${quote.company})` : ""}`,
      `Industry: ${quote.industry}`,
      `Project type: ${quote.project_type}`,
      `Services requested: ${(quote.services as string[] | null)?.join(", ") ?? "n/a"}`,
      `Budget range: ${quote.budget}`,
      `Timeline: ${quote.timeline}`,
      `Goals: ${quote.goals}`,
      `Desired features: ${quote.features ?? "not specified"}`,
    ].join("\n");

    const model = "google/gemini-2.5-flash";
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "You write software project proposals for BLEXware, a Black-led AI and custom software studio. Write in markdown with these H2 sections in order: Executive Summary, Business Goals, Functional Requirements, Technical Requirements, Architecture, Recommended Technology, Timeline, Phases, Deliverables, Optional Features, Discovery Questions. Be concrete and grounded in the intake answers. Never invent pricing beyond the stated budget range, and never invent certifications or compliance claims.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (response.status === 429) throw new Error("AI rate limit reached. Try again shortly.");
    if (response.status === 402) throw new Error("AI credits exhausted for this workspace.");
    if (!response.ok) {
      console.error("[generateProposal]", response.status, await response.text());
      throw new Error("The proposal draft could not be generated.");
    }

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("The AI returned an empty draft.");

    const { data: proposal, error } = await db
      .from("proposals")
      .insert({ quote_id: data.quoteId, model, prompt, content })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    await db.from("quotes").update({ status: "proposal_draft" }).eq("id", data.quoteId);
    await writeAudit({
      actorId: context.userId,
      actorLabel: String(context.claims['email'] ?? context.userId),
      action: "proposal.draft_generated",
      entity: "quote",
      entityId: data.quoteId,
      metadata: { model },
    });

    return { proposal: proposal as ProposalRecord };
  });

export const saveProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; content: string }) => data)
  .handler(async ({ data, context }) => {
    const { requireAdmin, adminDb, writeAudit } = await import("@/lib/blex.server");
    await requireAdmin(context.supabase, context.userId);

    const { error } = await adminDb()
      .from("proposals")
      .update({ content: data.content })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await writeAudit({
      actorId: context.userId,
      action: "proposal.edited",
      entity: "proposal",
      entityId: data.id,
    });
    return { ok: true };
  });

export const sendProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { requireAdmin, adminDb, writeAudit } = await import("@/lib/blex.server");
    await requireAdmin(context.supabase, context.userId);
    const db = adminDb();

    const { data: proposal, error } = await db
      .from("proposals")
      .update({ status: "sent", sent_at: new Date().toISOString(), reviewed_by: context.userId })
      .eq("id", data.id)
      .select("review_token, quote_id")
      .single();
    if (error || !proposal) throw new Error(error?.message ?? "Could not send");

    await db.from("quotes").update({ status: "proposal_sent" }).eq("id", proposal.quote_id);
    await writeAudit({
      actorId: context.userId,
      actorLabel: String(context.claims['email'] ?? context.userId),
      action: "proposal.sent",
      entity: "quote",
      entityId: proposal.quote_id as string,
    });

    // Email delivery needs a verified sending domain (Resend or similar).
    // Until that is connected, sending produces a shareable review link.
    return { reviewPath: `/proposal/${proposal.review_token as string}` };
  });

export const getAdminStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Record<string, never>) => data)
  .handler(async ({ context }) => {
    const client = context.supabase as unknown as {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }>;
    };
    const { data } = await client.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return { isAdmin: data === true, email: String(context.claims['email'] ?? "") };
  });
