# Fix the live “Approve estimate” failure

## Confirmed diagnosis

The published server logs for the client’s latest attempts show the same runtime failure:

```text
[respondToMyEstimate] Cannot destructure property '__extends' of '__toESM(...).default' as it is undefined
at _libs/pdf-lib+tslib.mjs
```

The current source already lazy-loads the PDF renderer and aliases `pdf-lib`/`tslib`, but the live approval request still loads a generated bundle containing that incompatible module. The estimate remains open because execution fails before the approval updates complete.

## Implementation

1. **Create a hard module boundary around document rendering**
   - Move PDF/DOCX rendering and storage into a dedicated server-only document module.
   - Keep email, notification, URL, and status-update helpers in a module whose import graph has no reference to `pdf-lib`, `docx`, or the renderer.
   - Update estimate approval/decline to import only the lightweight email/notification module, ensuring this action cannot load the PDF bundle even if deployment chunking ignores the current lazy-import boundary.

2. **Protect approval consistency**
   - Check and surface Supabase update errors instead of continuing after a failed estimate or quote update.
   - Preserve the existing rule that only a `sent` estimate can be approved or declined.
   - Keep the current user-friendly toast while retaining the complete tagged server error in logs.

3. **Cover sibling actions sharing the dependency graph**
   - Route non-rendering proposal responses, document URL generation, invoice notifications, and payment notifications through lightweight modules.
   - Keep actual PDF/DOCX imports exclusive to actions that generate documents: proposal/estimate/SOW generation and signed-document creation.

4. **Regression verification**
   - Add a focused test proving estimate approval does not import or execute the document renderer.
   - Run the relevant unit/integration tests and a production-target build check.
   - Publish the corrected build, then retry this quote’s approval on the live client portal and confirm both the estimate and quote statuses change successfully.
   - Re-check published server logs to confirm no `pdf-lib+tslib` error occurs.

## Scope

No visual redesign, schema change, or change to the estimate lifecycle. This addresses the production approval crash and the same accidental PDF-loading risk in related non-rendering actions.
