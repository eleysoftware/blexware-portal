# Fix the PDF-library crash behind "Something went wrong" — all approval points

## What's happening

The estimate approval itself isn't the problem. The server log for the failed attempt shows:

```text
[respondToMyEstimate] Cannot destructure property '__extends' of '__toESM(...).default' as it is undefined
    at _libs/pdf-lib+tslib.mjs
```

The PDF library pulls in a helper package (`tslib` v1) whose entry point re-exports an older-style module. In the deployed server runtime that interop resolves to `undefined`, so the module throws the moment it is loaded. An earlier fix pointed `pdf-lib` at its modern build, but the helper package underneath it is still resolved the broken way.

## Every action that hits the same fault

The shared engagement module loads the document renderer at the top of its file, and the invoicing module loads the engagement module the same way. So the crash is not specific to estimates — it fires on any request that touches either module, whether or not a PDF is actually produced:

Client portal
- Approve or decline the estimate (the reported failure)
- Approve, request changes on, or decline the proposal
- Sign the Statement of Work
- Download any proposal / estimate / SOW file

Admin workspace
- Send estimate to client
- Generate and send the SOW agreement
- Finalize & countersign / set project start date
- Issue, resend, or void invoices
- Download documents from the admin tabs

Payments
- Invoice pay page and the payment webhook (receipts, payment-status emails, paid-in-full)

Public proposal review link (`/proposal/<token>`) is only affected on the document download action; the approve/decline path there does not touch these modules.

## The fix

1. Add a build alias so the helper package always resolves to its ESM build (`tslib/tslib.es6.js`), matching the existing `pdf-lib` alias. This is the single change that clears all the paths listed above, in both the deployed worker and local dev.
2. Stop non-rendering paths from loading the PDF stack at all: make the document renderer a lazy import inside the one function that renders (`storeDocument`), so status updates, emails, downloads, and invoice actions never pull `pdf-lib` into the request. Defense in depth plus a faster response.
3. Verify against a production-style build: approve the estimate end to end, then re-check the other listed actions (send estimate, generate SOW, sign, countersign, invoice send, document download) so the fix is confirmed across the whole pipeline rather than the one reported button.

## Technical notes

- `vite.config.ts`: add `{ find: /^tslib$/, replacement: "tslib/tslib.es6.js" }` alongside the existing `pdf-lib` alias.
- `src/lib/engagement.server.ts`: replace the module-scope `import { renderDocx, renderPdf } from "@/lib/documents/render.server"` with `await import(...)` inside `storeDocument`. This also de-risks `src/lib/invoicing.server.ts`, which imports `engagement.server` at module scope.
- No database, schema, or business-logic changes; error messaging stays as-is.
