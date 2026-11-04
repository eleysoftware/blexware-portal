import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/documents/types";
import {
  beginAutoRenewFn,
  confirmAutoRenewFn,
  getSubscriptionOfferFn,
  stopAutoRenewFn,
} from "@/lib/subscriptions.functions";

function longDate(value: string) {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

/** Yearly subscription details + PayPal auto-renew opt-in on the pay page. */
export function SubscriptionRenewalPanel({ token }: { token: string }) {
  const queryClient = useQueryClient();
  const getOffer = useServerFn(getSubscriptionOfferFn);
  const begin = useServerFn(beginAutoRenewFn);
  const confirm = useServerFn(confirmAutoRenewFn);
  const stop = useServerFn(stopAutoRenewFn);
  const handled = useRef(false);

  const offer = useQuery({
    queryKey: ["subscription-offer", token],
    queryFn: () => getOffer({ data: { token } }),
    retry: false,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["subscription-offer", token] });
    void queryClient.invalidateQueries({ queryKey: ["invoice", token] });
  };

  const confirmMutation = useMutation({
    mutationFn: (subscriptionId: string) => confirm({ data: { token, subscriptionId } }),
    onSuccess: (result) => {
      if (result.active) toast.success("Automatic yearly renewal is on. Thank you!");
      else toast.message("PayPal is still finishing your subscription — refresh in a minute.");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Returning from PayPal approval.
  useEffect(() => {
    if (handled.current) return;
    const params = new URLSearchParams(window.location.search);
    const flag = params.get("autorenew");
    if (!flag) return;
    handled.current = true;
    const subscriptionId = params.get("subscription_id");
    window.history.replaceState({}, "", window.location.pathname);
    if (flag === "return" && subscriptionId) confirmMutation.mutate(subscriptionId);
    else if (flag === "cancel") toast.message("Automatic renewal wasn't set up. You can still pay below.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const beginMutation = useMutation({
    mutationFn: () => begin({ data: { token } }),
    onSuccess: (result) => {
      window.location.href = result.approveUrl;
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const stopMutation = useMutation({
    mutationFn: () => stop({ data: { token } }),
    onSuccess: () => {
      toast.success("Automatic renewal is off. You'll get an invoice to pay before each renewal.");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const data = offer.data?.offer;
  if (!data) return null;

  return (
    <div
      className="mx-auto mb-6 max-w-xl rounded-2xl border border-border bg-background p-6 shadow-card"
      data-testid="subscription-panel"
    >
      <div className="flex items-start gap-3">
        <RefreshCw className="mt-1 h-5 w-5 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-headline">
            {data.serviceName} — {formatMoney(data.amountCents)} / year
          </h2>
          <p className="mt-1 text-sm text-slate">
            {data.status === "cancelled"
              ? "This subscription has been cancelled."
              : data.autoRenewOn
                ? `Renews automatically on ${longDate(data.renewalDate)}. We'll email you ${data.noticeDays} days before PayPal charges your saved payment method.`
                : `Next renewal: ${longDate(data.renewalDate)}. We'll send an invoice ${data.noticeDays} days before.`}
          </p>

          {confirmMutation.isPending ? (
            <p className="mt-4 flex items-center gap-2 text-sm text-slate">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Confirming with PayPal…
            </p>
          ) : null}

          {data.canEnableAutoRenew ? (
            <div className="mt-4 rounded-xl border border-border bg-highlight p-4">
              <p className="text-sm text-charcoal">
                Pay this year with PayPal and renew automatically every year. You can turn it off any time from this page.
              </p>
              <Button
                className="mt-3"
                onClick={() => beginMutation.mutate()}
                disabled={beginMutation.isPending}
                data-testid="subscription-enable-autorenew"
              >
                {beginMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                Pay {formatMoney(data.amountCents)} &amp; auto-renew yearly
              </Button>
              <p className="mt-2 text-xs text-slate">Prefer to pay once? Use the payment options below.</p>
            </div>
          ) : null}

          {data.autoRenewOn ? (
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => stopMutation.mutate()}
              disabled={stopMutation.isPending}
              data-testid="subscription-stop-autorenew"
            >
              Turn off automatic renewal
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
