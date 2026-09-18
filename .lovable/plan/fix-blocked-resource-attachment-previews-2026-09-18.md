# Fix blocked resource attachment previews

## Goal
Make resource attachments viewable even when Chrome or a browser extension blocks direct requests to the Supabase storage domain.

## Plan
1. Add a same-origin attachment delivery endpoint in the BLEXware app.
   - Issue a short-lived, signed preview token only after the existing signed-in user and project-access checks pass.
   - Validate the token, expiry, resource, and attachment path before returning any file.
   - Stream the private file through the BLEXware origin with the correct content type and safe inline/download headers.

2. Update the Resources attachment viewer.
   - Use the BLEXware delivery URL for PDF, image, text, video, and audio previews instead of fetching a Supabase URL in the browser.
   - Keep unsupported Office and OpenDocument formats available through open/download actions.
   - Preserve loading and failure states, but remove the fallback that can place the Supabase URL into the preview frame.

3. Update attachment actions.
   - Route “Open in a new tab” through the same BLEXware delivery endpoint.
   - Keep downloads access-controlled and use attachment filenames safely.

4. Verify the fix.
   - Add focused tests for token validation, expiry, attachment matching, access boundaries, and response headers.
   - Test an attachment preview and new-tab action to confirm the rendered/requested URL stays on the BLEXware origin and no Supabase storage URL reaches the browser.

## Technical notes
- The current implementation obtains a Supabase signed URL and then calls `fetch(url)` in the browser before creating a blob URL. `ERR_BLOCKED_BY_CLIENT` occurs before that conversion, so the previous change cannot solve domain-level blocking.
- File bytes will be fetched server-side and streamed; they will not be embedded as base64 in a server-function response, avoiding unnecessary memory and size overhead for files up to 50 MB.
- Existing private-bucket rules and project authorization remain in force. No database migration is required.
