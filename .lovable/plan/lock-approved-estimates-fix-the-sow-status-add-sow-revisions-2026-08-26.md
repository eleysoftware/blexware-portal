# Lock approved estimates, fix the SOW status, add SOW revisions

Three fixes so approvals can't be silently undone and the SOW section tells the truth.

## 1. You can't edit an approved estimate by accident

Today the estimate editor stays fully editable after the client approves; the block only fires
when you press Save, which is where the "already approved" error came from — and an earlier save
had already flipped the approved estimate back to draft.

- When an approved estimate exists and "Revise the approved estimate" is unchecked:
  the line items, discount, duration, payment plan and the Save / Send buttons are all disabled,
  with a clear banner: "Client approved $X on <date>. Tick 'Revise the approved estimate' to make changes."
- Ticking the checkbox unlocks the editor and makes it explicit that saving starts a new version
  that must be re-sent and re-approved.
- The server rule stays as the safety net, so no path can quietly downgrade an approval.
- Recovery for the current project: confirm whether the live estimate is sitting in draft after the
  earlier save. If it is, restore it to the approved version (use "Mark estimate approved" on the
  version the client accepted) so the SOW can be generated from it.

## 2. The SOW section shows the SOW's status, not the estimate's

The badge in "Statement of work" currently prints the estimate's status, which is why it reads
"approved" when no SOW exists yet.

- Badge shows the actual SOW state: `Not created`, `Draft`, `Sent for signature`, `Signed`, or `Void`.
- Below the heading, a separate line: "Based on estimate v2 — approved by the client on <date>."
- The Generate & send button stays gated on the estimate being approved, with the existing hint.

## 3. Revising a SOW follows the same approval process as the estimate

- Once a SOW has been sent or signed, the SOW form is locked. A "Revise the statement of work"
  checkbox unlocks it, with a warning that the current SOW will be voided and the client must sign
  the new one.
- Revising voids the prior agreement, creates a new SOW version from the current approved estimate
  (plus any scope addendum), and re-sends it for signature. The signed PDF and audit trail of the
  voided version are kept.
- A version list under the SOW mirrors the estimate version list (number, total, date, status).
- Guardrail: if invoices have already been issued against a signed SOW, revision is blocked with a
  message to void or cancel those invoices first, rather than silently re-basing billing.

## Technical notes

- UI: `src/components/admin/AdminEngagementPanel.tsx` — disabled state driven by
  `approvedEstimate && !reviseMode`; SOW badge derived from `agreement?.status` instead of
  `sowEstimate.status`; new `sowReviseMode` state and agreement version list.
- Server: `src/lib/engagement.functions.ts` — `createAgreement` gains a `revise` flag that voids the
  latest non-draft agreement (status `void`) before inserting the new one, refuses when an invoice
  exists in a state other than draft/void, and writes an `agreement.revised` audit entry.
- Data: agreements already support a `void` status and multiple rows per estimate, so no migration
  is needed.
- Tests: unit coverage for the revise guard (approved estimate blocked without the flag, SOW revision
  blocked when invoices are live).
