import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { TabEmptyState } from "@/components/TabIntro";
import { SignatureBlock } from "@/components/SignatureBlock";
import { getTabEmptyState } from "@/lib/workflow-guidance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  formatMoney,
  type EstimateLineItem,
  type PaymentPlanKind,
  type ProjectDocument,
} from "@/lib/documents/types";
import { buildPaymentPlan } from "@/lib/documents/compose";
import {
  approveProjectStart,
  createAgreement,
  getDocumentUrl,
  getEngagement,
  getPaymentSettlement,
  reconcilePayment,
  recordOfflinePaymentFn,
  refundPayment,
  draftEstimateWithAi,
  regenerateProposal,
  saveEstimate,
  sendEstimate,
  sendInvoiceNow,
} from "@/lib/engagement.functions";

import { getAiStatus } from "@/lib/admin.functions";
import { AiModelPicker, useAiChoice } from "@/components/admin/AiModelPicker";

type Draft = { label: string; amount: string; duration: string; note: string };

const emptyRow: Draft = { label: "", amount: "", duration: "", note: "" };

export type EngagementTab = "proposal" | "estimate" | "sow" | "invoices";

export function AdminEngagementPanel({
  quoteId,
  proposalId,
  tab = "estimate",
}: {
  quoteId: string;
  proposalId?: string | null;
  tab?: EngagementTab;
}) {
  const queryClient = useQueryClient();
  const fetchEngagement = useServerFn(getEngagement);
  const persistEstimate = useServerFn(saveEstimate);
  const release = useServerFn(sendEstimate);
  const makeAgreement = useServerFn(createAgreement);
  const docUrl = useServerFn(getDocumentUrl);
  const sendInvoice = useServerFn(sendInvoiceNow);
  const regenerate = useServerFn(regenerateProposal);
  const draftEstimate = useServerFn(draftEstimateWithAi);
  const issueRefund = useServerFn(refundPayment);
  const recordOffline = useServerFn(recordOfflinePaymentFn);
  const reconcile = useServerFn(reconcilePayment);
  const fetchSettlement = useServerFn(getPaymentSettlement);
  const approveStart = useServerFn(approveProjectStart);
  const aiStatusFn = useServerFn(getAiStatus);


  const engagement = useQuery({
    queryKey: ["engagement-admin", quoteId],
    queryFn: () => fetchEngagement({ data: { quoteId } }),
  });

  const aiStatus = useQuery({
    queryKey: ["ai-status"],
    queryFn: () => aiStatusFn({ data: {} }),
    staleTime: 5 * 60 * 1000,
  });
  const aiReady = aiStatus.data?.configured !== false;
  const [aiChoice, setAiChoice] = useAiChoice(aiStatus.data?.providers);

  const [rows, setRows] = useState<Draft[]>([emptyRow]);
  const [discount, setDiscount] = useState("0");
  const [discountLabel, setDiscountLabel] = useState("Discount");
  const [durationNote, setDurationNote] = useState("");
  const [paymentKind, setPaymentKind] = useState<PaymentPlanKind>("installments");
  const [customPayments, setCustomPayments] = useState<{ label: string; amount: string }[]>([
    { label: "Invoice 1", amount: "" },
    { label: "Invoice 2", amount: "" },
  ]);
  const [changeRequest, setChangeRequest] = useState("");
  const [estimateNote, setEstimateNote] = useState("");
  const [refundAmounts, setRefundAmounts] = useState<Record<string, string>>({});
  const [offlineAmounts, setOfflineAmounts] = useState<Record<string, string>>({});
  const [startDate, setStartDate] = useState("");
  const [payouts, setPayouts] = useState<
    Record<
      string,
      {
        status: string;
        amountCents: number;
        netAmountCents: number | null;
        feeCents: number | null;
        connector: string | null;
        paymentMethod: string | null;
        settledAt: string | null;
      } | null
    >
  >({});


  const estimate = (engagement.data?.estimates ?? [])[0] as
    | {
        id: string;
        status: string;
        line_items: EstimateLineItem[];
        discount_cents: number;
        total_cents: number;
        duration_note: string | null;
        doc?: ProjectDocument | null;
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
    if (estimate.doc?.paymentPlan?.kind) {
      setPaymentKind(estimate.doc.paymentPlan.kind);
      if (estimate.doc.paymentPlan.kind === "custom") {
        setCustomPayments(
          estimate.doc.paymentPlan.rows.map((row) => ({
            label: row.label,
            amount: (row.amountCents / 100).toString(),
          })),
        );
      }
    }
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

  const estimatePayload = () => ({
    quoteId,
    lineItems: lineItems(),
    discountCents: Math.round(Number(discount || 0) * 100),
    discountLabel,
    durationNote,
    paymentKind,
    customPayments:
      paymentKind === "custom"
        ? customPayments
            .filter((row) => row.label.trim() && row.amount.trim())
            .map((row) => ({
              label: row.label.trim(),
              amountCents: Math.round(Number(row.amount) * 100),
            }))
        : undefined,
  });

  const saveMutation = useMutation({
    mutationFn: () => persistEstimate({ data: estimatePayload() }),
    onSuccess: () => {
      toast.success("Estimate saved as a draft");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const saved = await persistEstimate({ data: estimatePayload() });
      return release({ data: { estimateId: saved.estimateId } });
    },
    onSuccess: () => {
      toast.success("Estimate emailed to the client");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const agreementMutation = useMutation({
    mutationFn: () => makeAgreement({ data: { estimateId: estimate!.id } }),
    onSuccess: () => {
      toast.success("SOW sent for signature");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const regenerateMutation = useMutation({
    mutationFn: () =>
      regenerate({
        data: {
          proposalId: proposalId!,
          changeRequest,
          provider: aiChoice.provider,
          model: aiChoice.model,
        },
      }),
    onSuccess: () => {
      toast.success("Proposal regenerated — review the new draft before sending");
      setChangeRequest("");
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ["quote", quoteId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const estimateAiMutation = useMutation({
    mutationFn: () =>
      draftEstimate({ data: { quoteId, provider: aiChoice.provider, model: aiChoice.model } }),
    onSuccess: (result) => {
      setRows(
        result.lineItems.map((item) => ({
          label: item.label,
          amount: (item.amountCents / 100).toString(),
          duration: item.durationLabel ?? "",
          note: item.note ?? "",
        })),
      );
      if (result.durationNote) setDurationNote(result.durationNote);
      setEstimateNote(
        [
          `Drafted with ${result.provider} (${result.model}).`,
          result.adjusted ? "Amounts were scaled to fit the client's selected budget range." : "",
          result.rationale,
        ]
          .filter(Boolean)
          .join(" "),
      );
      toast.success("AI estimate drafted — review and edit before saving");
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

  const refundMutation = useMutation({
    mutationFn: (input: { invoicePaymentId: string; amountCents: number }) =>
      issueRefund({ data: input }),
    onSuccess: (result) => {
      toast.success(`Refund ${result.status} — it completes once the processor confirms it`);
      setRefundAmounts({});
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const offlineMutation = useMutation({
    mutationFn: (input: { invoiceId: string; amountCents: number }) =>
      recordOffline({ data: input }),
    onSuccess: () => {
      toast.success("Offline payment recorded");
      setOfflineAmounts({});
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const payoutMutation = useMutation({
    mutationFn: (providerPaymentId: string) => fetchSettlement({ data: { providerPaymentId } }),
    onSuccess: (result, providerPaymentId) => {
      if (!result) {
        toast.error("The payment gateway isn't configured in this environment yet.");
        return;
      }
      setPayouts((current) => ({ ...current, [providerPaymentId]: result }));
    },
    onError: (error: Error) => toast.error(error.message),
  });


  const reconcileMutation = useMutation({
    mutationFn: (providerPaymentId: string) => reconcile({ data: { providerPaymentId } }),
    onSuccess: () => {
      toast.success("Payment reconciled with the payment service");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const approveStartMutation = useMutation({
    mutationFn: () => approveStart({ data: { agreementId: agreement!.id, startDate } }),
    onSuccess: (result) => {
      toast.success(
        `Countersigned — invoice 1 is due ${new Date(`${result.firstInvoiceDue}T00:00:00`).toLocaleDateString()}`,
      );
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
  const previewPlan = buildPaymentPlan(
    paymentKind,
    total,
    paymentKind === "custom"
      ? customPayments.map((row) => ({
          label: row.label,
          amountCents: Math.round(Number(row.amount || 0) * 100),
        }))
      : undefined,
  );
  const agreement = (engagement.data?.agreements ?? [])[0] as
    | {
        id: string;
        agreement_number: string;
        status: string;
        signed_at: string | null;
        signer_name: string | null;
        doc?: ProjectDocument | null;
      }
    | undefined;
  const countersigned = agreement?.doc?.acceptance?.countersign ?? null;

  const invoices = (engagement.data?.invoices ?? []) as {
    id: string;
    invoice_number: string;
    sequence: number;
    amount_cents: number;
    amount_paid_cents?: number;
    status: string;
    due_date: string | null;
    pay_token?: string | null;
  }[];
  const payments = (engagement.data?.payments ?? []) as {
    id: string;
    invoice_id: string;
    payment_reference: string;
    hyperswitch_payment_id: string | null;
    hyperswitch_connector: string | null;
    amount_cents: number;
    payment_method: string | null;
    status: string;
    processor_transaction_id: string | null;
    failure_message: string | null;
    paid_at: string | null;
  }[];
  const documents = (engagement.data?.documents ?? []) as {
    id: string;
    entity: string;
    kind: string;
    format: string;
    created_at: string;
  }[];

  const tabDocuments = documents.filter((doc) =>
    tab === "proposal"
      ? doc.entity === "proposal"
      : tab === "estimate"
        ? doc.entity === "estimate"
        : tab === "sow"
          ? doc.entity === "agreement"
          : false,
  );

  return (
    <div className="space-y-6">
      {proposalId && tab === "proposal" ? (
        <div className="rounded-2xl border border-border bg-background p-6 shadow-card">
          <h2 className="text-xl">Client change request</h2>
          <p className="mt-1 text-sm text-slate">
            Paste what the client asked for and regenerate the proposal. The previous version is
            kept.
          </p>
          <Textarea
            className="mt-3"
            value={changeRequest}
            onChange={(event) => setChangeRequest(event.target.value)}
            placeholder="e.g. Remove the lead-capture feature and add a Savings Reset Kit download."
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              disabled={regenerateMutation.isPending || !changeRequest.trim() || !aiReady}
              onClick={() => regenerateMutation.mutate()}
            >
              {regenerateMutation.isPending ? "Regenerating…" : "Regenerate proposal"}
            </Button>
            <AiModelPicker
              providers={aiStatus.data?.providers}
              choice={aiChoice}
              onChange={setAiChoice}
              disabled={regenerateMutation.isPending}
            />
          </div>
          {!aiReady ? (
            <p className="mt-2 text-xs text-slate">
              AI drafting is unavailable in this environment. Set GEMINI_API_KEY (and optionally
              GROQ_API_KEY) in .env.local (see README).
            </p>
          ) : null}
        </div>
      ) : null}

      <div
        hidden={tab !== "estimate"}
        className="rounded-2xl border border-border bg-background p-6 shadow-card"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl">Cost & schedule estimate</h2>
          <div className="flex flex-wrap items-center gap-3">
            {estimate ? <Badge variant="outline">{estimate.status}</Badge> : null}
            <Button
              size="sm"
              variant="outline"
              disabled={estimateAiMutation.isPending || !aiReady}
              onClick={() => estimateAiMutation.mutate()}
            >
              {estimateAiMutation.isPending ? "Drafting…" : "Draft estimate with AI"}
            </Button>
            <AiModelPicker
              providers={aiStatus.data?.providers}
              choice={aiChoice}
              onChange={setAiChoice}
              disabled={estimateAiMutation.isPending}
            />
          </div>
        </div>
        {estimateNote ? <p className="mt-2 text-xs text-slate">{estimateNote}</p> : null}
        {!aiReady ? (
          <p className="mt-2 text-xs text-slate">
            AI estimating is unavailable in this environment. Set GEMINI_API_KEY (and optionally
            GROQ_API_KEY) in .env.local (see README). Manual entry still works.
          </p>
        ) : null}

        <div className="mt-4 space-y-3">
          {rows.map((row, index) => (
            <div key={index} className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
              <Input
                aria-label="Line item"
                data-testid="estimate-line-label"
                value={row.label}
                placeholder="Phase or deliverable"
                onChange={(event) =>
                  setRows(
                    rows.map((r, i) => (i === index ? { ...r, label: event.target.value } : r)),
                  )
                }
              />
              <Input
                aria-label="Amount in dollars"
                data-testid="estimate-line-amount"
                value={row.amount}
                inputMode="decimal"
                placeholder="Amount ($)"
                onChange={(event) =>
                  setRows(
                    rows.map((r, i) => (i === index ? { ...r, amount: event.target.value } : r)),
                  )
                }
              />
              <Input
                aria-label="Duration"
                value={row.duration}
                placeholder="Duration"
                onChange={(event) =>
                  setRows(
                    rows.map((r, i) => (i === index ? { ...r, duration: event.target.value } : r)),
                  )
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
          <span className="font-semibold text-foreground">{formatMoney(total)}</span>
        </p>

        <div className="mt-4 space-y-3">
          <label className="block text-sm font-medium">
            Payment schedule
            <select
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              value={paymentKind}
              onChange={(event) => setPaymentKind(event.target.value as PaymentPlanKind)}
              data-testid="payment-split"
            >
              <option value="fifty_fifty">50 / 50 — half on signature, half on completion</option>
              <option value="installments">$600 installments (remainder on first invoice)</option>
              <option value="full">Pay in full on signature</option>
              <option value="custom">Custom amounts</option>
            </select>
          </label>
          {paymentKind === "custom" ? (
            <div className="space-y-2">
              {customPayments.map((row, index) => (
                <div key={index} className="grid gap-2 sm:grid-cols-[2fr_1fr_auto]">
                  <Input
                    aria-label="Invoice label"
                    value={row.label}
                    onChange={(event) =>
                      setCustomPayments(
                        customPayments.map((item, i) =>
                          i === index ? { ...item, label: event.target.value } : item,
                        ),
                      )
                    }
                  />
                  <Input
                    aria-label="Invoice amount"
                    inputMode="decimal"
                    value={row.amount}
                    onChange={(event) =>
                      setCustomPayments(
                        customPayments.map((item, i) =>
                          i === index ? { ...item, amount: event.target.value } : item,
                        ),
                      )
                    }
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCustomPayments(customPayments.filter((_, i) => i !== index))}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCustomPayments([
                    ...customPayments,
                    { label: `Invoice ${customPayments.length + 1}`, amount: "" },
                  ])
                }
              >
                Add invoice
              </Button>
            </div>
          ) : null}
          <ul className="text-sm text-slate">
            {previewPlan.rows.map((row) => (
              <li key={row.label}>
                {row.label}: {formatMoney(row.amountCents)}
                {row.send === "manual" ? " — send when you mark complete" : ""}
                {row.send === "interval" ? " — every 14 days" : ""}
                {row.send === "on_sign" ? " — sent when the SOW is signed" : ""}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="outline"
            data-testid="estimate-save"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            Save draft
          </Button>
          <Button
            className="shadow-cta"
            data-testid="estimate-send"
            disabled={sendMutation.isPending}
            onClick={() => sendMutation.mutate()}
          >
            Send estimate to client
          </Button>
          {estimate?.status === "approved" ? (
            <Button
              variant="secondary"
              data-testid="sow-send"
              disabled={agreementMutation.isPending}
              onClick={() => agreementMutation.mutate()}
            >
              Generate & send SOW
            </Button>
          ) : null}
        </div>
      </div>

      {agreement && tab === "sow" ? (
        <div className="rounded-2xl border border-border bg-background p-6 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl">{agreement.agreement_number}</h2>
            <Badge variant="outline">{agreement.status}</Badge>
          </div>
          <SignatureBlock
            audience="admin"
            agreement={{
              agreement_number: agreement.agreement_number,
              status: agreement.status,
              signed_at: agreement.signed_at ?? null,
              signer_name: agreement.signer_name ?? null,
              document_hash: (agreement as { document_hash?: string | null }).document_hash ?? null,
            }}
            countersign={countersigned ?? null}
          />

          {agreement.status === "signed" ? (
            countersigned ? (
              <p className="mt-4 text-sm text-slate">The invoice schedule has been issued.</p>
            ) : (

              <div className="mt-5 space-y-3 border-t border-border pt-5">
                <p className="text-sm text-slate">
                  Approve the project, set the start date, and countersign as BLEXware. This issues
                  invoice 1 with a due date three days before work starts.
                </p>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="text-sm font-medium">
                    Project start date
                    <Input
                      type="date"
                      className="mt-1"
                      value={startDate}
                      onChange={(event) => setStartDate(event.target.value)}
                      data-testid="project-start-date"
                    />
                  </label>
                  <Button
                    className="shadow-cta"
                    data-testid="project-approve"
                    disabled={!startDate || approveStartMutation.isPending}
                    onClick={() => approveStartMutation.mutate()}
                  >
                    {approveStartMutation.isPending ? "Approving…" : "Approve & countersign"}
                  </Button>
                </div>
              </div>
            )
          ) : null}
        </div>
      ) : tab === "sow" ? (
        <TabEmptyState message={getTabEmptyState("sow", "admin")} />
      ) : null}

      {invoices.length && tab === "invoices" ? (
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
                      {invoice.due_date
                        ? ` · due ${new Date(invoice.due_date).toLocaleDateString()}`
                        : ""}
                    </span>
                    <span className="flex flex-wrap items-center gap-3">
                      <span className="font-semibold">
                        {formatMoney(Number(invoice.amount_cents))}
                      </span>
                      <span className="text-slate">
                        paid {formatMoney(paid)} · balance {formatMoney(balance)}
                      </span>
                      <Badge variant={invoice.status === "paid" ? "secondary" : "outline"}>
                        {invoice.status}
                      </Badge>
                      {invoice.status === "scheduled" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          data-testid="invoice-send-now"
                          onClick={() => invoiceMutation.mutate(invoice.id)}
                        >
                          Send now
                        </Button>
                      ) : null}
                      {invoice.pay_token ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            const link = `${window.location.origin}/invoice/${invoice.pay_token}`;
                            void navigator.clipboard
                              .writeText(link)
                              .then(() => toast.success("Payment link copied"))
                              .catch(() => toast.error("Could not copy the payment link"));
                          }}
                        >
                          Copy pay link
                        </Button>
                      ) : null}

                    </span>
                  </div>

                  {attempts.length ? (
                    <ul className="mt-3 space-y-2 border-t border-border pt-3">
                      {attempts.map((payment) => (
                        <li
                          key={payment.id}
                          className="flex flex-wrap items-center justify-between gap-3"
                        >
                          <span className="text-slate">
                            {formatMoney(Number(payment.amount_cents))} ·{" "}
                            {payment.payment_method ?? "—"} ·{" "}
                            {payment.hyperswitch_connector ?? "unassigned connector"}
                            {payment.processor_transaction_id
                              ? ` · ${payment.processor_transaction_id}`
                              : ""}
                            {payment.paid_at
                              ? ` · ${new Date(payment.paid_at).toLocaleDateString()}`
                              : ""}
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
                                      amountCents: Math.round(
                                        Number(refundAmounts[payment.id] ?? 0) * 100,
                                      ),
                                    })
                                  }
                                >
                                  Refund
                                </Button>
                              </>
                            ) : null}
                            {payment.status === "succeeded" && payment.hyperswitch_payment_id ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  payoutMutation.mutate(payment.hyperswitch_payment_id as string)
                                }
                              >
                                Payout status
                              </Button>
                            ) : null}
                          </span>
                          {payment.hyperswitch_payment_id &&
                          payouts[payment.hyperswitch_payment_id] ? (
                            <p className="basis-full text-xs text-slate">
                              Payout: {payouts[payment.hyperswitch_payment_id]!.status}
                              {payouts[payment.hyperswitch_payment_id]!.netAmountCents !== null
                                ? ` · net ${formatMoney(payouts[payment.hyperswitch_payment_id]!.netAmountCents!)}`
                                : ""}
                              {payouts[payment.hyperswitch_payment_id]!.feeCents !== null
                                ? ` · fees ${formatMoney(payouts[payment.hyperswitch_payment_id]!.feeCents!)}`
                                : ""}
                              {payouts[payment.hyperswitch_payment_id]!.connector
                                ? ` · ${payouts[payment.hyperswitch_payment_id]!.connector}`
                                : ""}
                              {payouts[payment.hyperswitch_payment_id]!.settledAt
                                ? ` · ${new Date(payouts[payment.hyperswitch_payment_id]!.settledAt!).toLocaleString()}`
                                : ""}
                              . Bank account details stay in the payment gateway dashboard.
                            </p>
                          ) : null}
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
                          setOfflineAmounts((current) => ({
                            ...current,
                            [invoice.id]: event.target.value,
                          }))
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
      ) : tab === "invoices" ? (
        <TabEmptyState message={getTabEmptyState("invoices", "admin")} />
      ) : null}

      {tabDocuments.length ? (
        <div className="rounded-2xl border border-border bg-background p-6 shadow-card">
          <h2 className="text-xl">Generated documents</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {tabDocuments.map((doc) => (
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
