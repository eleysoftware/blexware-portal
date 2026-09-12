import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type DeleteProjectDialogProps = {
  quoteNumber: string;
  contactName: string;
  contactEmail: string;
  company?: string | null;
  hasSignedSow?: boolean;
  hasInvoices?: boolean;
  children: React.ReactNode;
  onConfirm: () => void | Promise<void>;
};

export function DeleteProjectDialog({
  quoteNumber,
  contactName,
  contactEmail,
  company,
  hasSignedSow,
  hasInvoices,
  children,
  onConfirm,
}: DeleteProjectDialogProps) {
  const [typed, setTyped] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const confirmed = typed.trim() === quoteNumber.trim();
  const blocked = hasSignedSow || hasInvoices;

  const handleConfirm = async () => {
    if (!confirmed || blocked) return;
    setBusy(true);
    try {
      await onConfirm();
      setOpen(false);
      setTyped("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {quoteNumber}?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-left">
              <p>
                This permanently removes the project for{" "}
                <strong>
                  {company ?? contactName} · {contactEmail}
                </strong>
                .
              </p>
              <p>The following will be deleted:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Intake details and uploaded attachments</li>
                <li>Proposal drafts and generated documents</li>
                <li>Cost &amp; schedule estimate</li>
                <li>Statement of Work and signature records</li>
                <li>Invoices, payment attempts, and milestones</li>
              </ul>
              {blocked ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive">
                  {hasSignedSow
                    ? "This project has a signed Statement of Work, so it must be kept for your records. Archive it instead."
                    : "This project has issued invoices, so it must be kept for your records. Archive it instead."}
                </div>
              ) : (
                <p>
                  Type the project number <code className="font-semibold">{quoteNumber}</code> to
                  confirm.
                </p>
              )}
              {!blocked ? (
                <Input
                  value={typed}
                  onChange={(event) => setTyped(event.target.value)}
                  placeholder={`Type ${quoteNumber}`}
                  aria-label="Confirm project number"
                />
              ) : null}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          {blocked ? null : (
            <AlertDialogAction asChild>
              <Button
                variant="destructive"
                disabled={!confirmed || busy}
                onClick={handleConfirm}
                data-testid="confirm-delete-project"
              >
                {busy ? "Deleting…" : "Delete project"}
              </Button>
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
