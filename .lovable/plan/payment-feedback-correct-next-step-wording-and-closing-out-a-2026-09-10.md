# Payment feedback, correct "next step" wording, and closing out a project

Two things: make the pay button obviously busy while a payment runs, and stop
telling people to pay an invoice that's already settled — plus give both sides a
proper way to close a project out.

## 1. Payment button feedback (client invoice page)

- The pay button switches to a spinner and "Processing your payment…" the
  instant it's pressed, and stays that way until the payment is fully recorded,
  including the recording step after the provider responds (currently a gap
  where the button looks clickable again).
- While busy: the button can't be pressed again, "Choose a different payment
  method" is disabled, and the payment form is dimmed and non-interactive.
- A short line reads "Please don't close or refresh this page." while processing.
- The earlier "Continue to pay" button gets the same spinner treatment while the
  secure checkout opens.

## 2. Stale "waiting on payment" wording

Today a project is flipped straight to "Complete" the moment the final payment
lands, and until then both sides read "pay the open invoice" — which is wrong
once everything is paid. New behaviour:

- Paid in full, work not signed off yet:
  - Admin sees: "Paid in full. Confirm the work is delivered to close this
    project out."
  - Client sees: "You're paid in full. Nothing to pay — we'll ask you to confirm
    when the work is delivered."
- No more automatic jump to Complete on final payment.

## 3. Closing a project out (with approvals)

A two-sided sign-off, mirroring how estimates and the SOW work:

1. When the work is done, the admin presses **Mark work complete** on the
   Overview tab and adds an optional closing note. The project moves to
   "Completion pending" and the client is emailed.
2. The client sees a **Confirm project complete** button in their portal, with
   the closing note. They can confirm, or **Request changes** with a comment,
   which sends it back to the admin and reopens the request.
3. On client confirmation the project becomes **Complete**, the completion date
   is recorded, and both sides see a "nothing outstanding" state.
4. If a client never responds, the admin can close it manually; the record notes
   that it was closed by BLEXware rather than client-confirmed.

Payment must be complete before completion can be requested, so the paid-in-full
state above is what unlocks the button.

## Technical detail

- `src/components/HyperswitchCheckout.tsx`: optional `processing` prop; treat
  `busy || processing` as disabled/spinner; don't clear `busy` on successful
  confirm (only on error); wrap the mount node in `pointer-events-none
  opacity-60` and set `aria-busy` while busy; `Loader2` from `lucide-react`.
- `src/routes/invoice.$token.tsx`: pass `processing={confirm.isPending}`; add a
  spinner to the "Continue to pay" button.
- Migration: add to `public.quotes` — `completion_requested_at timestamptz`,
  `completion_note text`, `completed_at timestamptz`, `completion_confirmed_by
  text` (`client` | `admin`), `completion_change_request text`. No new enum
  value is needed: "completion pending" = status `invoicing` +
  `completion_requested_at` set + zero balance; `completed` stays the terminal
  status. RLS unchanged (clients already read their own quote row).
- `src/lib/invoicing.server.ts` (~line 602): remove the automatic
  `status: 'completed'` update on final payment; keep the paid-in-full receipt
  email.
- `src/lib/engagement.functions.ts`: new admin server fns
  `requestProjectCompletion` and `closeProjectWithoutClient`; both check the
  project balance is zero and write an audit entry.
- `src/lib/client-engagement.functions.ts`: new client server fn
  `respondToProjectCompletion` ({ confirm | request_changes, note }) scoped to
  the verified email; sets `completed_at` + status `completed` on confirm, or
  clears `completion_requested_at` and stores the change request.
- `src/lib/workflow-guidance.ts`: guidance currently keys off `QuoteStatus`
  alone. Extend `getNextStep`/`getStageGuidance` to accept an optional
  `{ balanceCents, completionRequestedAt }` context so `invoicing` resolves to
  one of three messages: payment due, completion sign-off due (admin), or
  awaiting client confirmation. Update `tests/unit/workflow-guidance.spec.ts`.
- UI: completion request controls in `src/components/admin/AdminEngagementPanel.tsx`
  (Overview tab), client confirm/request-changes in
  `src/components/EngagementPanel.tsx`; `StageRail` gains a "Complete" state
  label for completion-pending.
- Emails via `src/lib/engagement-email.server.ts`: "confirm your project is
  complete" to the client, and a completion-confirmed notice to the team.
