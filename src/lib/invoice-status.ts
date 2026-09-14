/**
 * Which invoice statuses the team may set by hand, and what each one means.
 * Client-safe (no server imports) so the admin UI and the server function
 * share one source of truth.
 */

export const invoiceStatusLabels: Record<string, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  sent: "Sent (open for payment)",
  viewed: "Viewed",
  partially_paid: "Partially paid",
  overdue: "Overdue",
  paid: "Paid",
  void: "Void",
  cancelled: "Cancelled",
};

/** Statuses a client can open and pay from their link. */
export const CLIENT_PAYABLE_STATUSES = ["draft", "sent", "viewed", "partially_paid", "overdue"];

const TRANSITIONS: Record<string, string[]> = {
  draft: ["sent", "cancelled"],
  scheduled: ["sent", "cancelled"],
  sent: ["scheduled", "cancelled"],
  viewed: ["scheduled", "cancelled"],
  overdue: ["scheduled", "cancelled"],
  partially_paid: ["cancelled"],
  cancelled: ["sent"],
  void: ["sent"],
  paid: [],
};

/** Statuses an admin may move this invoice to. Empty means "leave it alone". */
export function allowedInvoiceTransitions(status: string): string[] {
  return TRANSITIONS[status] ?? [];
}

export function canSetInvoiceStatus(from: string, to: string): boolean {
  return allowedInvoiceTransitions(from).includes(to);
}

export function invoiceStatusLabel(status: string): string {
  return invoiceStatusLabels[status] ?? status;
}
