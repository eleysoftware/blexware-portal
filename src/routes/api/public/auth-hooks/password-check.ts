import { createFileRoute } from "@tanstack/react-router";

/**
 * Supabase Auth HTTP hook endpoint.
 *
 * Wire this up under Authentication → Hooks for both "Before User Created" and
 * "Password Verification Attempt". It runs the same Have I Been Pwned
 * k-anonymity screening the in-app sign-up uses, so passwords chosen through
 * Supabase's own flows (dashboard invites, password resets) are covered too.
 *
 * Requests are authenticated with the standard Webhooks-style signature header
 * Supabase sends; the shared secret lives in AUTH_HOOK_SECRET.
 */

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacBase64(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

function rejection(message: string) {
  return Response.json(
    { error: { http_code: 400, message } },
    { status: 200, headers: { "cache-control": "no-store" } },
  );
}

export const Route = createFileRoute("/api/public/auth-hooks/password-check")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authHookSecret } = await import("@/config/environment");
        const secret = (authHookSecret() ?? "").replace(/^v1,?whsec_/, "");
        if (!secret) return new Response("Hook not configured", { status: 503 });

        const body = await request.text();
        const id = request.headers.get("webhook-id") ?? "";
        const timestamp = request.headers.get("webhook-timestamp") ?? "";
        const header = request.headers.get("webhook-signature") ?? "";

        // Reject replays older than five minutes.
        const age = Math.abs(Date.now() / 1000 - Number(timestamp));
        if (!timestamp || Number.isNaN(age) || age > 300) {
          return new Response("Invalid timestamp", { status: 401 });
        }

        let expected: string;
        try {
          const keyBytes = atob(secret);
          expected = await hmacBase64(keyBytes, `${id}.${timestamp}.${body}`);
        } catch {
          expected = await hmacBase64(secret, `${id}.${timestamp}.${body}`);
        }

        const provided = header
          .split(" ")
          .map((part) => part.split(",").pop() ?? "")
          .filter(Boolean);
        if (!provided.some((candidate) => timingSafeEqual(candidate, expected))) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: { password?: string; user?: { password?: string } };
        try {
          payload = JSON.parse(body);
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        const password = payload.password ?? payload.user?.password;
        // Flows without a plain-text password (OAuth, magic link) simply pass.
        if (!password) return Response.json({}, { status: 200 });

        const { isPasswordBreached } = await import("@/lib/auth.server");
        try {
          const { breached } = await isPasswordBreached(password);
          if (breached) {
            return rejection(
              "This password has been found in a known data breach. Please choose a safer password.",
            );
          }
        } catch {
          // Fail closed: a password we could not screen is not accepted.
          return rejection("Password safety check is unavailable right now. Please try again.");
        }

        return Response.json({}, { status: 200 });
      },
    },
  },
});
