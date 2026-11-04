import { expect, test } from "@playwright/test";

import { addYears, coerceSubscriptionSettings, noticeDateFor } from "../../src/lib/subscription-dates";

test("hosting defaults to $120 per year with a 14-day notice", () => {
  const s = coerceSubscriptionSettings(null);
  expect(s.amountCents).toBe(12000);
  expect(s.noticeDays).toBe(14);
});

test("renewal is one year after start", () => {
  expect(addYears("2026-11-04", 1)).toBe("2027-11-04");
  expect(addYears("2028-02-29", 1)).toBe("2029-02-28");
});

test("advance notice goes out two weeks before renewal", () => {
  expect(noticeDateFor("2027-11-04", 14)).toBe("2027-10-21");
});

import {
  subscriptionInvoiceEmailCopy,
  subscriptionReminderSms,
  toSubscriptionNumber,
} from "../../src/lib/subscription-copy";

test("subscription bills use the SUB- prefix with the same number", () => {
  expect(toSubscriptionNumber("INV-2026-0064")).toBe("SUB-2026-0064");
  expect(toSubscriptionNumber("SUB-2026-0064")).toBe("SUB-2026-0064");
});

test("first hosting bill email asks for subscription payment, not project work", () => {
  const copy = subscriptionInvoiceEmailCopy({
    name: "Kam Eley",
    invoiceNumber: "SUB-2026-0064",
    amountCents: 12000,
    dueDate: "2026-11-11",
    subscription: { serviceName: "Web Hosting", renewal: false },
  });
  expect(copy.heading).toBe("BLEXware Web Hosting Subscription");
  expect(copy.paragraphs).toEqual([
    "Hi Kam Eley,",
    "SUB-2026-0064 for $120 is now available, due 11/11/2026.",
    "Please submit payment for your Web Hosting subscription.",
  ]);
});

test("hosting reminder text names the subscription", () => {
  expect(
    subscriptionReminderSms({ invoiceNumber: "SUB-2026-0064", balanceCents: 12000, serviceName: "Web Hosting", url: "https://blexware.com/invoice/x" }),
  ).toContain("your Web Hosting subscription SUB-2026-0064 has $120 outstanding");
});
