# Plan: Manual proposal review link for admins

## Goal
Give admins a dedicated way to copy the client review link from the quote detail page, so they can manually send it to a client whenever email automation is unavailable or unreliable.

## What we will change

1. **Admin quote detail page** (`src/routes/_authenticated/admin/quotes/$id.tsx`)
   - Add a "Copy review link" button next to the existing "Send to client" action.
   - The button is enabled only when a proposal has been created (draft or sent).
   - Build the review URL from the proposal's `review_token` (`/proposal/{review_token}`).
   - On click, copy the absolute URL to the clipboard and show a toast confirmation.
   - Keep the existing auto-copy behavior inside "Send to client" unchanged, but avoid duplicate toasts.

2. **Server-side detail response** (`src/lib/admin.functions.ts` → `getQuoteDetail`)
   - Include the first proposal's `review_token` in the returned detail payload so the client can build the link without an extra round-trip.

## Out of scope
- Email delivery (Resend/SMTP) remains deferred until the verified sending domain is ready.
- No changes to the public proposal review page or the auth flow.

## Acceptance criteria
- Admin sees a visible "Copy review link" button on a quote with a proposal.
- Clicking it copies the full URL to the clipboard.
- A toast says the link is ready to paste.
- The link opens the existing `/proposal/{token}` review page.
