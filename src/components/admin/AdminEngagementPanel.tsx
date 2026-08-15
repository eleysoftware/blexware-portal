import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney, type EstimateLineItem } from "@/lib/documents/types";
import {
  createAgreement,
  getDocumentUrl,
  getEngagement,
  regenerateProposal,
  saveEstimate,
  sendEstimate,
  sendInvoiceNow,
} from "@/lib/engagement.functions";

type Draft = { label: string; amount: string; duration: string; note: string };

const emptyRow: Draft = { label: "", amount: "", duration: "", note: "" };

export function AdminEngagementPanel({
  quoteId,
  proposalId,
}: {
  quoteId: string;
  proposalId?: string | null;
}) {
  const queryClient = useQueryClient();
  const fetchEngagement = useServerFn(getEngagement);
  const persistEstimate = useServerFn(saveEstimate);
  const release = useServerFn(sendEstimate);
  const makeAgreement = useServerFn(createAgreement);
  const docUrl = useServerFn(getDocumentUrl);
  const sendInvoice = useServerFn(sendInvoiceNow);
  const regenerate = useServerFn(regenerateProposal);

  const engagement = useQuery({
    queryKey: ["engagement-admin", quoteId],
    queryFn: () => fetchEngagement({ data: { quoteId } }),
  });

  const [rows, setRows] = useState<Draft[]>([emptyRow]);
  const [discount, setDiscount] = useState("0");
  const [discountLabel, setDiscountLabel] = useState("Discount");
  const [durationNote, setDurationNote] = useState("");
  const [changeRequest, setChangeRequest] = useState("");

  const estimate = (engagement.data?.estimates ?? [])[0] as
    | {
        id: string;
        status: string;
        line_items: EstimateLineItem[];
        discount_cents: number;
        total_cents: number;
        duration_note: string | null;
      }
    | undefined;

  useEffect(() => {
    if (!estimate?.line_items?.length) return;
    setRows(
      estimate.line_items.map((item) => ({
        label: item.label,
        amount: (item.amountCents / 100).toString(),
        duration: item.durationLabel ?? "",
        note: item.note ?? "",
      })),
    );
    setDiscount((Number(estimate.discount_cents) / 100).toString());
    setDurationNote(estimate.duration_note ?? "");
  }, [estimate?.id]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["engagement-admin", quoteId] });
    void queryClient.invalidateQueries({ queryKey: ["quote", quoteId] });
  };

  const lineItems = (): EstimateLineItem[] =>
    rows
      .filter((row) => row.label.trim() && row.amount.trim())
      .map((row) => ({
        label: row.label.trim(),
        amountCents: Math.round(Number(row.amount) * 100),
        ...(row.duration.trim() ? { durationLabel: row.duration.trim() } : {}),
        ...(row.note.trim() ? { note: row.note.trim() } : {}),
      }));

  const saveMutation = useMutation({
    mutationFn: () =>
      persistEstimate({
        data: {
          quoteId,
          lineItems: lineItems(),
          discountCents: Math.round(Number(discount || 0) * 100),
          discountLabel,
          durationNote,
        },
      }),
    onSuccess: () => {
      toast.success("Estimate saved as a draft");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const saved = await persistEstimate({
        data: {
          quoteId,
          lineItems: lineItems(),
          discountCents: Math.round(Number(discount || 0) * 100),
          discountLabel,
          durationNote,
        },
      });
      return release({ data: { estimateId: saved.estimateId } });
    },
    onSuccess: (result) => {
      toast.success(result.emailed ? "Estimate emailed to the client" : "Estimate sent (email failed)");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const agreementMutation = useMutation({
    mutationFn: () => makeAgreement({ data: { estimateId: estimate!.id } }),
    onSuccess: (result) =>
      toast.success(result.emailed ? "SOW sent for signature" : "SOW created (email failed)") ||
      invalidate(),
    onError: (error: Error) => toast.error(error.message),
  });

  const regenerateMutation = useMutation({
    mutationFn: () => regenerate({ data: { proposalId: proposalId!, changeRequest } }),
    onSuccess: () => {
      toast.success("Proposal regenerated — review the new draft before sending");
      setChangeRequest("");
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ["quote", quoteId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const invoiceMutation = useMutation({
    mutationFn: (invoiceId: string) => sendInvoice({ data: { invoiceId } }),
    onSuccess: () => {
      toast.success("Invoice sent");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const openDoc = async (documentId: string) => {
    try {
      const { url } = await docUrl({ data: { documentId } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const subtotal = lineItems().reduce((sum, item) => sum + item.amountCents, 0);
  const total = Math.max(0, subtotal - Math.round(Number(discount || 0) * 100));
  const agreement = (engagement.data?.agreements ?? [])[0] as
    | { id: string; agreement_number: string; status: string; signed_at: string | null; signer_name: string | null }
    | undefined;
  const invoices = (engagement.data?.invoices ?? []) as {
    id: string;
    invoice_number: string;
    sequence: number;
    amount_cents: number;
    status: string;
    due_date: string | null;
  }[];
  const documents = (engagement.data?.documents ?? []) as {
    id: string;
    entity: string;
    kind: string;
    format: string;
    created_at: string;
  }[];

  return (
    <div className="space-y-6">
      {proposalId ? (
        <div className="rounded-2xl border border-border bg-background p-6 shadow-card">
          <h2 className="text-xl">Client change request</h2>
          <p className="mt-1 text-sm text-slate">
            Paste what the client asked for and regenerate the proposal. The previous version is kept.
          </p>
          <Textarea
            className="mt-3"
            value={changeRequest}
            onChange={(event) => setChangeRequest(event.target.value)}
            placeholder="e.g. Remove the lead-capture feature and add a Savings Reset Kit download."
          />
          <Button
            className="mt-3"
            variant="outline"
            disabled={regenerateMutation.isPending || !changeRequest.trim()}
            onClick={() => regenerateMutation.mutate()}
          >
            {regenerateMutation.isPending ? "Regenerating…" : "Regenerate proposal"}
          </Button>
        </div>
      ) : null}

      <div className="rounded-2xl border border-border bg-background p-6 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl">Cost & schedule estimate</h2>
          {estimate ? <Badge variant="outline">{estimate.status}</Badge> : null}
        </div>

        <div className="mt-4 space-y-3">
          {rows.map((row, index) => (
            <div key={index} className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
              <Input
                aria-label="Line item"
                value={row.label}
                placeholder="Phase or deliverable"
                onChange={(event) =>
                  setRows(rows.map((r, i) => (i === index ? { ...r, label: event.target.value } : r)))
                }
              />
              <Input
                aria-label="Amount in dollars"
                value={row.amount}
                inputMode="decimal"
                placeholder="Amount ($)"
                onChange={(event) =>
                  setRows(rows.map((r, i) => (i === index ? { ...r, amount: event.target.value } : r)))
                }
              />
              <Input
                aria-label="Duration"
                value={row.duration}
                placeholder="Duration"
                onChange={(event) =>
                  setRows(rows.map((r, i) => (i === index ? { ...r, duration: event.target.value } : r)))
                }
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRows(rows.filter((_, i) => i !== index))}
                aria-label="Remove line item"
              >
                Remove
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setRows([...rows, emptyRow])}>
            Add line item
          </Button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Input
            aria-label="Discount label"
            value={discountLabel}
            onChange={(event) => setDiscountLabel(event.target.value)}
            placeholder="Discount label"
          />
          <Input
            aria-label="Discount amount"
            value={discount}
            inputMode="decimal"
            onChange={(event) => setDiscount(event.target.value)}
            placeholder="Discount ($)"
          />
          <Input
            aria-label="Duration summary"
            value={durationNote}
            onChange={(event) => setDurationNote(event.target.value)}
            placeholder="e.g. 24–36 business days"
          />
        </div>

        <p className="mt-4 text-sm text-slate">
          Subtotal {formatMoney(subtotal)} · Total{" "}
          <span className="font-semibold text-foreground">{formatMoney(total)}</span> · Invoices of $600
          with the remainder on the first
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            Save draft
          </Button>
          <Button className="shadow-cta" disabled={sendMutation.isPending} onClick={() => sendMutation.mutate()}>
            Send estimate to client
          </Button>
          {estimate?.status === "approved" ? (
            <Button
              variant="secondary"
              disabled={agreementMutation.isPending}
              onClick={() => agreementMutation.mutate()}
            >
              Generate & send SOW
            </Button>
          ) : null}
        </div>
      </div>

      {agreement ? (
        <div className="rounded-2xl border border-border bg-background p-6 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl">{agreement.agreement_number}</h2>
            <Badge variant="outline">{agreement.status}</Badge>
          </div>
          {agreement.signed_at ? (
            <p className="mt-2 text-sm text-slate">
              Signed by {agreement.signer_name} on {new Date(agreement.signed_at).toLocaleString()}
            </p>
          ) : (
            <p className="mt-2 text-sm text-slate">Awaiting the client's electronic signature.</p>
          )}
        </div>
      ) : null}

      {invoices.length ? (
        <div className="rounded-2xl border border-border bg-background p-6 shadow-card">
          <h2 className="text-xl">Invoices &amp; payments</h2>
          <ul className="mt-4 space-y-4 text-sm">
            {invoices.map((invoice) => {
              const paid = Number(invoice.amount_paid_cents ?? 0);
              const balance = Math.max(0, Number(invoice.amount_cents) - paid);
              const attempts = payments.filter((payment) => payment.invoice_id === invoice.id);
              return (
                <li key={invoice.id} className="rounded-xl border border-border px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span>
                      {invoice.invoice_number} · #{invoice.sequence}
                      {invoice.due_date ? ` · due ${new Date(invoice.due_date).toLocaleDateString()}` : ""}
                    </span>
                    <span className="flex flex-wrap items-center gap-3">
                      <span className="font-semibold">{formatMoney(Number(invoice.amount_cents))}</span>
                      <span className="text-slate">
                        paid {formatMoney(paid)} · balance {formatMoney(balance)}
                      </span>
                      <Badge variant={invoice.status === "paid" ? "secondary" : "outline"}>{invoice.status}</Badge>
                      {invoice.status === "scheduled" ? (
                        <Button size="sm" variant="outline" onClick={() => invoiceMutation.mutate(invoice.id)}>
                          Send now
                        </Button>
                      ) : null}
                    </span>
                  </div>

                  {attempts.length ? (
                    <ul className="mt-3 space-y-2 border-t border-border pt-3">
                      {attempts.map((payment) => (
                        <li key={payment.id} className="flex flex-wrap items-center justify-between gap-3">
                          <span className="text-slate">
                            {formatMoney(Number(payment.amount_cents))} · {payment.payment_method ?? "—"} ·{" "}
                            {payment.hyperswitch_connector ?? "unassigned connector"}
                            {payment.processor_transaction_id ? ` · ${payment.processor_transaction_id}` : ""}
                            {payment.paid_at ? ` · ${new Date(payment.paid_at).toLocaleDateString()}` : ""}
                            {payment.failure_message ? ` · ${payment.failure_message}` : ""}
                          </span>
                          <span className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{payment.status}</Badge>
                            {payment.hyperswitch_payment_id ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  reconcileMutation.mutate(payment.hyperswitch_payment_id as string)
                                }
                              >
                                Reconcile
                              </Button>
                            ) : null}
                            {payment.status === "succeeded" ? (
                              <>
                                <Input
                                  className="h-8 w-24"
                                  inputMode="decimal"
                                  aria-label={`Refund amount for payment ${payment.payment_reference}`}
                                  placeholder="0.00"
                                  value={refundAmounts[payment.id] ?? ""}
                                  onChange={(event) =>
                                    setRefundAmounts((current) => ({
                                      ...current,
                                      [payment.id]: event.target.value,
                                    }))
                                  }
                                />
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    refundMutation.mutate({
                                      invoicePaymentId: payment.id,
                                      amountCents: Math.round(Number(refundAmounts[payment.id] ?? 0) * 100),
                                    })
                                  }
                                >
                                  Refund
                                </Button>
                              </>
                            ) : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {balance > 0 ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                      <Input
                        className="h-8 w-28"
                        inputMode="decimal"
                        aria-label={`Offline payment amount for ${invoice.invoice_number}`}
                        placeholder="Offline $"
                        value={offlineAmounts[invoice.id] ?? ""}
                        onChange={(event) =>
                          setOfflineAmounts((current) => ({ ...current, [invoice.id]: event.target.value }))
                        }
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          offlineMutation.mutate({
                            invoiceId: invoice.id,
                            amountCents: Math.round(Number(offlineAmounts[invoice.id] ?? 0) * 100),
                          })
                        }
                      >
                        Record offline payment
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}


      {documents.length ? (
        <div className="rounded-2xl border border-border bg-background p-6 shadow-card">
          <h2 className="text-xl">Generated documents</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {documents.map((doc) => (
              <li key={doc.id}>
                <Button size="sm" variant="outline" onClick={() => openDoc(doc.id)}>
                  {doc.kind} · {doc.format.toUpperCase()}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
