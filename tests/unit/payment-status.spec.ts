import { expect, test } from "@playwright/test";

import { HyperswitchApiError } from "../../src/lib/payments/hyperswitch.server";
import {
  METHOD_UNAVAILABLE_MESSAGE,
  isMethodUnavailable,
  mapPaymentStatus,
} from "../../src/lib/payments/service.server";

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

test("detects an unavailable payment method family from the gateway error", () => {
  expect(isMethodUnavailable(new HyperswitchApiError(400, "IR_39", "No eligible connector was found"))).toBe(true);
  expect(
    isMethodUnavailable(new HyperswitchApiError(400, "OTHER", "no eligible connector for this method")),
  ).toBe(true);
  expect(isMethodUnavailable(new HyperswitchApiError(400, "IR_16", "Invalid amount"))).toBe(false);
  expect(isMethodUnavailable(new Error("network down"))).toBe(false);
});

test("names the alternative method in the unavailable message", () => {
  expect(METHOD_UNAVAILABLE_MESSAGE.bank).toContain("card");
  expect(METHOD_UNAVAILABLE_MESSAGE.card).toContain("bank");
});
