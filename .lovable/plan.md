# Fix the in-app attachment viewer

## Goal
Keep the working new-tab action and make PDF attachments display reliably inside BLEXware without Chrome loading the file as an embedded page.

## Plan
1. Replace the PDF frame with an in-app PDF renderer.
   - Fetch the existing short-lived BLEXware file URL as data.
   - Render PDF pages directly inside the preview panel instead of assigning the file URL to an inline frame.
   - Show clear loading and failure states, with the existing Open in a new tab and Download actions always available.

2. Preserve the existing attachment behavior.
   - Keep images, text, video, and audio using the current BLEXware delivery URL.
   - Keep Office and OpenDocument files on the existing open/download path because browsers do not natively render them.
   - Keep all current project-access checks, token expiry, private storage, and safe response headers unchanged.

3. Verify the published-domain behavior.
   - Add focused tests for PDF preview selection and failure handling.
   - Confirm the preview no longer creates a PDF iframe or sends a storage-domain URL to the browser.
   - Check the viewer at desktop and mobile sizes, and confirm Open in a new tab and Download still work.

## Technical notes
- The current PDF preview uses an `<iframe sandbox="">`, while the file response also applies a sandbox policy. Chrome can open the same file as a top-level page but refuse its built-in PDF viewer inside that restricted embedded context.
- Use a browser-compatible PDF rendering library loaded only on the client. Rendering pages to canvas avoids both the embedded-page restriction and any need to weaken the file endpoint's security policy.
- No database or storage migration is required.
