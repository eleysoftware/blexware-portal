import { expect, test } from "@playwright/test";

import { expectToast, signInAs } from "../helpers/auth";
import {
  cleanupByEmail,
  createConfirmedClient,
  insertDraftProposal,
  insertQuote,
  newRunId,
  playwrightEmail,
  testDb,
} from "../helpers/db";
import { TEST_CLIENT_PASSWORD } from "../helpers/env";

test("secondary collaborators can view and run UAT while only the primary contact approves", async ({
  browser,
}) => {
  const runId = newRunId();
  const primaryEmail = playwrightEmail(runId, "primary");
  const secondaryEmail = playwrightEmail(runId, "collaborator");
  const secondaryContext = await browser.newContext();
  const primaryContext = await browser.newContext();
  const secondary = await secondaryContext.newPage();
  const primary = await primaryContext.newPage();

  try {
    await createConfirmedClient(primaryEmail, TEST_CLIENT_PASSWORD);
    await createConfirmedClient(secondaryEmail, TEST_CLIENT_PASSWORD);
    const quote = await insertQuote(primaryEmail, {
      status: "proposal_sent",
      secondary_emails: [secondaryEmail],
    });
    const proposal = await insertDraftProposal(
      quote.id,
      "# Executive Summary\n\nCollaborator access end-to-end test.",
    );
    await testDb()
      .from("proposals")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", proposal.id);
    await testDb().from("project_milestones").insert({
      quote_id: quote.id,
      title: "Client acceptance",
      note: "Initial UAT note",
      lane: "uat",
      position: 0,
    });

    await signInAs(secondary, {
      email: secondaryEmail,
      password: TEST_CLIENT_PASSWORD,
      dest: "/portal",
    });
    await secondary.goto(`/portal/quotes/${quote.id}`);
    await expect(secondary.getByText(/Approvals, signatures and completion responses are reserved/)).toBeVisible({
      timeout: 20_000,
    });
    await expect(secondary.getByTestId("proposal-approve")).toHaveCount(0);

    await secondary.goto(`/proposal/${proposal.review_token}`);
    await expect(secondary.getByRole("heading", { name: "Primary contact response required" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(secondary.getByRole("button", { name: "Approve proposal" })).toHaveCount(0);

    await secondary.goto(`/portal/quotes/${quote.id}`);
    await secondary.getByRole("tab", { name: "Milestones" }).click();
    await secondary.getByRole("button", { name: "Edit details for Client acceptance" }).click();
    await secondary.getByRole("textbox", { name: "Details", exact: true }).fill("Collaborator verified this phase");
    await secondary.getByRole("button", { name: "Save changes" }).click();
    await expect(secondary.getByText("Collaborator verified this phase")).toBeVisible();
    await secondary.getByRole("button", { name: "Mark done" }).click();
    await expect(secondary.getByRole("button", { name: "Mark done" })).toHaveCount(0);

    const { data: milestone } = await testDb()
      .from("project_milestones")
      .select("lane, note")
      .eq("quote_id", quote.id)
      .single();
    expect(milestone).toMatchObject({
      lane: "done",
      note: "Collaborator verified this phase",
    });

    await signInAs(primary, {
      email: primaryEmail,
      password: TEST_CLIENT_PASSWORD,
      dest: "/portal",
    });
    await primary.goto(`/proposal/${proposal.review_token}`);
    const primaryApprove = primary.getByRole("button", { name: "Approve proposal" });
    await expect(primaryApprove).toBeVisible({ timeout: 20_000 });
    await primaryApprove.click();
    await expectToast(primary, /your response was sent/i);
    await primary.goto(`/portal/quotes/${quote.id}`);
    await expect(primary.getByTestId("proposal-approve")).toHaveCount(0, { timeout: 20_000 });
  } finally {
    await secondaryContext.close();
    await primaryContext.close();
    await cleanupByEmail(primaryEmail);
    await cleanupByEmail(secondaryEmail);
  }
});
