import { expect, test } from "@playwright/test";

import { pickTestOnlyClients, type QuoteOwnerRow } from "@/lib/test-data";

const rows: QuoteOwnerRow[] = [
  { contact_email: "Test@example.com", contact_name: "Test Client", is_test: true },
  { contact_email: "test@example.com", contact_name: "Test Client", is_test: true },
  { contact_email: "mixed@example.com", contact_name: "Mixed", is_test: true },
  { contact_email: "mixed@example.com", contact_name: "Mixed", is_test: false },
  { contact_email: "staff@blexware.com", contact_name: "Staff", is_test: true },
];

const users = new Map([
  ["test@example.com", "user-test"],
  ["mixed@example.com", "user-mixed"],
  ["staff@blexware.com", "user-staff"],
]);

test("keeps only emails whose projects are all test projects", () => {
  const result = pickTestOnlyClients(rows, new Set(["user-staff"]), users);
  expect(result.map((entry) => entry.email)).toEqual(["test@example.com"]);
  expect(result[0]?.projectCount).toBe(2);
});

test("never lists an account that holds a staff role", () => {
  const result = pickTestOnlyClients(rows, new Set(["user-staff", "user-test"]), users);
  expect(result).toEqual([]);
});

test("reports clients with no sign-in account without a user id", () => {
  const result = pickTestOnlyClients(rows, new Set(["user-staff"]), new Map());
  expect(result[0]?.userId).toBeNull();
});
