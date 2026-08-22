# Fix "Send estimate to client" in the hosted app + friendly errors everywhere

## What's happening

"Send estimate to client" renders a PDF and a Word copy before emailing. The PDF renderer uses the `pdf-lib` library, which depends on an old helper package (`tslib` 1.x).

- Running locally from Cursor, the dev server loads `pdf-lib`'s modern ESM build, so it works.
- The Lovable build bundles `pdf-lib`'s older CommonJS build for the Cloudflare worker, and the helper import comes back empty — producing `Cannot destructure property '__extends' of '__toESM(...).default' as it is undefined`.

On top of that, the raw internal error text is being shown to you in the UI instead of a plain-language message.

## What will change

### 1. Force the modern build of the PDF library (fixes the hosted error)

Add a resolve alias in `vite.config.ts` pointing `pdf-lib` to its ESM entry so both local dev and the hosted build load the same, worker-safe code. This is a build-config change only — no change to how `renderPdf` is written, so local runs from Cursor keep working exactly as they do today.

Verification: run the production build and exercise the Send estimate path (and the proposal/SOW/invoice document paths, which use the same renderer) in the preview.

### 2. Friendly errors in the UI, real errors in the logs

Introduce one small error boundary helper used by the server functions:

- Server side: catch anything thrown inside a handler, `console.error` the full error (message + stack + an action tag such as `estimate.send`), and re-throw a short, human message.
- Intentional messages the code already throws for expected situations ("Estimate not found", "This quote has no contact email", AI-not-configured, payment/gateway messages) are marked as safe and pass through unchanged.
- Anything unexpected surfaces as: "Something went wrong sending the estimate. The team has been notified — please try again." (wording varies per action.)
- Client side: the existing `toast.error(error.message)` calls keep working and now always show the friendly text.

Applied across the document/engagement/admin/invoice/payment server functions so every action follows the same rule, not just this one button.

## Technical notes

- `vite.config.ts`: add `vite: { resolve: { alias: { "pdf-lib": "pdf-lib/es/index.js" } } }`. No `ssr.external` / `resolve.external` (they break the worker build). If the alias alone is not enough, additionally alias `tslib` to `tslib/tslib.es6.js`.
- New `src/lib/errors.ts`: `UserFacingError` class + `toUserMessage()`.
- New helper `withErrorLogging(tag, fn)` wrapping handler bodies in `src/lib/engagement.functions.ts`, `src/lib/admin.functions.ts`, `src/lib/invoice.functions.ts`, `src/lib/client-engagement.functions.ts`, `src/lib/proposals.functions.ts`.
- Logs land in the worker/server-function logs, retrievable with the server-function log tool.
- No database, schema, or UI-layout changes.
