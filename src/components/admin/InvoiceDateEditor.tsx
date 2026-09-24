import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateInvoiceDates } from "@/lib/engagement.functions";

export function InvoiceDateEditor({
  invoiceId,
  invoiceNumber,
  status,
  dueDate,
  scheduledSendAt,
}: {
  invoiceId: string;
  invoiceNumber: string;
  status: string;
  dueDate: string | null;
  scheduledSendAt?: string | null;
}) {
  const queryClient = useQueryClient();
  const updateDates = useServerFn(updateInvoiceDates);
  const [open, setOpen] = useState(false);
  const [due, setDue] = useState(dueDate ?? "");
  const [send, setSend] = useState(scheduledSendAt?.slice(0, 10) ?? "");
  const sendDateEditable = status === "draft" || status === "scheduled";
  const mutation = useMutation({
    mutationFn: () =>
      updateDates({
        data: {
          invoiceId,
          dueDate: due || null,
          scheduledSendDate: sendDateEditable && send ? send : null,
        },
      }),
    onSuccess: () => {
      toast.success(`Dates updated for ${invoiceNumber}.`);
      setOpen(false);
      void queryClient.invalidateQueries();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">Edit dates</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit dates for {invoiceNumber}</DialogTitle>
          <DialogDescription>
            The send date controls delivery. The due date controls when reminders begin.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor={`send-${invoiceId}`}>Send date</Label>
            <Input
              id={`send-${invoiceId}`}
              className="mt-1"
              type="date"
              value={send}
              disabled={!sendDateEditable}
              onChange={(event) => setSend(event.target.value)}
            />
            {!sendDateEditable ? (
              <p className="mt-1 text-xs text-slate">Locked after the invoice is sent.</p>
            ) : null}
          </div>
          <div>
            <Label htmlFor={`due-${invoiceId}`}>Due date</Label>
            <Input
              id={`due-${invoiceId}`}
              className="mt-1"
              type="date"
              value={due}
              onChange={(event) => setDue(event.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={mutation.isPending || !due} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Saving…" : "Save dates"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}