import { useState } from "react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export type MoveTargetProject = {
  id: string;
  quoteNumber: string;
  name: string;
};

type MoveInvoicesDialogProps = {
  quoteNumber: string;
  invoiceCount: number;
  projects: MoveTargetProject[];
  loading?: boolean;
  children: React.ReactNode;
  onConfirm: (toQuoteId: string) => void | Promise<void>;
};

export function MoveInvoicesDialog({
  quoteNumber,
  invoiceCount,
  projects,
  loading,
  children,
  onConfirm,
}: MoveInvoicesDialogProps) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    if (!target) return;
    setBusy(true);
    try {
      await onConfirm(target);
      setOpen(false);
      setTarget("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Move invoices out of {quoteNumber}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-left">
              <p>
                All {invoiceCount} invoice{invoiceCount === 1 ? "" : "s"} on this project move to
                the project you choose and continue its payment order. Amounts, payment links and
                anything already paid stay exactly as they are.
              </p>
              {loading ? (
                <p>Loading this client&apos;s other projects…</p>
              ) : projects.length ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="move-invoices-target">
                    Move them into
                  </label>
                  <select
                    id="move-invoices-target"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={target}
                    onChange={(event) => setTarget(event.target.value)}
                  >
                    <option value="">Choose a project…</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.quoteNumber} — {project.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs">
                    Afterwards this project is empty, so you can archive and delete it.
                  </p>
                </div>
              ) : (
                <p>This client has no other project to move the invoices into.</p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <Button
            disabled={!target || busy}
            onClick={handleConfirm}
            data-testid="confirm-move-invoices"
          >
            {busy ? "Moving…" : "Move invoices"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
