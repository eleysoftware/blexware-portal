import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { PageHero } from "@/components/PageHero";
import { Section } from "@/components/Section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/documents/types";
import { getInvoiceByToken, startInvoiceCheckout } from "@/lib/invoice.functions";

export const Route = createFileRoute("/invoice/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Pay your invoice — BLEXware" },
      { name: "description", content: "Securely pay your BLEXware project invoice online by card." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Pay your invoice — BLEXware" },
      { property: "og:description", content: "Securely pay your BLEXware project invoice online." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InvoicePage,
});

function InvoicePage() {
  const { token } = Route.useParams();
  const fetchInvoice = useServerFn(getInvoiceByToken);
  const checkout = useServerFn(startInvoiceCheckout);

  const invoice = useQuery({
    queryKey: ["invoice", token],
    queryFn: () => fetchInvoice({ data: { token } }),
  });

  const pay = useMutation({
    mutationFn: () => checkout({ data: { token } }),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (error: Error) => toast.error(error.message),
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
        <h1 className="text-2xl font-bold">This invoice link isn't active</h1>
        <p className="mt-2 text-slate">
          The link may have expired or been replaced. Email hello@blexware.com and we'll send a new one.
        </p>
      </Section>
    );
  }

  const paid = data.status === "paid";

  return (
    <>
      <PageHero
        eyebrow="Invoice"
        title={data.number}
        description={`${invoice.data?.client?.company ?? invoice.data?.client?.name ?? ""} · project ${invoice.data?.client?.quoteNumber ?? ""}`}
      />
      <Section tone="surface">
        <div className="mx-auto max-w-xl rounded-2xl border border-border bg-background p-8 shadow-card">
          <div className="flex items-center justify-between">
            <p className="text-3xl font-bold">{formatMoney(data.amountCents)}</p>
            <Badge variant={paid ? "secondary" : "outline"}>{paid ? "Paid" : "Due"}</Badge>
          </div>
          <dl className="mt-6 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate">Installment</dt>
              <dd>#{data.sequence}</dd>
            </div>
            {data.dueDate ? (
              <div className="flex justify-between">
                <dt className="text-slate">Due</dt>
                <dd>{new Date(data.dueDate).toLocaleDateString()}</dd>
              </div>
            ) : null}
            {paid && data.paidAt ? (
              <div className="flex justify-between">
                <dt className="text-slate">Paid</dt>
                <dd>{new Date(data.paidAt).toLocaleDateString()}</dd>
              </div>
            ) : null}
          </dl>

          {paid ? (
            <p className="mt-8 text-sm text-slate">
              Thank you — this invoice is paid in full. A receipt was emailed to you.
            </p>
          ) : (
            <>
              <Button
                className="mt-8 w-full shadow-cta"
                disabled={pay.isPending}
                onClick={() => pay.mutate()}
              >
                {pay.isPending ? "Opening secure checkout…" : "Pay by card"}
              </Button>
              <p className="mt-3 text-center text-xs text-slate">
                Payments are processed securely by Stripe. BLEXware never stores your card details.
              </p>
            </>
          )}
        </div>
      </Section>
    </>
  );
}
