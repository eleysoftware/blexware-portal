# AI provider picker + AI-generated estimates

Two changes to the admin side of the quote pipeline.

## 1. Choose the AI platform and model

Today the app silently uses whichever key is configured (Gemini first, Groq as backup, Lovable/legacy last) and a fixed model per provider. Admins get no say.

What changes:

- The AI status check returns the list of providers that actually have keys configured, plus the model versions available for each (a curated per-provider list, with the configured default marked).
- Both places that call AI — the admin quote page ("Generate draft" / "Regenerate") and the engagement panel ("Regenerate proposal") — get a compact provider + model selector next to the button. It only lists providers whose keys exist; unconfigured providers are not shown.
- The choice is passed through to the generation call and stored on the proposal record (already has `model`), so the version history shows what produced each draft.
- The last-used choice is remembered per admin in local storage so it doesn't reset each visit; no schema change is needed for that.
- If a chosen provider fails (quota, rate limit, outage), the existing automatic failover to the next configured provider still applies, and the toast says which provider actually answered.

## 2. AI-generated cost and time estimates

Today an admin types every line item, amount, and duration by hand in the Estimate section.

What changes:

- A "Draft estimate with AI" button appears in the estimate section of the engagement panel (and in the admin quote page's estimate area if present).
- It sends the approved proposal content, the quote's project type, scope answers, timeline preference, and the **budget range the client picked on the quote form** to the model, and asks for structured output: one line item per proposal phase with a label, a cost in dollars, a duration label, and an optional note, plus an overall duration note and a short rationale.
- The prompt constrains the total to land inside the selected budget range (mid-to-upper part of the band by default). A server-side reconciliation pass then verifies the sum: if it falls outside the band, the line items are proportionally scaled and rounded to clean $50 increments so the total lands inside the range, and the panel shows a note that amounts were adjusted to fit the budget.
- Results land in the **existing editable estimate form as a draft** — nothing is saved or sent automatically. The admin reviews, edits any number, then clicks the existing Save/Send actions. This keeps the rule that AI output is always a human-reviewed draft.
- If the client chose the open-ended top band ("$25,000+"), the model is told to size honestly from scope with no upper clamp.
- Discount, payment plan kind, and invoice scheduling stay manual and unchanged.

## Technical notes

- `src/config/ai.ts`: add a catalog of selectable models per provider and let `aiTargets()` accept an optional preferred `{ provider, model }` that reorders/overrides the target list; keys and URLs stay in env config.
- `src/lib/ai.server.ts`: `completeChat(messages, options?)` gains the preference plus an optional JSON-output mode used by the estimate generator.
- `src/lib/admin.functions.ts`: `getAiStatus` returns `{ configured, providers: [{ id, label, models, defaultModel }] }`.
- `src/lib/engagement.functions.ts`: `regenerateProposal` and the draft-generation function accept optional `provider`/`model`; new `draftEstimateWithAi` server fn (admin-only) returns line items + duration note + rationale without writing to the DB.
- New `src/lib/documents/estimate-ai.ts` for the budget-band parsing, Zod schema for the model output, and the scale-to-budget reconciliation, covered by unit tests alongside the existing `tests/unit/invoice-plan.spec.ts`.
- `AdminEngagementPanel.tsx` and `admin/quotes/$id.tsx`: provider/model select + "Draft estimate with AI" button, existing disabled/unconfigured states preserved.
