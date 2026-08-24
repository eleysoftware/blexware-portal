import { describe, expect, it } from "vitest";

import { quoteStatuses } from "@/lib/quote-schema";
import {
  getNextStep,
  getStageGuidance,
  getTabEmptyState,
  getTabPurpose,
} from "@/lib/workflow-guidance";

describe("workflow guidance", () => {
  it("covers every quote status with a tab, actor and both messages", () => {
    for (const status of quoteStatuses) {
      const guidance = getStageGuidance(status);
      expect(guidance.tab).toBeTruthy();
      expect(["client", "admin", "none"]).toContain(guidance.actor);
      expect(guidance.clientMessage.length).toBeGreaterThan(10);
      expect(guidance.adminMessage.length).toBeGreaterThan(10);
    }
  });

  it("marks the owning audience as actionable", () => {
    expect(getNextStep("proposal_sent", "client").actionable).toBe(true);
    expect(getNextStep("proposal_sent", "admin").actionable).toBe(false);
    expect(getNextStep("approved", "admin")).toMatchObject({ tab: "estimate", actionable: true });
    expect(getNextStep("estimate_sent", "client").tab).toBe("estimate");
    expect(getNextStep("contract_sent", "client").tab).toBe("sow");
    expect(getNextStep("invoicing", "client").tab).toBe("invoices");
  });

  it("treats terminal statuses as nobody's action", () => {
    for (const status of ["completed", "declined"] as const) {
      expect(getNextStep(status, "client").actionable).toBe(false);
      expect(getNextStep(status, "admin").actionable).toBe(false);
      expect(getStageGuidance(status).actor).toBe("none");
    }
  });

  it("provides purpose and empty-state copy per tab", () => {
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
