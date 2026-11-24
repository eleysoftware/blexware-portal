const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_SECONDARY_EMAILS = 20;

/** Normalise collaborator addresses from a comma-separated field or a database array. */
export function normalizeSecondaryEmails(
  input: string | string[] | null | undefined,
  primaryEmail?: string | null,
): string[] {
  const values = Array.isArray(input)
    ? input
    : String(input ?? "")
        .split(/[\s,;]+/)
        .filter(Boolean);
  const primary = primaryEmail?.trim().toLowerCase() ?? "";
  const normalized = [...new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean))]
    .filter((value) => value !== primary);

  if (normalized.length > MAX_SECONDARY_EMAILS) {
    throw new Error(`Add no more than ${MAX_SECONDARY_EMAILS} secondary email addresses.`);
  }
  const invalid = normalized.find(
    (value) => value.length > 160 || !EMAIL_PATTERN.test(value),
  );
  if (invalid) throw new Error(`Enter a valid secondary email address: ${invalid}`);
  return normalized;
}

/** CC list for a project quote. Bad legacy values are ignored rather than blocking delivery. */
export function secondaryEmailCc(quote: {
  contact_email?: unknown;
  secondary_emails?: unknown;
}): string[] {
  try {
    return normalizeSecondaryEmails(
      Array.isArray(quote.secondary_emails)
        ? quote.secondary_emails.filter((value): value is string => typeof value === "string")
        : [],
      typeof quote.contact_email === "string" ? quote.contact_email : null,
    );
  } catch {
    return [];
  }
}

export function isPrimaryContact(
  viewerEmail: unknown,
  primaryEmail: unknown,
): boolean {
  const viewer = typeof viewerEmail === "string" ? viewerEmail.trim().toLowerCase() : "";
  const primary = typeof primaryEmail === "string" ? primaryEmail.trim().toLowerCase() : "";
  return Boolean(viewer && primary && viewer === primary);
}

export function primaryContactOnlyMessage(primaryEmail: string): string {
  return `Approvals, signatures and completion responses are reserved for the primary contact (${primaryEmail}). You can still view documents, share resources and help with UAT.`;
}
