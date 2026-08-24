import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { HyperswitchCheckout, type CheckoutSession } from "@/components/HyperswitchCheckout";
import { Logo } from "@/components/Logo";
import { PageHero } from "@/components/PageHero";
import { Section } from "@/components/Section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/documents/types";
import { beginInvoicePayment, confirmInvoicePayment, getInvoiceByToken } from "@/lib/invoice.functions";

export const Route = createFileRoute("/invoice/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Pay your invoice — BLEXware" },
      { name: "description", content: "Securely pay your BLEXware project invoice by bank transfer or card." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Pay your invoice — BLEXware" },
      { property: "og:description", content: "Securely pay your BLEXware project invoice online." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InvoicePage,
});

function statusLabel(status: string): string {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function InvoicePage() {
  const { token } = Route.useParams();
  const queryClient = useQueryClient();
  const fetchInvoice = useServerFn(getInvoiceByToken);
  const beginPayment = useServerFn(beginInvoicePayment);
  const confirmPayment = useServerFn(confirmInvoicePayment);

  const [session, setSession] = useState<CheckoutSession | null>(null);
  const [method, setMethod] = useState<"bank" | "card">("bank");
  const [outcome, setOutcome] = useState<{
    status: "succeeded" | "processing";
    method: string | null;
    reference: string;
    amountCents: number;
    at: string;
  } | null>(null);

  const invoice = useQuery({
    queryKey: ["invoice", token],
    queryFn: () => fetchInvoice({ data: { token } }),
  });

  const start = useMutation({
    mutationFn: (choice: "bank" | "card") => beginPayment({ data: { token, method: choice } }),
    onSuccess: (result) => setSession(result as CheckoutSession),
    onError: (error: Error) => toast.error(error.message),
  });

  const confirm = useMutation({
    mutationFn: (reference: string) => confirmPayment({ data: { token, reference } }),
    onSuccess: (result, reference) => {
      setOutcome({
        status: result.status === "succeeded" ? "succeeded" : "processing",
        method: ("paymentMethod" in result ? result.paymentMethod : null) ?? null,
        reference,
        amountCents: session?.amountCents ?? 0,
        at: new Date().toLocaleString(),
      });
      setSession(null);
      void queryClient.invalidateQueries({ queryKey: ["invoice", token] });
    },
  });


  if (invoice.isLoading) {
    return (
      <Section>
        <p className="text-slate">Loading your invoice…</p>
      </Section>
    );
  }

  const data = invoice.data?.invoice;
  if (!data) {
    return (
      <Section>
        <h1 className="text-2xl font-bold" data-testid="invoice-inactive">
          This invoice link isn't active
        </h1>
        <p className="mt-2 text-slate">
          The link may have expired or been replaced. Email hello@blexware.com and we'll send a new one.
        </p>
      </Section>
    );
  }

  const client = invoice.data?.client;
  const paid = data.status === "paid";
  const balance = data.balanceCents;

  return (
    <>
      <PageHero
        eyebrow="Invoice"
        title={data.number}
        description={`${client?.company ?? client?.name ?? ""} · project ${client?.quoteNumber ?? ""}`}
      />
      <Section tone="surface">
        <div className="mx-auto max-w-xl rounded-2xl border border-border bg-background p-8 shadow-card">
          <div className="flex items-center justify-between gap-4">
            <Logo className="h-7 w-auto" />
            <Badge variant={paid ? "secondary" : "outline"} data-testid="invoice-status">
              {statusLabel(data.status)}
            </Badge>
          </div>

          <p className="mt-6 text-sm text-slate">Amount due</p>
          <p className="text-3xl font-bold" data-testid="invoice-balance">
            {formatMoney(balance)}
          </p>

          <dl className="mt-6 space-y-3 border-t border-border pt-6 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate">Billed to</dt>
              <dd>{client?.company ?? client?.name ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate">Installment</dt>
              <dd>#{data.sequence}</dd>
            </div>
            {data.issueDate ? (
              <div className="flex justify-between">
                <dt className="text-slate">Issued</dt>
                <dd>{new Date(data.issueDate).toLocaleDateString()}</dd>
              </div>
            ) : null}
            {data.dueDate ? (
              <div className="flex justify-between">
                <dt className="text-slate">Due</dt>
                <dd>{new Date(data.dueDate).toLocaleDateString()}</dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt className="text-slate">Invoice total</dt>
              <dd>{formatMoney(data.amountCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate">Amount paid</dt>
              <dd>{formatMoney(data.paidCents)}</dd>
            </div>
            {data.description ? (
              <div className="flex justify-between gap-6">
                <dt className="text-slate">Description</dt>
                <dd className="text-right">{data.description}</dd>
              </div>
            ) : null}
          </dl>

          {outcome ? (
            <div
              className="mt-8 rounded-xl border border-border bg-surface p-4 text-sm"
              role="status"
              data-testid="invoice-outcome"
            >
              <p className="font-semibold">
                <span aria-hidden className="mr-2">
                  {outcome.status === "succeeded" ? "✓" : "⏳"}
                </span>
                {outcome.status === "succeeded"
                  ? "Payment Successful"
                  : "Payment Submitted — your bank payment is processing"}
              </p>
              <dl className="mt-3 space-y-1 text-slate">
                <div className="flex justify-between">
                  <dt>Invoice</dt>
                  <dd>{data.number}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Amount</dt>
                  <dd>{formatMoney(outcome.amountCents)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Method</dt>
                  <dd>{outcome.method ?? (method === "bank" ? "Bank account (ACH)" : "Card")}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Date</dt>
                  <dd>{outcome.at}</dd>
                </div>
                <div className="flex justify-between gap-6">
                  <dt>Reference</dt>
                  <dd className="break-all text-right">{outcome.reference}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Remaining balance</dt>
                  <dd>{formatMoney(balance)}</dd>
                </div>
              </dl>
              <p className="mt-3 text-slate">
                {outcome.status === "succeeded"
                  ? "A receipt has been emailed to you."
                  : "We'll update this invoice and email you once your bank confirms the payment."}
              </p>
            </div>
          ) : null}

          {paid ? (
            <p className="mt-8 text-sm text-slate">This invoice is paid in full. Thank you.</p>
          ) : invoice.data?.paymentsEnabled === false ? (
            <p className="mt-8 rounded-xl border border-border bg-surface p-4 text-sm text-slate">
              Online payment isn't available yet on this invoice. Reply to your invoice email and we'll arrange
              payment with you directly.
            </p>
          ) : session ? (
            <>
              <div className="mt-8 rounded-xl border border-border bg-surface p-4 text-sm">
                <p className="font-semibold">
                  {session.method === "bank" ? "Pay by Bank — Recommended" : "Credit or Debit Card"}
                </p>
                <p className="mt-1 text-slate">
                  {session.method === "bank"
                    ? "Securely connect your bank account to pay directly from your bank."
                    : "Enter your card details securely below."}
                </p>
              </div>
              <HyperswitchCheckout
                session={session}
                returnUrl={`${window.location.origin}/invoice/${token}`}
                payLabel={`Pay ${formatMoney(session.amountCents)}`}
                onChangeMethod={() => setSession(null)}
                onDone={(status) => {
                  if (status === "failed") {
                    toast.error("We were unable to process your payment. You can try again.");
                    return;
                  }
                  confirm.mutate(session.reference);
                }}
              />
            </>
          ) : (
            <fieldset className="mt-8">
              <legend className="text-sm font-semibold">How would you like to pay?</legend>
              <div className="mt-3 space-y-3">
                {(
                  [
                    {
                      value: "bank" as const,
                      title: "Pay by Bank (ACH) — Recommended",
                      copy: "Securely connect your bank account to pay directly from your bank.",
                      testId: "method-bank",
                    },
                    {
                      value: "card" as const,
                      title: "Credit or Debit Card",
                      copy: "Pay with Visa, Mastercard, American Express or Discover.",
                      testId: "method-card",
                    },
                  ] satisfies {
                    value: "bank" | "card";
                    title: string;
                    copy: string;
                    testId: string;
                  }[]
                ).map((option) => (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-sm transition-colors focus-within:ring-2 focus-within:ring-ring ${
                      method === option.value ? "border-primary bg-surface" : "border-border"
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment-method"
                      className="mt-1 accent-primary"
                      value={option.value}
                      checked={method === option.value}
                      data-testid={option.testId}
                      onChange={() => setMethod(option.value)}
                    />
                    <span>
                      <span className="block font-semibold">{option.title}</span>
                      <span className="mt-1 block text-slate">{option.copy}</span>
                    </span>
                  </label>
                ))}
              </div>
              <Button
                className="mt-6 w-full shadow-cta"
                data-testid="invoice-pay"
                disabled={start.isPending}
                onClick={() => start.mutate(method)}
              >
                {start.isPending
                  ? "Opening secure checkout…"
                  : `Continue to pay ${formatMoney(balance)}`}
              </Button>
              <p className="mt-3 text-center text-xs text-slate">
                Secure payment powered by BLEXware. We never see or store your bank or card details.
              </p>
            </fieldset>
          )}

        </div>
      </Section>
    </>
  );
}
