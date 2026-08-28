import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import { getPaymentMethodSettingsFn, setPaymentMethodEnabledFn } from "@/lib/engagement.functions";

const OPTIONS = [
  { key: "card" as const, label: "Credit or debit card" },
  { key: "bank" as const, label: "Bank transfer (ACH)" },
];

/** Global control over what clients may choose on their invoice pages. */
export function PaymentMethodSettingsCard() {
  const queryClient = useQueryClient();

  const settings = useQuery({
    queryKey: ["payment-method-settings"],
    queryFn: () => getPaymentMethodSettingsFn(),
  });

  const mutation = useMutation({
    mutationFn: (input: { method: "bank" | "card"; enabled: boolean }) =>
      setPaymentMethodEnabledFn({ data: input }),
    onSuccess: (result) => {
      queryClient.setQueryData(["payment-method-settings"], result);
      toast.success("Payment methods updated.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="mt-10 rounded-2xl border border-border bg-background p-6 shadow-card">
      <h2 className="text-xl">Payment methods</h2>
      <p className="mt-1 text-sm text-slate">
        Choose what clients can select on their invoice pages. Bank transfer also has to be enabled with
        the payment provider before it will work.
      </p>
      <div className="mt-4 space-y-3 text-sm">
        {OPTIONS.map((option) => (
          <div
            key={option.key}
            className="flex items-center justify-between rounded-xl border border-border px-4 py-3"
          >
            <span>{option.label}</span>
            <Switch
              aria-label={`${option.label} payments enabled`}
              checked={Boolean(settings.data?.[option.key])}
              disabled={settings.isLoading || mutation.isPending}
              onCheckedChange={(enabled) => mutation.mutate({ method: option.key, enabled })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
