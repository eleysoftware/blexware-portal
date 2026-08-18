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
  const [outcome, setOutcome] = useState<"succeeded" | "processing" | null>(null);

  const invoice = useQuery({
    queryKey: ["invoice", token],
    queryFn: () => fetchInvoice({ data: { token } }),
  });

  const start = useMutation({
    mutationFn: () => beginPayment({ data: { token } }),
    onSuccess: (result) => setSession(result as CheckoutSession),
    onError: (error: Error) => toast.error(error.message),
  });

  const confirm = useMutation({
    mutationFn: (reference: string) => confirmPayment({ data: { token, reference } }),
    onSuccess: (result) => {
      setOutcome(result.status === "succeeded" ? "succeeded" : "processing");
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

          {outcome === "succeeded" ? (
            <div className="mt-8 rounded-xl border border-border bg-surface p-4 text-sm">
              <p className="font-semibold">Payment successful</p>
              <p className="mt-1 text-slate">
                Thank you — a receipt has been emailed to you.
                {balance > 0 ? ` Remaining balance: ${formatMoney(balance)}.` : " This invoice is paid in full."}
              </p>
            </div>
          ) : null}

          {outcome === "processing" ? (
            <div className="mt-8 rounded-xl border border-border bg-surface p-4 text-sm">
              <p className="font-semibold">Payment submitted</p>
              <p className="mt-1 text-slate">
                Your bank account has been securely connected. Your payment may take additional time to process —
                we'll update this invoice and email you once it's confirmed.
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
                <p className="font-semibold">Pay by Bank — Recommended</p>
                <p className="mt-1 text-slate">
                  Securely connect your bank account to pay directly from your bank, or choose a credit or debit
                  card below.
                </p>
              </div>
              <HyperswitchCheckout
                session={session}
                returnUrl={`${window.location.origin}/invoice/${token}`}
                payLabel={`Pay ${formatMoney(session.amountCents)}`}
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
            <>
              <Button
                className="mt-8 w-full shadow-cta"
                data-testid="invoice-pay"
                disabled={start.isPending}
                onClick={() => start.mutate()}
              >
                {start.isPending ? "Opening secure checkout…" : `Pay ${formatMoney(balance)}`}
              </Button>
              <p className="mt-3 text-center text-xs text-slate">
                Pay by bank (recommended) or credit/debit card. Secure payment powered by BLEXware.
              </p>
            </>
          )}
        </div>
      </Section>
    </>
  );
}
