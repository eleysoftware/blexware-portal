# Make "Regenerate" work in local development

## What's happening

The Regenerate button calls a server function that asks the config layer for the AI key
(`AI_API_KEY`, falling back to `LOVABLE_API_KEY`). Inside Lovable, `LOVABLE_API_KEY` is
injected automatically. When you run `bun dev` on your machine, nothing injects it, so the
config layer throws "Missing environment variable(s): AI_API_KEY…" and the button fails.

This is configuration, not a bug in the generation code — but the app should also fail more
gracefully and tell you exactly what to do.

## What to change

1. **Local key support (the actual fix)**
   - Keep `AI_API_KEY` as the portable name (already in `.env.example`).
   - Add a short "AI generation locally" section to `README.md`: put `AI_API_KEY=<key>` in
     `.env.local`. The Lovable-managed gateway key is never revealed for copying, so local
     runs use a key you control — either a Lovable AI Gateway key from your account, or any
     OpenAI-compatible key together with `AI_API_URL` and `AI_MODEL` (both already supported
     by `src/config/ai.ts`, no code change needed).

2. **Graceful UI instead of a raw thrown error**
   - Expose the existing `isAiConfigured()` through a small server function so the admin
     quote page knows whether AI is available.
   - On `/admin/quotes/$id`, when AI isn't configured: disable Generate/Regenerate and show
     an inline note — "AI drafting is unavailable in this environment. Set AI_API_KEY in
     .env.local (see README)." Same treatment for the engagement panel's AI actions.
   - Everything else on the page (save, send, documents, invoices) keeps working.

3. **Clearer error text**
   - Update the AI accessor's hint so the thrown message names the file to edit:
     "Set AI_API_KEY in .env.local (see .env.example) or in your host's secret manager."
   - Map gateway failures (401/402/403/429) to readable toasts rather than a generic error.

## Technical notes

- Files touched: `src/config/ai.ts` (hint text only), a new `aiStatus` server function in
  `src/lib/admin.functions.ts`, `src/routes/_authenticated/admin/quotes/$id.tsx`,
  `src/components/admin/AdminEngagementPanel.tsx`, `README.md`.
- No schema, no dependency, no behaviour change when the key is present.

## Verification

- With no key: Regenerate is disabled with the explanatory note; no unhandled error.
- With `AI_API_KEY` in `.env.local`: Regenerate produces a draft locally.
- Lovable preview and the published site are unaffected.
