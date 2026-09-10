# Make the payment button clearly "working" while a payment processes

## The problem

When a client presses the pay button on the invoice page, there is a short gap
where nothing visibly changes. The button still looks clickable, so someone can
press it again thinking the first press did nothing.

There is a second gap after the payment provider returns: the page is still
recording the payment, but the button briefly looks active again.

## What changes (client invoice page only)

1. The pay button switches to a clear busy state the instant it is pressed:
   a spinner plus "Processing your payment…", and it stays that way until the
   payment is fully recorded — including the recording step after the provider
   responds, which currently isn't covered.
2. While busy, the button cannot be pressed again, the "Choose a different
   payment method" link is disabled, and the payment form is dimmed and
   non-interactive so no field can be changed mid-payment.
3. A short line under the button reads "Please don't close or refresh this
   page." while processing.
4. The earlier "Continue to pay" button gets the same treatment while the
   secure checkout is opening.

Nothing about how payments are taken, priced, or recorded changes. The admin
side is untouched.

## Technical detail

- `src/components/HyperswitchCheckout.tsx`: accept an optional `processing`
  prop; treat `busy || processing` as the disabled/spinner condition; do not
  reset `busy` to false on a successful confirm (only on error), so the button
  stays busy while the parent records the payment; wrap the mount container in
  a `pointer-events-none opacity-60` wrapper and add `aria-busy` while busy.
- `src/routes/invoice.$token.tsx`: pass `processing={confirm.isPending}` to
  `HyperswitchCheckout`; keep the existing `start.isPending` label on the
  "Continue to pay" button and add a spinner to it.
- Spinner: `Loader2` from `lucide-react` with `animate-spin`, matching existing
  button usage in the project.
