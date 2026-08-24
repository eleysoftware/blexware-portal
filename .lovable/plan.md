# Next-step guidance across the quote workspace tabs

Make it obvious, on both the client portal and the admin workspace, what happens next, who owes the next action, and why a tab is empty.

## What the user sees

1. **Next-step banner** at the top of each workspace (under the stage rail):
   - One sentence naming the next action, who owns it ("You" vs "BLEXware team" / "The client"), and a button that jumps to the tab where it happens.
   - When the ball is in the other party's court: "Waiting on the BLEXware team to prepare your cost & schedule estimate. We'll email you when it's ready."

2. **Highlighted tab**
   - The tab holding the next action gets a visible marker (accent dot + accent-tinted label, `aria-describedby` note for screen readers).
   - If the next action is owned by the other party, we highlight the tab of the upcoming step (the step after the last completed one) so the user still knows where to look — styled as "pending" rather than "action needed".

3. **One-line purpose caption at the top of every tab**, e.g.
   - Intake / Overview: "What you told us about the project, plus any files you attached."
   - Proposal: "The scope and approach we recommend — review and approve it here."
   - Estimate: "Cost and schedule for each item in the approved proposal."
   - SOW: "The Statement of Work to sign before work begins."
   - Invoices: "Payments for this project, issued in installments."
   - Activity (admin): "Timeline of every status change, send and signature."

4. **Empty-state message per tab** when there's no content yet: what will appear, which step unlocks it, and who performs that step. Example: "Nothing here yet. Your estimate appears once you approve the proposal and the BLEXware team prices it."

## Technical notes

- New `src/lib/workflow-guidance.ts`: pure, tested mapping from `QuoteStatus` (+ flags for whether a proposal/estimate/agreement/invoices exist) to `{ tabId, actor: "client" | "admin", clientMessage, adminMessage, actionable }`, plus per-tab `purpose` and `emptyState` copy keyed by tab id and audience. No business logic changes, no server changes.
- New `src/components/NextStepBanner.tsx` and `src/components/TabIntro.tsx` (caption + optional empty state), both presentational.
- `src/components/WorkspaceTabs.tsx`: extend `WorkspaceTab` with optional `state?: "action" | "pending"` and render the marker; keep existing roles/ARIA.
- Wire into `src/routes/_authenticated/portal/quotes/$id.tsx` (audience: client) and `src/routes/_authenticated/admin/quotes/$id.tsx` (audience: admin); default the initially selected tab to the highlighted one.
- `src/components/EngagementPanel.tsx` / `AdminEngagementPanel.tsx`: replace bare-empty renders with the shared empty-state component (currently the estimate/SOW/invoice sections render nothing at all when absent).
- Unit test for the guidance mapping covering every status, including `declined` and `completed`.
- Colors use existing semantic tokens only; motion stays minimal.
