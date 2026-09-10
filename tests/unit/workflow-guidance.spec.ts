import { expect, test } from "@playwright/test";

import { quoteStatuses } from "@/lib/quote-schema";
import {
  getNextStep,
  getStageGuidance,
  getTabEmptyState,
  getTabPurpose,
} from "@/lib/workflow-guidance";

test.describe("workflow guidance", () => {
  test("covers every quote status with a tab, actor and both messages", () => {
    for (const status of quoteStatuses) {
      const guidance = getStageGuidance(status);
      expect(guidance.tab).toBeTruthy();
      expect(["client", "admin", "none"]).toContain(guidance.actor);
      expect(guidance.clientMessage.length).toBeGreaterThan(10);
      expect(guidance.adminMessage.length).toBeGreaterThan(10);
    }
  });

  test("marks the owning audience as actionable", () => {
    expect(getNextStep("proposal_sent", "client").actionable).toBe(true);
    expect(getNextStep("proposal_sent", "admin").actionable).toBe(false);
    expect(getNextStep("approved", "admin")).toMatchObject({ tab: "estimate", actionable: true });
    expect(getNextStep("estimate_sent", "client").tab).toBe("estimate");
    expect(getNextStep("contract_sent", "client").tab).toBe("sow");
    expect(getNextStep("invoicing", "client").tab).toBe("invoices");
  });

  test("treats terminal statuses as nobody's action", () => {
    for (const status of ["completed", "declined"] as const) {
      expect(getNextStep(status, "client").actionable).toBe(false);
      expect(getNextStep(status, "admin").actionable).toBe(false);
      expect(getStageGuidance(status).actor).toBe("none");
    }
  });

  test("provides purpose and empty-state copy per tab", () => {
    for (const tab of ["proposal", "estimate", "sow", "invoices"]) {
      expect(getTabPurpose(tab, "client")).toBeTruthy();
      expect(getTabPurpose(tab, "admin")).toBeTruthy();
      expect(getTabEmptyState(tab, "client")).toBeTruthy();
      expect(getTabEmptyState(tab, "admin")).toBeTruthy();
    }
    expect(getTabPurpose("overview", "client")).toBeTruthy();
    expect(getTabPurpose("intake", "admin")).toBeTruthy();
    expect(getTabPurpose("nope", "client")).toBeNull();
  });
});

test.describe("completion guidance", () => {
  test("asks the team to request sign-off once the balance is zero", () => {
    const step = getNextStep("invoicing", "admin", { balanceCents: 0 });
    expect(step.actionable).toBe(true);
    expect(step.message).toContain("Paid in full");
  });

  test("tells the client there is nothing to pay before sign-off is requested", () => {
    const step = getNextStep("invoicing", "client", { balanceCents: 0 });
    expect(step.actionable).toBe(false);
    expect(step.message).toContain("paid in full");
  });

  test("hands the next step to the client once completion is requested", () => {
    const context = { balanceCents: 0, completionRequestedAt: "2026-01-01T00:00:00Z" };
    expect(getNextStep("invoicing", "client", context).actionable).toBe(true);
    expect(getNextStep("invoicing", "admin", context).message).toContain("Waiting on the client");
  });

  test("keeps the payment reminder while a balance is open", () => {
    const step = getNextStep("invoicing", "client", { balanceCents: 60000 });
    expect(step.message).toBe(getNextStep("invoicing", "client").message);
  });
});
