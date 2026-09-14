import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

type HyperWidgets = {
  create: (type: string, options: Record<string, unknown>) => { mount: (selector: string) => void };
};
type HyperInstance = {
  widgets: (options: Record<string, unknown>) => HyperWidgets;
  confirmPayment: (options: Record<string, unknown>) => Promise<{ error?: { message?: string }; status?: string }>;
};

declare global {
  interface Window {
    Hyper?: (publishableKey: string, options?: Record<string, unknown>) => HyperInstance;
    paypal?: {
      Buttons: (options: {
        createOrder: () => Promise<string | undefined>;
        onApprove: (data: { orderID?: string }, actions: { order?: { capture: () => Promise<unknown> } }) => Promise<void>;
        onCancel: () => void;
        onError: (error: Error) => void;
      }) => { render: (selector: string) => void };
    };
  }
}

const HYPERSWITCH_LOADER = {
  sandbox: "https://beta.hyperswitch.io/v1/HyperLoader.js",
  production: "https://checkout.hyperswitch.io/v1/HyperLoader.js",
} as const;

function loadHyperswitchSdk(environment: "sandbox" | "production"): Promise<void> {
  if (window.Hyper) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-hyperswitch]");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Could not load the secure checkout.")));
      return;
    }
    const script = document.createElement("script");
    script.src = HYPERSWITCH_LOADER[environment];
    script.async = true;
    script.dataset["hyperswitch"] = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load the secure checkout."));
    document.head.appendChild(script);
  });
}

function loadPayPalSdk(clientId: string, environment: "sandbox" | "live"): Promise<void> {
  if (window.paypal) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-paypal]");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Could not load PayPal.")));
      return;
    }
    const script = document.createElement("script");
    script.src = `https://www.${environment === "live" ? "" : "sandbox."}paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&intent=capture&commit=true&currency=USD`;
    script.async = true;
    script.dataset["paypal"] = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load PayPal."));
    document.head.appendChild(script);
  });
}

export type CheckoutSession =
  | {
      provider: "hyperswitch";
      checkout: { kind: "hyperswitch"; publishableKey: string; profileId: string; environment: "sandbox" | "production" };
      clientToken: string | null;
      amountCents: number;
      method: "bank" | "card";
      scope?: "invoice" | "project";
      reference: string;
    }
  | {
      provider: "paypal";
      checkout: { kind: "paypal"; clientId: string; environment: "sandbox" | "live" };
      clientToken: string | null;
      amountCents: number;
      method: "bank" | "card";
      scope?: "invoice" | "project";
      reference: string;
    };

/**
 * Provider-agnostic checkout. Renders Hyperswitch Unified Checkout or PayPal
 * buttons depending on the active provider. Payment credentials are collected
 * by the provider — BLEXware never sees or stores them.
 */
export function PaymentCheckout({
  session,
  returnUrl,
  payLabel,
  onDone,
  onChangeMethod,
  processing = false,
}: {
  session: CheckoutSession;
  returnUrl: string;
  payLabel: string;
  onDone: (status: "succeeded" | "processing" | "failed") => void;
  onChangeMethod?: () => void;
  processing?: boolean;
}) {
  const MOUNT_ID = "blex-payment-element";
  const hyperRef = useRef<HyperInstance | null>(null);
  const widgetsRef = useRef<HyperWidgets | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);

    if (session.provider === "hyperswitch") {
      if (!session.clientToken) {
        setError("This payment could not be started. Please refresh and try again.");
        return;
      }
      loadHyperswitchSdk(session.checkout.environment)
        .then(() => {
          if (cancelled || !window.Hyper || !document.getElementById(MOUNT_ID)) return;
          const hyper = window.Hyper(session.checkout.publishableKey);
          const widgets = hyper.widgets({
            clientSecret: session.clientToken,
            appearance: { theme: "default" },
          });
          widgets.create("payment", { layout: "tabs", wallets: { walletReturnUrl: returnUrl } }).mount(`#${MOUNT_ID}`);
          hyperRef.current = hyper;
          widgetsRef.current = widgets;
          setReady(true);
        })
        .catch((sdkError: Error) => {
          if (!cancelled) setError(sdkError.message);
        });
    }

    if (session.provider === "paypal") {
      loadPayPalSdk(session.checkout.clientId, session.checkout.environment)
        .then(() => {
          if (cancelled || !window.paypal || !document.getElementById(MOUNT_ID)) return;
          window.paypal
            .Buttons({
              createOrder: async () => {
                // The order was already created server-side; clientToken is the PayPal order id.
                return session.clientToken ?? "";
              },
              onApprove: async (_data, actions) => {
                setBusy(true);
                setError(null);
                try {
                  await actions.order?.capture();
                  onDone("succeeded");
                } catch {
                  setError("We were unable to capture your PayPal payment. Please try again.");
                  setBusy(false);
                  onDone("failed");
                }
              },
              onCancel: () => {
                setBusy(false);
              },
              onError: (err) => {
                setError(err.message ?? "We were unable to process your PayPal payment. Please try again.");
                setBusy(false);
                onDone("failed");
              },
            })
            .render(`#${MOUNT_ID}`);
          setReady(true);
        })
        .catch((sdkError: Error) => {
          if (!cancelled) setError(sdkError.message);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [session, returnUrl]);

  async function pay() {
    if (!hyperRef.current || !widgetsRef.current || session.provider !== "hyperswitch") return;
    setBusy(true);
    setError(null);
    try {
      const result = await hyperRef.current.confirmPayment({
        widgets: widgetsRef.current,
        confirmParams: { return_url: returnUrl },
        redirect: "if_required",
      });
      if (result.error) {
        setError(result.error.message ?? "We were unable to process your payment. Please try again.");
        setBusy(false);
        onDone("failed");
        return;
      }
      onDone(result.status === "succeeded" ? "succeeded" : "processing");
    } catch {
      setError("We were unable to process your payment. Please try again.");
      setBusy(false);
      onDone("failed");
    }
  }

  const working = busy || processing;

  return (
    <div className="mt-6" aria-busy={working}>
      <div className={working ? "pointer-events-none opacity-60" : undefined}>
        <div id={MOUNT_ID} className="min-h-[220px]" />
      </div>
      {error ? (
        <p role="alert" className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
          {error}
        </p>
      ) : null}
      {session.provider === "hyperswitch" ? (
        <Button className="mt-6 w-full shadow-cta" disabled={!ready || working} onClick={pay}>
          {working ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              Processing your payment…
            </>
          ) : (
            payLabel
          )}
        </Button>
      ) : null}
      {onChangeMethod ? (
        <Button variant="ghost" className="mt-2 w-full" disabled={working} onClick={onChangeMethod}>
          Choose a different payment method
        </Button>
      ) : null}
      {working ? (
        <p className="mt-3 text-center text-xs text-slate" role="status">
          Please don't close or refresh this page.
        </p>
      ) : null}
      <p className="mt-3 text-center text-xs text-slate">
        Secure payment powered by BLEXware. Your bank and card details are handled by our payment provider —
        BLEXware never stores them.
      </p>
    </div>
  );
}
