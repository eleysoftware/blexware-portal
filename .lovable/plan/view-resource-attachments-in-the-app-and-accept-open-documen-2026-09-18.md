# View resource attachments in the app, and accept open-document files

Two changes to the Resources tab (admin and client portal):

1. Attachments can be **viewed** without downloading them.
2. **Open-document** files (OpenOffice / LibreOffice formats) are accepted on upload and handled like the other document types.

## What you'll see

- In a resource's detail box, each attachment gets a **View** button next to **Download**.
- **View** opens a preview panel inside the app:
  - PDFs show page by page in a scrollable frame.
  - Images show full size, scaled to fit.
  - Plain text, CSV and Markdown show as readable text.
  - Video and audio play inline.
  - Word, Excel, PowerPoint and open-document files can't be shown by the browser itself. For those, the panel explains that the file opens in its own app and offers **Open in a new tab** and **Download**.
- The preview has the file name, size, a Download button, and a Close button.
- Uploading now accepts `.odt`, `.ods`, `.odp`, `.odg`, `.odf` and `.fodt`/`.fods`/`.fodp` alongside the existing types, with the same 50 MB per-file limit. The "file type we accept" message is updated to mention them.

## Technical notes

- `src/lib/resource-rules.ts`: add the OpenDocument MIME types (`application/vnd.oasis.opendocument.*`) to `ALLOWED_RESOURCE_TYPES` and the matching extensions to the fallback extension list. Add a small `previewKindFor(mime, name)` helper returning `"pdf" | "image" | "text" | "video" | "audio" | "none"` so the UI and tests share one rule.
- `src/lib/resources.functions.ts`: `resourceDownloadUrl` keeps its current access checks (project access, admin-only archived) and gains an optional `mode: "view"` that returns a longer-lived signed URL (10 minutes, enough to scroll a PDF) plus the attachment's `name`, `mime` and `size`. Downloads keep the existing 120s URL. No new server function, no schema change.
- `src/components/ResourcesPanel.tsx`: add a `viewing` state holding the signed URL and attachment metadata; render a wide dialog that switches on `previewKindFor` — `<iframe>` for PDF, `<img>` for images, fetched-and-rendered `<pre>` for text/CSV/Markdown, `<video>`/`<audio>` for media, and the "opens in its own app" fallback otherwise. Reuse the existing truncation guards so long names stay inside the dialog.
- `tests/unit/resources-attachments.spec.ts`: extend with cases for the new open-document types being accepted and for `previewKindFor` returning the right kind per MIME type and per extension when the browser sends an empty type.
- No database migration needed — file type rules and previewing are application-side only.
