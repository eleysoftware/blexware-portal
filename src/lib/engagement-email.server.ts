// Lightweight engagement email helpers. This module must never import document
// rendering/storage so response and payment actions cannot load the PDF stack.
import { SITE_URL } from "@/content/site";
import { formatMoney } from "@/lib/documents/types";
import { renderEmail, sendEmail } from "@/lib/email.server";

export const PROPOSAL_REVIEW_DAYS = 5;
export const PROPOSAL_REMINDER_DAYS = 3;

export function siteUrl(): string {
  return SITE_URL.replace(/\/$/, "");
}

export async function emailEstimateSent(input: { to: string; name: string; quoteNumber: string; url: string; totalCents: number }) {
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

export async function emailAgreementSent(input: { to: string; name: string; agreementNumber: string; url: string }) {
  const mail = renderEmail({
    heading: "Your Statement of Work is ready to sign",
    paragraphs: [
      `Hi ${input.name},`,
      `${input.agreementNumber} is ready for your signature. You can read the full agreement, download a PDF or Word copy, and sign electronically in your portal.`,
      "Once signed, your first invoice is issued and work begins after it's paid.",
    ],
    cta: { label: "Review and sign", url: input.url },
  });
  return sendEmail({ to: input.to, toName: input.name, subject: `Ready to sign — ${input.agreementNumber}`, ...mail });
}

export async function emailThankYouDeclined(input: { to: string; name: string; quoteNumber: string; note?: string | null }) {
  const mail = renderEmail({
    heading: "Thank you for working through this with us",
    paragraphs: [
      `Hi ${input.name},`,
      `Thanks for taking the time to review ${input.quoteNumber}. We've closed the request, and there's nothing further you need to do.`,
      input.note ? "Your feedback has been shared with the team — it genuinely helps us improve." : "If your plans change, we'd be glad to pick this back up whenever the timing is right.",
      "It was a pleasure getting to know your project.",
    ],
  });
  return sendEmail({ to: input.to, toName: input.name, subject: `Thank you — ${input.quoteNumber}`, ...mail });
}

export async function emailInvoice(input: { to: string; name: string; invoiceNumber: string; amountCents: number; dueDate: string | null; url: string; first: boolean }) {
  const mail = renderEmail({
    heading: `Invoice ${input.invoiceNumber} — ${formatMoney(input.amountCents)}`,
    paragraphs: [
      `Hi ${input.name},`,
      `${input.invoiceNumber} for ${formatMoney(input.amountCents)} is now available${input.dueDate ? `, due ${new Date(input.dueDate).toLocaleDateString()}` : ""}.`,
      input.first ? "Work begins as soon as this first payment is received." : "Thanks for keeping the project moving.",
    ],
    cta: { label: "Pay invoice online", url: input.url },
  });
  return sendEmail({ to: input.to, toName: input.name, subject: `Invoice ${input.invoiceNumber} — ${formatMoney(input.amountCents)}`, ...mail });
}

export async function emailReceipt(input: { to: string; name: string; invoiceNumber: string; amountCents: number }) {
  const mail = renderEmail({
    heading: "Payment received — thank you",
    paragraphs: [`Hi ${input.name},`, `We've received your ${formatMoney(input.amountCents)} payment for ${input.invoiceNumber}. This email is your receipt.`],
  });
  return sendEmail({ to: input.to, toName: input.name, subject: `Receipt — ${input.invoiceNumber}`, ...mail });
}

export async function emailPaymentUpdate(input: {
  to: string; name: string; invoiceNumber: string; amountCents: number;
  kind: "submitted" | "processing" | "failed" | "refunded" | "paid_in_full";
  balanceCents?: number; url?: string;
}) {
  const money = formatMoney(input.amountCents);
  const copy: Record<typeof input.kind, { subject: string; heading: string; body: string[] }> = {
    submitted: { subject: `Payment submitted — ${input.invoiceNumber}`, heading: "Your payment has been submitted", body: [`We've received your ${money} payment request for ${input.invoiceNumber} and will confirm once it settles.`] },
    processing: { subject: `Bank payment processing — ${input.invoiceNumber}`, heading: "Your bank payment is processing", body: [`Your bank account has been securely connected and your ${money} payment for ${input.invoiceNumber} has been submitted.`, "Bank payments may take additional time to process. We'll email you as soon as it's confirmed."] },
    failed: { subject: `Payment unsuccessful — ${input.invoiceNumber}`, heading: "We were unable to process your payment", body: [`The ${money} payment for ${input.invoiceNumber} did not go through. No money has left your account.`, "You can retry the payment at any time using the link below."] },
    refunded: { subject: `Refund issued — ${input.invoiceNumber}`, heading: "Your payment has been refunded", body: [`A refund of ${money} for ${input.invoiceNumber} has been issued and should appear within a few business days.`] },
    paid_in_full: { subject: `Invoice paid in full — ${input.invoiceNumber}`, heading: "This invoice is paid in full", body: [`Thank you — ${input.invoiceNumber} is now paid in full.`] },
  };
  const entry = copy[input.kind];
  const paragraphs = [`Hi ${input.name},`, ...entry.body];
  if (typeof input.balanceCents === "number" && input.balanceCents > 0) paragraphs.push(`Remaining balance on this invoice: ${formatMoney(input.balanceCents)}.`);
  const mail = renderEmail({ heading: entry.heading, paragraphs, ...(input.url ? { cta: { label: "View invoice", url: input.url } } : {}) });
  return sendEmail({ to: input.to, toName: input.name, subject: entry.subject, ...mail });
}

export async function notifyTeam(subject: string, paragraphs: string[], replyTo?: string) {
  const mail = renderEmail({ heading: subject, paragraphs });
  return sendEmail({ to: "hello@blexware.com", toName: "BLEXware", subject, ...mail, ...(replyTo ? { replyTo } : {}) });
}