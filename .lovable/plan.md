# Reorder and edit proposal phases

Let the team put project phases in the right order — on the import form before a project is created, and on the Milestones board afterwards — and edit the details of any milestone that isn't finished.

## 1. Import page — phase list you can arrange

Today the import page only says "5 phases found". Replace that with a visible, editable list:

- Each phase on its own row, numbered, showing its name.
- Up / down buttons on every row to move it, plus drag-and-drop for mouse users.
- A remove button per row, and a small "Add a phase" input at the bottom.
- The order shown is the order the milestones are created in when you press "Import project".

Keyboard and screen-reader friendly: the up/down buttons are real buttons with labels like "Move Discovery up", so reordering never depends on dragging.

## 2. Milestones board — arrange within a lane

On the project's Milestones tab (team side only; clients stay read-only):

- Dragging a card onto a lane can drop it at a specific spot, not just at the end — a thin insertion line shows where it will land.
- Each card also gets small up / down controls to shift it within its lane.
- Order saves immediately and the board re-reads from the server, so everyone sees the same sequence.

## 3. Edit a milestone's details

Replacing today's bare "Rename" prompt:

- An "Edit" button on each card opens a small dialog with the phase name, a note/description, and the expected duration.
- Available for cards in Not started, In progress and Testing. Cards in Done are locked — the Edit button is hidden and a short line explains the phase is complete; move it back out of Done to change it.
- Saving updates the card straight away; clients still see the board read-only.

## Technical notes

- Import: `phases` state in `src/routes/_authenticated/admin/import.tsx` becomes an ordered, editable array rendered as a list; `importProject` already receives `phases` in order, so no server change. Extract the list into `src/components/PhaseOrderList.tsx`.
- Board: `moveMilestone` in `src/lib/milestones.functions.ts` already accepts an optional `index` and renumbers both lanes — the UI just never sends it. `MilestoneBoard.tsx` gains per-card drop targets (index from the hovered card) and up/down buttons calling `moveMilestone` with `{ lane: row.lane, index: current ± 1 }`.
- Edit dialog: `saveMilestone` already accepts `id`, `title`, `note`, `targetDuration`; add a server-side guard rejecting edits to a milestone whose lane is `done`, matched by the UI hiding the control.
- No schema change; `position`, `note` and `target_duration` already exist on `project_milestones`.
- Optimistic reorder in the React Query cache so a card moves instantly, reverting on error.
- Unit tests for the pure reorder helper and for the done-lane edit guard.
