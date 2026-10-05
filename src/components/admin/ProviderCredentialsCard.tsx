import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CREDENTIAL_GROUPS } from "@/config/credential-catalog";
import { listCredentialStatusFn, saveCredentialFn } from "@/lib/credentials.functions";

const SOURCE_LABEL = { database: "Saved here", environment: "From host settings", missing: "Not set" } as const;

/** Admin-managed provider keys. Saved values override host environment settings. */
export function ProviderCredentialsCard() {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const status = useQuery({ queryKey: ["provider-credentials"], queryFn: () => listCredentialStatusFn() });
  const byName = new Map((status.data ?? []).map((row) => [row.name, row]));

  const mutation = useMutation({
    mutationFn: (input: { name: string; value: string }) => saveCredentialFn({ data: input }),
    onSuccess: (_r, input) => {
      setDrafts((d) => ({ ...d, [input.name]: "" }));
      void queryClient.invalidateQueries({ queryKey: ["provider-credentials"] });
      toast.success(input.value ? "Setting saved." : "Setting cleared.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="mt-10 rounded-2xl border border-border bg-background p-6 shadow-card">
      <h2 className="text-xl">Provider keys &amp; settings</h2>
      <p className="mt-1 text-sm text-slate">
        Keys saved here are used instead of the hosting platform's settings, so the app works the same on any
        host. Secret keys are never shown again after saving.
      </p>
      {status.isError && <p className="mt-4 text-sm text-destructive">{(status.error as Error).message}</p>}
      <div className="mt-6 space-y-8">
        {CREDENTIAL_GROUPS.map((group) => (
          <section key={group.id}>
            <h3 className="text-base font-semibold">{group.title}</h3>
            <div className="mt-3 space-y-3">
              {group.fields.map((field) => {
                const row = byName.get(field.name);
                const draft = drafts[field.name] ?? "";
                return (
                  <div key={field.name} className="grid gap-2 md:grid-cols-[14rem_1fr_auto] md:items-center">
                    <div className="min-w-0">
                      <label htmlFor={`cred-${field.name}`} className="text-sm font-medium">
                        {field.label}
                      </label>
                      <p className="truncate text-xs text-slate">
                        {row ? SOURCE_LABEL[row.source] : "…"}
                        {row?.preview ? ` · ${row.preview}` : ""}
                      </p>
                    </div>
                    <Input
                      id={`cred-${field.name}`}
                      type={field.secret ? "password" : "text"}
                      autoComplete="off"
                      placeholder={row?.source === "missing" ? "Enter value" : "Enter a new value to replace"}
                      value={draft}
                      onChange={(e) => setDrafts((d) => ({ ...d, [field.name]: e.target.value }))}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={!draft.trim() || mutation.isPending}
                        onClick={() => mutation.mutate({ name: field.name, value: draft })}
                      >
                        Save
                      </Button>
                      {row?.source === "database" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={mutation.isPending}
                          onClick={() => mutation.mutate({ name: field.name, value: "" })}
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
