# Fix "This page has been blocked by Chrome" in the attachment viewer

## What's happening

The preview shows the file by pointing an inline frame at the file's temporary link on the storage service. That link lives on a different web address than the app, and the browser refuses to display another site's page inside a frame — so instead of the document you get Chrome's "This page has been blocked" notice. PDFs are the common victim; images, video and audio are loaded differently and are unaffected.

## The fix

Stop pointing the frame at the remote link. Instead, fetch the file's contents into the page first, then display it from the app's own memory. A file held in memory counts as belonging to the app, so the browser displays it normally.

- On opening the viewer, download the file's bytes in the background and build a local reference to them.
- Show a brief "Loading…" state while that happens, then render as today: PDF in a frame, image, text, video or audio.
- Release the local reference when the viewer closes, so nothing lingers in memory.
- If fetching the bytes fails, fall back to the current message offering "Open in a new tab" and "Download", which both still work.
- "Open in a new tab" keeps using the original temporary link (new tabs are not blocked).

## Technical notes

- In `src/components/ResourcesPanel.tsx`: add an effect keyed on `viewing.url` that does `fetch(url)` → `res.blob()` → `URL.createObjectURL(blob)`, stores it in state, and calls `URL.revokeObjectURL` on cleanup. Render the `pdf`, `image`, `video`, `audio` branches from the object URL (fall back to the signed URL if the blob isn't ready/failed). `TextPreview` already fetches, so it can keep using the signed URL.
- No server change: `resourceDownloadUrl` already returns a 10-minute signed URL with name/mime/size, and Supabase storage allows cross-origin `fetch`.
- No database change; migration 015 is still pending on your side for multi-file attachments.
