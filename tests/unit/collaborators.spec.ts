import { expect, test } from "@playwright/test";

import {
  isPrimaryContact,
  normalizeSecondaryEmails,
  secondaryEmailCc,
} from "@/lib/collaborators";
import { clientMayMove } from "@/lib/milestones.functions";

test("secondary emails are normalised and deduplicated case-insensitively", () => {
  expect(
    normalizeSecondaryEmails("Second@Example.com, second@example.com; third@example.com"),
  ).toEqual(["second@example.com", "third@example.com"]);
});

test("the primary contact is never duplicated as a secondary collaborator", () => {
  expect(
    normalizeSecondaryEmails(
      ["primary@example.com", "collaborator@example.com"],
      "Primary@Example.com",
    ),
  ).toEqual(["collaborator@example.com"]);
});

test("invalid collaborator addresses are rejected", () => {
  expect(() => normalizeSecondaryEmails("valid@example.com, not-an-email")).toThrow(
    "Enter a valid secondary email address: not-an-email",
  );
});

test("only the primary email has approval authority", () => {
  expect(isPrimaryContact("Primary@Example.com", "primary@example.com")).toBe(true);
  expect(isPrimaryContact("collaborator@example.com", "primary@example.com")).toBe(false);
});

test("CC delivery excludes the primary recipient and preserves collaborators", () => {
  expect(
    secondaryEmailCc({
      contact_email: "primary@example.com",
      secondary_emails: ["PRIMARY@example.com", "collaborator@example.com"],
    }),
  ).toEqual(["collaborator@example.com"]);
});

test("clients can move UAT items to Done or In progress only", () => {
  expect(clientMayMove("uat", "done")).toBe(true);
  expect(clientMayMove("uat", "in_progress")).toBe(true);
  expect(clientMayMove("testing", "done")).toBe(false);
  expect(clientMayMove("uat", "testing")).toBe(false);
});
