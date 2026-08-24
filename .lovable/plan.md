# Fix "Something went wrong" when a client approves the estimate

## What's happening

The approval itself isn't the problem. The server log for the failed attempt shows:

```text
[respondToMyEstimate] Cannot destructure property '__extends' of '__toESM(...).default' as it is undefined
    at _libs/pdf-lib+tslib.mjs
```

This is the same PDF-library packaging issue that previously broke "Send estimate to client". The earlier fix pointed `pdf-lib` at its modern build, but `pdf-lib` still pulls in a helper package (`tslib` v1) whose entry point re-exports an older-style module. In the deployed server runtime that interop resolves to `undefined`, so the module crashes as soon as it is loaded — and the estimate-response code path loads it indirectly (the shared engagement module imports the document renderer at the top of the file), even though approving an estimate never renders a PDF.

Result: the whole handler throws before it can save, and the user sees the generic friendly message.

## The fix

1. Add a build alias so the helper package always resolves to its ESM build (`tslib/tslib.es6.js`), matching the existing `pdf-lib` alias. This removes the broken interop for every code path that touches PDF rendering — send estimate, SOW generation, countersign, invoices.
2. Stop the estimate-response path from loading the PDF renderer at all: make the document renderer a lazy import inside the functions that actually render, so a plain status update never pulls the PDF stack into the request. This is defense in depth and also speeds up the response.
3. Re-run the failing action against a production-style build to confirm the estimate approval saves, status moves to "estimate approved", and the team notification email is sent.

## Technical notes

- `vite.config.ts`: add `{ find: /^tslib$/, replacement: "tslib/tslib.es6.js" }` alongside the existing `pdf-lib` alias.
- `src/lib/engagement.server.ts`: replace the module-scope `import { renderDocx, renderPdf } from "@/lib/documents/render.server"` with `await import(...)` inside `storeDocument` (and any other renderer call sites), so `respondToMyEstimate` no longer transitively loads `pdf-lib`.
- No database, schema, or business-logic changes; error handling and messaging stay as-is.
