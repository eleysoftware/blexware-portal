import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteTestClients, listTestOnlyClients } from "@/lib/admin.functions";

/**
 * Removes sign-in accounts whose only projects are test projects. The list is
 * always shown first, and the admin has to type DELETE to confirm.
 */
export function CleanupTestClientsDialog({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const queryClient = useQueryClient();

  const candidates = useQuery({
    queryKey: ["test-only-clients"],
    queryFn: () => listTestOnlyClients({ data: {} }),
    enabled: open,
  });

  const removal = useMutation({
    mutationFn: (emails: string[]) => deleteTestClients({ data: { emails } }),
    onSuccess: (result) => {
      toast.success(
        result.removed
          ? `Removed ${result.removed} test sign-in account${result.removed === 1 ? "" : "s"}.`
          : "No accounts were removed.",
      );
      setConfirmText("");
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["test-only-clients"] });
      void queryClient.invalidateQueries({ queryKey: ["quotes"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const clients = candidates.data?.clients ?? [];
  const withAccounts = clients.filter((client) => client.userId);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setConfirmText("");
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Clean up test clients</DialogTitle>
          <DialogDescription>
            These people only have test projects. Removing them deletes their sign-in account.
            Their project records stay in the test area. Admin and staff accounts are never listed.
          </DialogDescription>
        </DialogHeader>

        {candidates.isLoading ? (
          <p className="text-sm text-slate">Checking accounts…</p>
        ) : clients.length === 0 ? (
          <p className="text-sm text-slate">No test-only clients found.</p>
        ) : (
          <ul className="max-h-60 space-y-2 overflow-y-auto text-sm">
            {clients.map((client) => (
              <li
                key={client.email}
                className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
              >
                <span>
                  <span className="block font-medium">{client.name}</span>
                  <span className="block text-xs text-slate">{client.email}</span>
                </span>
                <span className="text-xs text-slate">
                  {client.userId
                    ? `${client.projectCount} test project${client.projectCount === 1 ? "" : "s"}`
                    : "No sign-in account"}
                </span>
              </li>
            ))}
          </ul>
        )}

        {withAccounts.length ? (
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="confirm-delete-test-clients">
              Type DELETE to remove {withAccounts.length} account
              {withAccounts.length === 1 ? "" : "s"}
            </label>
            <Input
              id="confirm-delete-test-clients"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              placeholder="DELETE"
            />
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={
              confirmText.trim().toUpperCase() !== "DELETE" ||
              !withAccounts.length ||
              removal.isPending
            }
            onClick={() => removal.mutate(withAccounts.map((client) => client.email))}
          >
            {removal.isPending ? "Removing…" : "Remove accounts"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
