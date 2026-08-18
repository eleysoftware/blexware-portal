import { expect, test } from "@playwright/test";

import { mapPaymentStatus } from "../../src/lib/payments/service.server";

test("maps captured statuses to succeeded", () => {
  expect(mapPaymentStatus("succeeded")).toBe("succeeded");
  expect(mapPaymentStatus("partially_captured")).toBe("succeeded");
});

test("maps customer-action statuses to action_required", () => {
  expect(mapPaymentStatus("requires_customer_action")).toBe("action_required");
  expect(mapPaymentStatus("requires_payment_method")).toBe("action_required");
});

test("maps processing and unknown values", () => {
  expect(mapPaymentStatus("processing")).toBe("processing");
  expect(mapPaymentStatus("requires_capture")).toBe("processing");
  expect(mapPaymentStatus("mystery")).toBe("processing");
});

test("maps failed and cancelled", () => {
  expect(mapPaymentStatus("failed")).toBe("failed");
  expect(mapPaymentStatus("cancelled")).toBe("cancelled");
});
