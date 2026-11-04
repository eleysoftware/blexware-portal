// Pure wording helpers for subscription bills (no server imports) so the
// client-facing copy can be unit-tested.
import { formatMoney } from "@/lib/documents/types";

/** Subscription bills share the invoice sequence but carry a SUB- prefix. */
export function toSubscriptionNumber(invoiceNumber: string): string {
  return invoiceNumber.replace(/^INV-/, "SUB-");
}

/** Formats a YYYY-MM-DD (or ISO) date as M/D/YYYY without timezone drift. */
export function formatBillDate(date: string): string {
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T12:00:00Z` : date;
  return new Date(iso).toLocaleDateString("en-US", { timeZone: "UTC" });
}

export type SubscriptionBillContext = { serviceName: string; renewal: boolean };

export function subscriptionInvoiceEmailCopy(input: {
  name: string;
  invoiceNumber: string;
  amountCents: number;
  dueDate: string | null;
  subscription: SubscriptionBillContext;
}) {
  const service = input.subscription.serviceName;
  const due = input.dueDate ? `, due ${formatBillDate(input.dueDate)}` : "";
  return {
    subject: `BLEXware ${service} Subscription — ${input.invoiceNumber}`,
    heading: `BLEXware ${service} Subscription`,
    paragraphs: [
      `Hi ${input.name},`,
      `${input.invoiceNumber} for ${formatMoney(input.amountCents)} is now available${due}.`,
      input.subscription.renewal
        ? `Please submit payment to renew your ${service} subscription for another year.`
        : `Please submit payment for your ${service} subscription.`,
    ],
    ctaLabel: "Pay subscription online",
  };
}

export function subscriptionReminderEmailCopy(input: {
  name: string;
  invoiceNumber: string;
  balanceCents: number;
  dueDate: string;
  serviceName: string;
}) {
  return {
    subject: `Payment reminder — ${input.serviceName} subscription ${input.invoiceNumber}`,
    heading: `Payment reminder — ${input.serviceName} subscription`,
    paragraphs: [
      `Hi ${input.name},`,
      `Your ${input.serviceName} subscription (${input.invoiceNumber}) has an outstanding balance of ${formatMoney(input.balanceCents)} and was due ${formatBillDate(input.dueDate)}.`,
      "Please submit payment to keep your service active. If you've already paid, thank you and please disregard this reminder.",
    ],
    ctaLabel: "View and pay subscription",
  };
}

export function subscriptionReminderSms(input: {
  invoiceNumber: string;
  balanceCents: number;
  serviceName: string;
  url: string;
}): string {
  return `BLEXware: your ${input.serviceName} subscription ${input.invoiceNumber} has ${formatMoney(input.balanceCents)} outstanding. Pay: ${input.url} Reply STOP to opt out.`;
}
