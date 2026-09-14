import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { z } from "zod";

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
import { updateClientDetails } from "@/lib/admin.functions";

const clientSchema = z.object({
  contactName: z.string().trim().min(2, "Enter the contact's name").max(80),
  company: z.string().trim().max(120).optional(),
  contactEmail: z.string().trim().email("Enter a valid email address").max(160),
  phone: z.string().trim().max(40).optional(),
});

export type EditClientDialogProps = {
  currentEmail: string;
  contactName: string;
  company?: string | null;
  phone?: string | null;
  projectCount: number;
  /** Emails of every other client in the queue, used to warn about a merge. */
  otherEmails?: string[];
  children: ReactNode;
};

export function EditClientDialog({
  currentEmail,
  contactName,
  company,
  phone,
  projectCount,
  otherEmails = [],
  children,
}: EditClientDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(contactName);
  const [companyValue, setCompanyValue] = useState(company ?? "");
  const [email, setEmail] = useState(currentEmail);
  const [phoneValue, setPhoneValue] = useState(phone ?? "");
  const [error, setError] = useState<string | null>(null);
  const [mergeAcknowledged, setMergeAcknowledged] = useState(false);

  const queryClient = useQueryClient();
  const save = useServerFn(updateClientDetails);

  useEffect(() => {
    if (!open) return;
    setName(contactName);
    setCompanyValue(company ?? "");
    setEmail(currentEmail);
    setPhoneValue(phone ?? "");
    setError(null);
    setMergeAcknowledged(false);
  }, [open, contactName, company, currentEmail, phone]);

  const normalised = email.trim().toLowerCase();
  const emailChanged = normalised !== currentEmail.trim().toLowerCase();
  const wouldMerge =
    emailChanged && otherEmails.some((value) => value.trim().toLowerCase() === normalised);

  const mutation = useMutation({
    mutationFn: (input: {
      currentEmail: string;
      contactName: string;
      company: string | null;
      contactEmail: string;
      phone: string | null;
    }) => save({ data: input }),
    onSuccess: (result) => {
      const count = result?.updated ?? projectCount;
      toast.success(
        `Client details updated on ${count} project${count === 1 ? "" : "s"}.`,
      );
      void queryClient.invalidateQueries({ queryKey: ["quotes"] });
      void queryClient.invalidateQueries({ queryKey: ["quote"] });
      setOpen(false);
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : "Could not save the client details.");
    },
  });

  function submit() {
    const parsed = clientSchema.safeParse({
      contactName: name,
      company: companyValue,
      contactEmail: email,
      phone: phoneValue,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the details and try again.");
      return;
    }
    if (wouldMerge && !mergeAcknowledged) {
      setMergeAcknowledged(true);
      setError(null);
      return;
    }
    setError(null);
    mutation.mutate({
      currentEmail,
      contactName: parsed.data.contactName,
      company: parsed.data.company ? parsed.data.company : null,
      contactEmail: parsed.data.contactEmail,
      phone: parsed.data.phone ? parsed.data.phone : null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit client details</DialogTitle>
          <DialogDescription>
            This updates {projectCount} project{projectCount === 1 ? "" : "s"} for this client.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="client-name">Contact name</Label>
            <Input
              id="client-name"
              value={name}
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="client-company">Company (optional)</Label>
            <Input
              id="client-company"
              value={companyValue}
              maxLength={120}
              onChange={(event) => setCompanyValue(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="client-email">Email address</Label>
            <Input
              id="client-email"
              type="email"
              value={email}
              maxLength={160}
              onChange={(event) => setEmail(event.target.value)}
            />
            {emailChanged ? (
              <p className="text-xs text-slate">
                The client will need to sign in with the new address to see their projects.
              </p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="client-phone">Phone (optional)</Label>
            <Input
              id="client-phone"
              value={phoneValue}
              maxLength={40}
              onChange={(event) => setPhoneValue(event.target.value)}
            />
          </div>

          <p className="text-xs text-slate">
            Documents already created keep the details they were written with. New documents use
            the updated details.
          </p>

          {wouldMerge ? (
            <p className="text-sm font-medium text-destructive">
              Another client already uses {normalised}. Saving merges the two into one client.
              {mergeAcknowledged ? " Press Save again to confirm." : ""}
            </p>
          ) : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
