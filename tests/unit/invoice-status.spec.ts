import { expect, test } from "@playwright/test";

import { allowedInvoiceTransitions, canSetInvoiceStatus } from "@/lib/invoice-status";

test("a scheduled invoice can be opened for payment", () => {
  expect(canSetInvoiceStatus("scheduled", "sent")).toBe(true);
  expect(canSetInvoiceStatus("draft", "sent")).toBe(true);
});

test("paid invoices cannot be changed and paid cannot be set by hand", () => {
  expect(allowedInvoiceTransitions("paid")).toEqual([]);
  expect(canSetInvoiceStatus("sent", "paid")).toBe(false);
  expect(canSetInvoiceStatus("partially_paid", "sent")).toBe(false);
});
