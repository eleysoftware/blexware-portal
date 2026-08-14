import { createFileRoute } from "@tanstack/react-router";

/**
 * Scheduled worker: biweekly invoice delivery, 5-day proposal expiry and
 * estimate expiry. Call with `Authorization: Bearer <CRON_SECRET>`.
 */
export const Route = createFileRoute("/api/public/cron/engagement")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["CRON_SECRET"];
        if (!secret) return new Response("Not configured", { status: 500 });

        const provided = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
        const a = new TextEncoder().encode(provided);
        const b = new TextEncoder().encode(secret);
        let mismatch = a.length === b.length ? 0 : 1;
        for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
          mismatch |= (a[index] ?? 0) ^ (b[index] ?? 0);
        }
        if (mismatch !== 0) return new Response("Unauthorized", { status: 401 });

        const { runScheduledWork } = await import("@/lib/invoicing.server");
        const result = await runScheduledWork();
        return Response.json(result);
      },
    },
  },
});
