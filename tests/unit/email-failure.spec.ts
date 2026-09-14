import { expect, test } from "@playwright/test";

import { describeEmailFailure, isOutOfCredits } from "@/lib/email-failure";

test("TM_5001 is reported as an out-of-credits problem", () => {
  const failure = describeEmailFailure("TM_5001: Resource Limit Exhausted");
  expect(failure.outOfCredits).toBe(true);
  expect(failure.headline).toContain("out of email credits");
  expect(failure.action).toContain("ZeptoMail");
  expect(isOutOfCredits("TM_5001: Resource Limit Exhausted")).toBe(true);
});

test("other provider refusals keep their own guidance", () => {
  expect(describeEmailFailure("SM_111: Sender domain is not verified").headline).toContain(
    "sender domain",
  );
  expect(describeEmailFailure("SM_113: Invalid recipient").headline).toContain("address");
  expect(describeEmailFailure("not_configured").outOfCredits).toBe(false);
  expect(describeEmailFailure(null).headline).toBe("Not delivered");
  expect(isOutOfCredits("SM_113: Invalid recipient")).toBe(false);
});
