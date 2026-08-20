// Server-only helpers for the proposal → estimate → SOW → invoice pipeline.
import { SITE_URL } from "@/content/site";
import { adminDb } from "@/lib/blex.server";
import { renderDocx, renderPdf } from "@/lib/documents/render.server";
import type { ProjectDocument } from "@/lib/documents/types";
import { formatMoney } from "@/lib/documents/types";
import { renderEmail, sendEmail } from "@/lib/email.server";

export const DOCUMENT_BUCKET = documentsBucket();
export const PROPOSAL_REVIEW_DAYS = 5;
export const PROPOSAL_REMINDER_DAYS = 3;

export function siteUrl(): string {
  return SITE_URL.replace(/\/$/, "");
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type StoredDocument = { format: "pdf" | "docx"; path: string; sha256: string; size: number };

/** Renders PDF + DOCX, stores both privately and records them. */
export async function storeDocument(input: {
  quoteId: string;
  entity: "proposal" | "estimate" | "agreement";
  entityId: string;
  kind: string;
  doc: ProjectDocument;
  slug: string;
}): Promise<StoredDocument[]> {
  const db = adminDb();
  const [pdf, docx] = await Promise.all([renderPdf(input.doc), renderDocx(input.doc)]);
  const stamp = Date.now();

  const files: { format: "pdf" | "docx"; bytes: Uint8Array; mime: string }[] = [
    { format: "pdf", bytes: pdf, mime: "application/pdf" },
    {
      format: "docx",
      bytes: docx,
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    },
  ];

  const stored: StoredDocument[] = [];
  for (const file of files) {
    const path = `${input.quoteId}/${input.entity}/${input.entityId}-${stamp}.${file.format}`;
    const upload = await db.storage
      .from(DOCUMENT_BUCKET)
      .upload(path, file.bytes, { contentType: file.mime, upsert: true });
    if (upload.error) {
      console.error("[documents:upload]", upload.error.message);
      continue;
    }
    const hash = await sha256Hex(file.bytes);
    await db.from("documents").insert({
      quote_id: input.quoteId,
      entity: input.entity,
      entity_id: input.entityId,
      kind: input.kind,
      format: file.format,
      storage_path: path,
      byte_size: file.bytes.byteLength,
      sha256: hash,
    });
    stored.push({ format: file.format, path, sha256: hash, size: file.bytes.byteLength });
  }
  return stored;
}

export async function signedDocumentUrl(path: string, seconds = 120): Promise<string> {
  const { data, error } = await adminDb()
    .storage.from(DOCUMENT_BUCKET)
    .createSignedUrl(path, seconds);
  if (error || !data) throw new Error("Could not prepare that download");
  return data.signedUrl;
}

/* ------------------------------------------------------------- emails */

export async function emailProposalSent(input: {
  to: string;
  name: string;
  quoteNumber: string;
  url: string;
  expiresAt: string;
}) {
  const mail = renderEmail({
    heading: "Your BLEXware proposal is ready",
    paragraphs: [
      `Hi ${input.name},`,
      `Your proposal for ${input.quoteNumber} is ready to review. You can approve it, request changes, or decline — all from your client portal.`,
      `Please respond by ${new Date(input.expiresAt).toLocaleDateString()}. If we don't hear back by then the proposal closes automatically and we'll follow up.`,
    ],
    cta: { label: "Review your proposal", url: input.url },
  });
  return sendEmail({ to: input.to, toName: input.name, subject: `Your proposal — ${input.quoteNumber}`, ...mail });
}

export async function emailEstimateSent(input: {
  to: string;
  name: string;
  quoteNumber: string;
  url: string;
  totalCents: number;
}) {
  const mail = renderEmail({
    heading: "Your cost and schedule estimate",
    paragraphs: [
      `Hi ${input.name},`,
      `We've added cost and schedule detail to your approved proposal for ${input.quoteNumber}. The total project investment is ${formatMoney(input.totalCents)}.`,
      "Approving the estimate moves you to the Statement of Work agreement for signature.",
    ],
    cta: { label: "Review the estimate", url: input.url },
  });
  return sendEmail({ to: input.to, toName: input.name, subject: `Your estimate — ${input.quoteNumber}`, ...mail });
}

export async function emailAgreementSent(input: {
  to: string;
  name: string;
  agreementNumber: string;
  url: string;
}) {
  const mail = renderEmail({
    heading: "Your Statement of Work is ready to sign",
    paragraphs: [
      `Hi ${input.name},`,
      `${input.agreementNumber} is ready for your signature. You can read the full agreement, download a PDF or Word copy, and sign electronically in your portal.`,
      "Once signed, your first invoice is issued and work begins after it's paid.",
    ],
    cta: { label: "Review and sign", url: input.url },
  });
  return sendEmail({
    to: input.to,
    toName: input.name,
    subject: `Ready to sign — ${input.agreementNumber}`,
    ...mail,
  });
}

export async function emailThankYouDeclined(input: {
  to: string;
  name: string;
  quoteNumber: string;
  note?: string | null;
}) {
  const mail = renderEmail({
    heading: "Thank you for working through this with us",
    paragraphs: [
      `Hi ${input.name},`,
      `Thanks for taking the time to review ${input.quoteNumber}. We've closed the request, and there's nothing further you need to do.`,
      input.note
        ? "Your feedback has been shared with the team — it genuinely helps us improve."
        : "If your plans change, we'd be glad to pick this back up whenever the timing is right.",
      "It was a pleasure getting to know your project.",
    ],
  });
  return sendEmail({
    to: input.to,
    toName: input.name,
    subject: `Thank you — ${input.quoteNumber}`,
    ...mail,
  });
}

export async function emailInvoice(input: {
  to: string;
  name: string;
  invoiceNumber: string;
  amountCents: number;
  dueDate: string | null;
  url: string;
  first: boolean;
}) {
  const mail = renderEmail({
    heading: `Invoice ${input.invoiceNumber} — ${formatMoney(input.amountCents)}`,
    paragraphs: [
      `Hi ${input.name},`,
      `${input.invoiceNumber} for ${formatMoney(input.amountCents)} is now available${input.dueDate ? `, due ${new Date(input.dueDate).toLocaleDateString()}` : ""}.`,
      input.first
        ? "Work begins as soon as this first payment is received."
        : "Thanks for keeping the project moving.",
    ],
    cta: { label: "Pay invoice online", url: input.url },
  });
  return sendEmail({
    to: input.to,
    toName: input.name,
    subject: `Invoice ${input.invoiceNumber} — ${formatMoney(input.amountCents)}`,
    ...mail,
  });
}

export async function emailReceipt(input: {
  to: string;
  name: string;
  invoiceNumber: string;
  amountCents: number;
}) {
  const mail = renderEmail({
    heading: "Payment received — thank you",
    paragraphs: [
      `Hi ${input.name},`,
      `We've received your ${formatMoney(input.amountCents)} payment for ${input.invoiceNumber}. This email is your receipt.`,
    ],
  });
  return sendEmail({
    to: input.to,
    toName: input.name,
    subject: `Receipt — ${input.invoiceNumber}`,
    ...mail,
  });
}

/** Payment lifecycle notifications (submitted / processing / failed / refunded / paid in full). */
export async function emailPaymentUpdate(input: {
  to: string;
  name: string;
  invoiceNumber: string;
  amountCents: number;
  kind: "submitted" | "processing" | "failed" | "refunded" | "paid_in_full";
  balanceCents?: number;
  url?: string;
}) {
  const money = formatMoney(input.amountCents);
  const copy: Record<typeof input.kind, { subject: string; heading: string; body: string[] }> = {
    submitted: {
      subject: `Payment submitted — ${input.invoiceNumber}`,
      heading: "Your payment has been submitted",
      body: [`We've received your ${money} payment request for ${input.invoiceNumber} and will confirm once it settles.`],
    },
    processing: {
      subject: `Bank payment processing — ${input.invoiceNumber}`,
      heading: "Your bank payment is processing",
      body: [
        `Your bank account has been securely connected and your ${money} payment for ${input.invoiceNumber} has been submitted.`,
        "Bank payments may take additional time to process. We'll email you as soon as it's confirmed.",
      ],
    },
    failed: {
      subject: `Payment unsuccessful — ${input.invoiceNumber}`,
      heading: "We were unable to process your payment",
      body: [
        `The ${money} payment for ${input.invoiceNumber} did not go through. No money has left your account.`,
        "You can retry the payment at any time using the link below.",
      ],
    },
    refunded: {
      subject: `Refund issued — ${input.invoiceNumber}`,
      heading: "Your payment has been refunded",
      body: [`A refund of ${money} for ${input.invoiceNumber} has been issued and should appear within a few business days.`],
    },
    paid_in_full: {
      subject: `Invoice paid in full — ${input.invoiceNumber}`,
      heading: "This invoice is paid in full",
      body: [`Thank you — ${input.invoiceNumber} is now paid in full.`],
    },
  };

  const entry = copy[input.kind];
  const paragraphs = [`Hi ${input.name},`, ...entry.body];
  if (typeof input.balanceCents === "number" && input.balanceCents > 0) {
    paragraphs.push(`Remaining balance on this invoice: ${formatMoney(input.balanceCents)}.`);
  }

  const mail = renderEmail({
    heading: entry.heading,
    paragraphs,
    ...(input.url ? { cta: { label: "View invoice", url: input.url } } : {}),
  });
  return sendEmail({ to: input.to, toName: input.name, subject: entry.subject, ...mail });
}

export async function notifyTeam(subject: string, paragraphs: string[], replyTo?: string) {
  const mail = renderEmail({ heading: subject, paragraphs });
  return sendEmail({
    to: "hello@blexware.com",
    toName: "BLEXware",
    subject,
    ...mail,
    ...(replyTo ? { replyTo } : {}),
  });
}
