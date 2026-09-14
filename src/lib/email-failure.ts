/**
 * Turns a raw provider refusal (as stored in `invoices.delivery_error`) into a
 * sentence a non-technical teammate can act on. Client-safe: no server imports.
 */

export type EmailFailure = {
  /** Short badge text. */
  headline: string;
  /** What to do about it. */
  action: string;
  /** True when the sending account is out of credits / over its allowance. */
  outOfCredits: boolean;
};

/** ZeptoMail signals an exhausted sending allowance with TM_5001. */
export function isOutOfCredits(reason: string | null | undefined): boolean {
  if (!reason) return false;
  const text = reason.toLowerCase();
  return (
    text.includes("tm_5001") ||
    text.includes("resource limit exhausted") ||
    text.includes("credits exhausted")
  );
}

export function describeEmailFailure(reason: string | null | undefined): EmailFailure {
  const raw = (reason ?? "").trim();
  const text = raw.toLowerCase();

  if (isOutOfCredits(raw)) {
    return {
      headline: "Not delivered — out of email credits",
      action: "Top up the sending credits in ZeptoMail, then press Retry.",
      outOfCredits: true,
    };
  }
  if (text.includes("sm_111") || text.includes("sm_101") || text.includes("domain is not verified")) {
    return {
      headline: "Not delivered — sender domain not verified",
      action: "Finish verifying blexware.com in ZeptoMail, then press Retry.",
      outOfCredits: false,
    };
  }
  if (text.includes("sm_113") || text.includes("invalid recipient") || text.includes("bounce")) {
    return {
      headline: "Not delivered — the client's address was rejected",
      action: "Check the client's email address on the project, then press Retry.",
      outOfCredits: false,
    };
  }
  if (text === "not_configured") {
    return {
      headline: "Not delivered — email is not set up",
      action: "The sending key is missing, so no mail can go out yet.",
      outOfCredits: false,
    };
  }
  if (text === "network_error") {
    return {
      headline: "Not delivered — could not reach the email service",
      action: "This is usually temporary. Press Retry in a moment.",
      outOfCredits: false,
    };
  }
  return {
    headline: "Not delivered",
    action: raw ? `The email service said: ${raw}` : "The email service refused the message.",
    outOfCredits: false,
  };
}
