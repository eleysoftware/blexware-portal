import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { setInvoiceStatus } from "@/lib/engagement.functions";
import { allowedInvoiceTransitions, invoiceStatusLabel } from "@/lib/invoice-status";

type Props = {
  invoiceId: string;
  invoiceNumber: string;
  status: string;
  /** Query keys to refresh once the change is saved. */
  invalidateKeys?: string[][];
};

/**
 * Lets the team move an invoice between states by hand — mainly to open a
 * payment link when the invoice email could not be delivered.
 */
export function InvoiceStatusControl({ invoiceId, invoiceNumber, status, invalidateKeys }: Props) {
  const queryClient = useQueryClient();
  const change = useServerFn(setInvoiceStatus);
  const [pending, setPending] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const options = allowedInvoiceTransitions(status);
  if (!options.length) return null;

  const confirm = async () => {
    if (!pending) return;
    setSaving(true);
    try {
      await change({ data: { invoiceId, status: pending } });
      toast.success(`${invoiceNumber} is now ${invoiceStatusLabel(pending).toLowerCase()}.`);
      for (const key of invalidateKeys ?? [["quotes"], ["engagement"]]) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
      setPending(null);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <label className="sr-only" htmlFor={`invoice-status-${invoiceId}`}>
        Change status for {invoiceNumber}
      </label>
      <select
        id={`invoice-status-${invoiceId}`}
        data-testid="invoice-status-select"
        className="h-8 rounded-md border border-border bg-background px-2 text-xs"
        value=""
        onChange={(event) => {
          if (event.target.value) setPending(event.target.value);
          event.target.value = "";
        }}
      >
        <option value="">Change status…</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {invoiceStatusLabel(option)}
          </option>
        ))}
      </select>

      <AlertDialog open={Boolean(pending)} onOpenChange={(open) => (!open ? setPending(null) : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change {invoiceNumber}?</AlertDialogTitle>
            <AlertDialogDescription>
              This moves {invoiceNumber} from {invoiceStatusLabel(status).toLowerCase()} to{" "}
              {pending ? invoiceStatusLabel(pending).toLowerCase() : ""}. No email is sent — share
              the payment link yourself if the client needs it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Keep as is</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button disabled={saving} onClick={() => void confirm()}>
                {saving ? "Saving…" : "Change status"}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
