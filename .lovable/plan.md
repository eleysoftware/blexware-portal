# Reorder proposal phases

Let the team put project phases in the right order in two places: on the import form before a project is created, and on the Milestones board afterwards.

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

## Technical notes

- Import: `phases` state in `src/routes/_authenticated/admin/import.tsx` becomes an ordered, editable array rendered as a list; `importProject` already receives `phases` in order, so no server change. Extract the list into `src/components/PhaseOrderList.tsx` so it stays readable.
- Board: `moveMilestone` in `src/lib/milestones.functions.ts` already accepts an optional `index` and renumbers both lanes — the UI just never sends it. `MilestoneBoard.tsx` gains per-card drop targets (compute the index from the hovered card) and up/down buttons calling `moveMilestone` with `{ lane: row.lane, index: current ± 1 }`.
- No schema change; `position` already exists on `project_milestones`.
- Optimistic reorder in the React Query cache so the card moves instantly, reverting on error.
- A unit test for the pure reorder helper (move item at index i by ±1 / to index j).
