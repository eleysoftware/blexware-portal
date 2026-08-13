// Server-only password hardening helpers: k-anonymity breach lookup against
// Have I Been Pwned plus a small in-memory rate limiter.

const HIBP_ENDPOINT = "https://api.pwnedpasswords.com/range/";

async function sha1Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-1", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

export type BreachResult = { breached: boolean; count: number };

/**
 * Only the first five characters of the SHA-1 hash ever leave this server.
 * The suffix comparison happens locally, so neither the plain-text password
 * nor the full hash is disclosed to the external API.
 */
export async function isPasswordBreached(password: string): Promise<BreachResult> {
  const hash = await sha1Hex(password);
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);

  const response = await fetch(`${HIBP_ENDPOINT}${prefix}`, {
    headers: {
      "Add-Padding": "true",
      "User-Agent": "BLEXware-signup-guard",
    },
  });

  if (!response.ok) {
    throw new Error("Password safety check is unavailable right now. Please try again.");
  }

  const body = await response.text();
  for (const line of body.split("\n")) {
    const [candidate, countRaw] = line.trim().split(":");
    if (!candidate || candidate !== suffix) continue;
    const count = Number.parseInt(countRaw ?? "0", 10);
    if (count > 0) return { breached: true, count };
  }
  return { breached: false, count: 0 };
}

// Best-effort per-worker throttle. Durable limits belong at the edge; this
// exists to blunt scripted abuse of the sign-up endpoint and the HIBP call.
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;

export function rateLimit(key: string): void {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  entry.count += 1;
  if (entry.count > MAX_ATTEMPTS) {
    throw new Error("Too many attempts. Please wait a few minutes and try again.");
  }
}

/** Stable, non-reversible label so audit rows never carry a raw address. */
export async function hashedEmailLabel(email: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(email.trim().toLowerCase()),
  );
  return Array.from(new Uint8Array(digest))
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
