import { createServerFn } from "@tanstack/react-start";

import { MAX_FILES, MAX_FILE_BYTES, quoteSchema } from "@/lib/quote-schema";

export const submitQuote = createServerFn({ method: "POST" })
  .validator((data: FormData) => {
    if (!(data instanceof FormData)) throw new Error("Invalid submission");
    return data;
  })
  .handler(async ({ data }) => {
    const raw = data.get("payload");
    if (typeof raw !== "string") throw new Error("Invalid submission");

    const parsed = quoteSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid submission");
    }
    const input = parsed.data;

    const files = data
      .getAll("files")
      .filter((entry): entry is File => entry instanceof File);

    if (files.length > MAX_FILES) {
      throw new Error(`Attach at most ${MAX_FILES} PDF files.`);
    }

    const { adminDb, QUOTE_BUCKET, validatePdf, scanForMalware, writeAudit } =
      await import("@/lib/blex.server");
    const db = adminDb();

    // Basic abuse guard: cap submissions per email per hour.
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await db
      .from("quotes")
      .select("id", { count: "exact", head: true })
      .eq("contact_email", input.email)
      .gte("created_at", since);
    if ((count ?? 0) >= 5) {
      throw new Error(
        "We already have several recent requests from this email. Please email hello@blexware.com instead.",
      );
    }

    // Validate every attachment before anything is written.
    const prepared: { name: string; type: string; bytes: Uint8Array }[] = [];
    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) {
        throw new Error(`${file.name} is larger than 20 MB.`);
      }
      if (!file.name.toLowerCase().endsWith(".pdf") || file.type !== "application/pdf") {
        throw new Error(`${file.name} must be a PDF.`);
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      const problem = validatePdf(bytes, file.name);
      if (problem) throw new Error(problem);
      await scanForMalware(bytes);
      prepared.push({ name: file.name, type: file.type, bytes });
    }

    const { data: quote, error } = await db
      .from("quotes")
      .insert({
        project_type: input.projectType,
        industry: input.industry,
        services: input.services,
        goals: input.goals,
        features: input.features ?? null,
        budget: input.budget,
        timeline: input.timeline,
        contact_name: input.name,
        contact_email: input.email,
        company: input.company ?? null,
        phone: input.phone ?? null,
        consent: input.consent,
      })
      .select("id, quote_number")
      .single();

    if (error || !quote) {
      console.error("[submitQuote]", error?.message);
      throw new Error("We could not save your request. Please try again.");
    }

    for (const file of prepared) {
      const path = `quotes/${quote.id}/${crypto.randomUUID()}.pdf`;
      const upload = await db.storage
        .from(QUOTE_BUCKET)
        .upload(path, file.bytes, { contentType: file.type, upsert: false });
      if (upload.error) {
        console.error("[submitQuote:upload]", upload.error.message);
        continue;
      }
      await db.from("quote_files").insert({
        quote_id: quote.id,
        storage_path: path,
        original_name: file.name,
        byte_size: file.bytes.byteLength,
        mime_type: file.type,
      });
    }

    await writeAudit({
      actorLabel: input.email,
      action: "quote.submitted",
      entity: "quote",
      entityId: quote.id,
      metadata: { files: prepared.length, quote_number: quote.quote_number },
    });

    // Confirmation to the prospect + internal notification. Neither can block
    // the submission itself, so failures are logged inside the helper only.
    const { sendEmail, renderEmail } = await import("@/lib/email.server");
    const confirmation = renderEmail({
      heading: "We received your request",
      paragraphs: [
        `Hi ${input.name},`,
        `Thanks for reaching out to BLEXware. Your request is logged as ${String(quote.quote_number)} and a member of our team is reviewing it now.`,
        "We'll follow up within one business day with questions or a proposal. Just reply to this email if anything changes in the meantime.",
      ],
      footnote: `Reference: ${String(quote.quote_number)}`,
    });
    await sendEmail({
      to: input.email,
      toName: input.name,
      subject: `We received your request — ${String(quote.quote_number)}`,
      html: confirmation.html,
      text: confirmation.text,
    });

    const internal = renderEmail({
      heading: `New quote request — ${String(quote.quote_number)}`,
      paragraphs: [
        `${input.name} (${input.email}) submitted a ${input.projectType} request.`,
        `Industry: ${input.industry}. Budget: ${input.budget}. Timeline: ${input.timeline}.`,
        `Attachments: ${prepared.length}.`,
      ],
    });
    await sendEmail({
      to: "hello@blexware.com",
      toName: "BLEXware",
      subject: `New quote request — ${String(quote.quote_number)}`,
      html: internal.html,
      text: internal.text,
      replyTo: input.email,
    });

    return { quoteNumber: quote.quote_number as string };
  });
