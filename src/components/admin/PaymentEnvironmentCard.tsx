import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import {
  getPaymentProviderSettingsFn,
  setPaymentProviderSettingsFn,
} from "@/lib/engagement.functions";

const PROVIDERS = [
  { key: "hyperswitch" as const, label: "Hyperswitch (fallback)" },
  { key: "paypal" as const, label: "PayPal Business" },
];

/** Admin control over active payment provider and sandbox/live environment. */
export function PaymentEnvironmentCard() {
  const queryClient = useQueryClient();
  const [confirmLive, setConfirmLive] = useState<{ provider: string; environment: string } | null>(null);

  const settings = useQuery({
    queryKey: ["payment-provider-settings"],
    queryFn: () => getPaymentProviderSettingsFn(),
  });

  const mutation = useMutation({
    mutationFn: (input: { provider?: "hyperswitch" | "paypal"; environment?: "sandbox" | "live" }) =>
      setPaymentProviderSettingsFn({ data: input }),
    onSuccess: (result) => {
      queryClient.setQueryData(["payment-provider-settings"], result);
      toast.success("Payment provider settings updated.");
      setConfirmLive(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const currentProvider = settings.data?.provider ?? "hyperswitch";
  const currentEnvironment = settings.data?.environment ?? "sandbox";
  const isLive = currentEnvironment === "live";

  const switchProvider = (provider: "hyperswitch" | "paypal") => {
    if (provider === currentProvider) return;
    mutation.mutate({ provider });
  };

  const switchEnvironment = (environment: "sandbox" | "live") => {
    if (environment === currentEnvironment) return;
    if (environment === "live") {
      setConfirmLive({ provider: currentProvider, environment });
      return;
    }
    mutation.mutate({ environment });
  };

  return (
    <div className="mt-10 rounded-2xl border border-border bg-background p-6 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl">Payment provider</h2>
          <p className="mt-1 text-sm text-slate">
            Choose the active payment processor and whether it runs in test/sandbox or live mode.
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
            isLive
              ? "bg-emerald/10 text-emerald"
              : "bg-amber/10 text-amber"
          }`}
        >
          {isLive ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
          {isLive ? "PRODUCTION / LIVE MODE" : "SANDBOX / TEST MODE"}
        </span>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Provider</h3>
          {PROVIDERS.map((option) => (
            <div
              key={option.key}
              className="flex items-center justify-between rounded-xl border border-border px-4 py-3 text-sm"
            >
              <span>{option.label}</span>
              <Switch
                aria-label={`Use ${option.label}`}
                checked={currentProvider === option.key}
                disabled={settings.isLoading || mutation.isPending}
                onCheckedChange={() => switchProvider(option.key)}
              />
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Environment</h3>
          <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3 text-sm">
            <span>Sandbox / test</span>
            <Switch
              aria-label="Use sandbox environment"
              checked={currentEnvironment === "sandbox"}
              disabled={settings.isLoading || mutation.isPending}
              onCheckedChange={(checked) => switchEnvironment(checked ? "sandbox" : "live")}
            />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3 text-sm">
            <span>Live / production</span>
            <Switch
              aria-label="Use live environment"
              checked={currentEnvironment === "live"}
              disabled={settings.isLoading || mutation.isPending}
              onCheckedChange={(checked) => switchEnvironment(checked ? "live" : "sandbox")}
            />
          </div>
        </div>
      </div>

      <p className="mt-4 text-sm" data-testid="payment-provider-active">
        Active:{" "}
        <strong>{currentProvider === "paypal" ? "PayPal Business" : "Hyperswitch (fallback)"}</strong>{" "}
        in <strong>{isLive ? "live / production" : "sandbox / test"}</strong> mode.{" "}
        {settings.data?.credentialsPresent === false ? (
          <span className="text-destructive">
            Its keys for this mode are missing, so clients can&apos;t pay yet.
          </span>
        ) : settings.data ? (
          <span className="text-emerald">Its keys for this mode are in place.</span>
        ) : null}
      </p>

      <p className="mt-2 text-xs text-slate">
        Switching to live makes real charges. Only admins can change this; every change is logged.
      </p>


      <AlertDialog open={!!confirmLive} onOpenChange={() => setConfirmLive(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch to live payments?</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to set <strong>{confirmLive?.provider}</strong> to{" "}
              <strong>live / production</strong>. Real money will move. Make sure your live credentials
              are configured before continuing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmLive(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => mutation.mutate({ environment: "live" })}
              className="bg-emerald text-emerald-foreground hover:bg-emerald/90"
            >
              Yes, go live
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
