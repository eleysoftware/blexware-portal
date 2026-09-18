# Fix: long attachment names overflow the "Add a resource" dialog

## Problem

In the Add/Edit resource dialog, a long file name forces the Title, Short description and
Attachments fields to render wider than the dialog itself (measured 712px of content inside a
510px dialog), so they poke out past the dialog border.

Root cause: the dialog body is a CSS grid item, and grid items don't shrink below their content
width by default. The attachment chips' "truncate" styling can't take effect while an ancestor
refuses to shrink, so the whole column grows to the full length of the longest file name.

Reproduced and verified: adding `min-width: 0` to the wrapper keeps the dialog at its normal
width and long names truncate with an ellipsis.

## Changes (all in `src/components/ResourcesPanel.tsx`)

1. **Add/edit dialog** — add `min-w-0` to the form wrapper:
   `<div className="space-y-4">` (the container holding the Title, Short description and
   Attachments fields) becomes `<div className="min-w-0 space-y-4">`.
2. **Detail dialog** — same guard on the attachments list wrapper:
   `<div className="space-y-2">` (the container holding attachment rows with Download buttons)
   becomes `<div className="min-w-0 space-y-2">`, so long names there also truncate instead of
   stretching the dialog.

No behavior, data, or copy changes — the file names are untouched, they just display truncated.

## Verification

- Typecheck (`npx tsgo --noEmit`).
- In the preview, open a project's Resources tab, click "Add a resource", attach a file with a
  very long name, and confirm the dialog keeps its size and the name truncates. (Preview sign-in
  is externally managed, so I'll verify the fix with a standalone reproduction of the dialog's
  markup — already done, fix confirmed — plus the typecheck; a quick visual check in the preview
  by you on the live page is the final confirmation.)
