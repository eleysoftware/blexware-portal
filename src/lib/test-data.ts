/** Helpers for the test-data region (projects marked is_test). */

export type QuoteOwnerRow = {
  contact_email: string;
  contact_name: string | null;
  is_test: boolean | null;
};

export type TestClient = {
  email: string;
  name: string;
  userId: string | null;
  projectCount: number;
};

/** Emails whose projects are all test projects, excluding anyone with a staff role. */
export function pickTestOnlyClients(
  rows: QuoteOwnerRow[],
  roleHolders: Set<string>,
  usersByEmail: Map<string, string>,
): TestClient[] {
  const byEmail = new Map<string, { name: string; test: number; real: number }>();
  for (const row of rows) {
    const email = String(row.contact_email ?? "").trim().toLowerCase();
    if (!email) continue;
    const entry = byEmail.get(email) ?? { name: row.contact_name ?? email, test: 0, real: 0 };
    if (row.is_test) entry.test += 1;
    else entry.real += 1;
    byEmail.set(email, entry);
  }

  const candidates: TestClient[] = [];
  for (const [email, entry] of byEmail) {
    if (entry.real > 0 || entry.test === 0) continue;
    const userId = usersByEmail.get(email) ?? null;
    if (userId && roleHolders.has(userId)) continue;
    candidates.push({ email, name: entry.name, userId, projectCount: entry.test });
  }
  return candidates.sort((a, b) => a.email.localeCompare(b.email));
}
