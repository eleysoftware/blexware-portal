import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

type HyperWidgets = {
  // The SDK parses this as a CSS selector string — never pass a DOM element.
  create: (type: string, options: Record<string, unknown>) => { mount: (selector: string) => void };
};
type HyperInstance = {
  widgets: (options: Record<string, unknown>) => HyperWidgets;
  confirmPayment: (options: Record<string, unknown>) => Promise<{ error?: { message?: string }; status?: string }>;
};

declare global {
  interface Window {
    Hyper?: (publishableKey: string, options?: Record<string, unknown>) => HyperInstance;
  }
}

const LOADER = {
  sandbox: "https://beta.hyperswitch.io/v1/HyperLoader.js",
  production: "https://checkout.hyperswitch.io/v1/HyperLoader.js",
} as const;

function loadSdk(environment: "sandbox" | "production"): Promise<void> {
  if (window.Hyper) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-hyperswitch]");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Could not load the secure checkout.")));
      return;
    }
    const script = document.createElement("script");
    script.src = LOADER[environment];
    script.async = true;
    script.dataset["hyperswitch"] = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load the secure checkout."));
    document.head.appendChild(script);
  });
}

export type CheckoutSession = {
  clientSecret: string | null;
  publishableKey: string;
  profileId: string;
  environment: "sandbox" | "production";
  amountCents: number;
  method: "bank" | "card";
  scope?: "invoice" | "project";
  reference: string;

};

/**
 * Hyperswitch Unified Checkout. All payment credentials (bank + card) are
 * collected by Hyperswitch — BLEXware never sees or stores them. The payment
 * intent is created server-side restricted to the method the client chose.
 */
export function HyperswitchCheckout({
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
  /** True while the parent is still recording the payment after the provider replied. */
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
    if (!session.clientSecret) {
      setError("This payment could not be started. Please refresh and try again.");
      return;
    }

    loadSdk(session.environment)
      .then(() => {
        if (cancelled || !window.Hyper || !document.getElementById(MOUNT_ID)) return;
        const hyper = window.Hyper(session.publishableKey);
        const widgets = hyper.widgets({
          clientSecret: session.clientSecret,
          appearance: { theme: "default" },
        });
        widgets
          .create("payment", {
            layout: "tabs",
            wallets: { walletReturnUrl: returnUrl },
          })
          .mount(`#${MOUNT_ID}`);
        hyperRef.current = hyper;
        widgetsRef.current = widgets;
        setReady(true);
      })
      .catch((sdkError: Error) => {
        if (!cancelled) setError(sdkError.message);
      });

    return () => {
      cancelled = true;
    };
  }, [session.clientSecret, session.environment, session.publishableKey, returnUrl]);

  async function pay() {
    if (!hyperRef.current || !widgetsRef.current) return;
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
      // Stay busy: the parent still has to record the payment.
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
