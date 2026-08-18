import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { DocumentPreview } from "@/components/DocumentPreview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  getMyDocumentUrl,
  getMyEngagement,
  respondToMyEstimate,
  signMyAgreement,
} from "@/lib/client-engagement.functions";
import { formatMoney, type ProjectDocument } from "@/lib/documents/types";

type DocRow = { id: string; entity: string; entity_id: string; kind: string; format: string };

export function EngagementPanel({ quoteId }: { quoteId: string }) {
  const queryClient = useQueryClient();
  const fetchEngagement = useServerFn(getMyEngagement);
  const respondEstimate = useServerFn(respondToMyEstimate);
  const sign = useServerFn(signMyAgreement);
  const docUrl = useServerFn(getMyDocumentUrl);

  const [note, setNote] = useState("");
  const [signature, setSignature] = useState("");
  const [agreed, setAgreed] = useState(false);

  const engagement = useQuery({
    queryKey: ["engagement", quoteId],
    queryFn: () => fetchEngagement({ data: { quoteId } }),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["engagement", quoteId] });
    void queryClient.invalidateQueries({ queryKey: ["my-quote", quoteId] });
  };

  const estimateMutation = useMutation({
    mutationFn: (action: "approved" | "declined") =>
      respondEstimate({ data: { estimateId: estimate!.id as string, action, note } }),
    onSuccess: (result) => {
      toast.success(
        result.status === "approved"
          ? "Estimate approved — we'll send your Statement of Work shortly."
          : "Thanks for letting us know. We've closed this request.",
      );
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const signMutation = useMutation({
    mutationFn: () =>
      sign({ data: { agreementId: agreement!.id as string, fullName: signature, agreed } }),
    onSuccess: () => {
      toast.success("Signed — your first invoice is on its way by email.");
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

  if (engagement.isLoading) return <p className="text-sm text-slate">Loading your documents…</p>;

  const estimate = engagement.data?.estimate as
    | { id: string; status: string; doc: ProjectDocument; total_cents: number; expires_at: string | null }
    | null;
  const agreement = engagement.data?.agreement as
    | { id: string; agreement_number: string; status: string; doc: ProjectDocument; signed_at: string | null; signer_name: string | null }
    | null;
  const invoices = (engagement.data?.invoices ?? []) as {
    id: string;
    invoice_number: string;
    sequence: number;
    amount_cents: number;
    status: string;
    due_date: string | null;
    pay_token: string;
  }[];
  const documents = (engagement.data?.documents ?? []) as DocRow[];

  const docsFor = (entity: string, entityId: string) =>
    documents.filter((doc) => doc.entity === entity && doc.entity_id === entityId);

  return (
    <div className="space-y-6">
      {estimate ? (
        <div className="rounded-2xl border border-border bg-background p-6 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate">
              Cost & schedule estimate
            </h2>
            <Badge variant="outline">{estimate.status}</Badge>
          </div>
          <p className="mt-3 text-lg font-semibold">{formatMoney(Number(estimate.total_cents))}</p>

          <DownloadRow docs={docsFor("estimate", estimate.id)} onOpen={openDoc} />

          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-primary">Read the full estimate</summary>
            <div className="mt-4 rounded-xl border border-border p-5">
              <DocumentPreview doc={estimate.doc} />
            </div>
          </details>

          {estimate.status === "sent" ? (
            <div className="mt-6 space-y-3 border-t border-border pt-6">
              <label htmlFor="estimate-note" className="text-sm font-medium">
                Add a note (optional)
              </label>
              <Textarea
                id="estimate-note"
                value={note}
                maxLength={2000}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Anything you'd like us to know?"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  className="shadow-cta"
                  data-testid="estimate-approve"
                  disabled={estimateMutation.isPending}
                  onClick={() => estimateMutation.mutate("approved")}
                >
                  Approve estimate
                </Button>
                <Button
                  variant="ghost"
                  disabled={estimateMutation.isPending}
                  onClick={() => estimateMutation.mutate("declined")}
                >
                  Decline
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {agreement ? (
        <div className="rounded-2xl border border-border bg-background p-6 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate">
              Statement of Work — {agreement.agreement_number}
            </h2>
            <Badge variant="outline">{agreement.status}</Badge>
          </div>

          <DownloadRow docs={docsFor("agreement", agreement.id)} onOpen={openDoc} />

          <details className="mt-4" open={agreement.status === "sent"}>
            <summary className="cursor-pointer text-sm text-primary">Read the agreement</summary>
            <div className="mt-4 max-h-[28rem] overflow-y-auto rounded-xl border border-border p-5">
              <DocumentPreview doc={agreement.doc} />
            </div>
          </details>

          {agreement.status === "signed" ? (
            <p className="mt-4 text-sm text-slate">
              Signed by {agreement.signer_name}
              {agreement.signed_at ? ` on ${new Date(agreement.signed_at).toLocaleString()}` : ""}.
            </p>
          ) : (
            <div className="mt-6 space-y-4 border-t border-border pt-6">
              <div>
                <label htmlFor="signature" className="text-sm font-medium">
                  Type your full legal name to sign
                </label>
                <Input
                  id="signature"
                  data-testid="sow-signature"
                  value={signature}
                  onChange={(event) => setSignature(event.target.value)}
                  placeholder="Your full name"
                  className="mt-2"
                />
              </div>
              <label className="flex items-start gap-3 text-sm text-slate">
                <Checkbox
                  checked={agreed}
                  onCheckedChange={(value) => setAgreed(value === true)}
                  aria-label="Agree to sign electronically"
                  data-testid="sow-consent"
                />
                <span>
                  I agree that typing my name constitutes a legally binding electronic signature on this
                  Statement of Work. My name, the time of signing and my IP address will be recorded.
                </span>
              </label>
              <Button
                className="shadow-cta"
                data-testid="sow-sign"
                disabled={signMutation.isPending || !agreed || signature.trim().length < 3}
                onClick={() => signMutation.mutate()}
              >
                Sign agreement
              </Button>
            </div>
          )}
        </div>
      ) : null}

      {invoices.length ? (
        <div className="rounded-2xl border border-border bg-background p-6 shadow-card">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate">Invoices</h2>
          <ul className="mt-4 space-y-3">
            {invoices.map((invoice) => (
              <li
                key={invoice.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">{invoice.invoice_number}</p>
                  <p className="text-xs text-slate">
                    Installment #{invoice.sequence}
                    {invoice.due_date ? ` · due ${new Date(invoice.due_date).toLocaleDateString()}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold">{formatMoney(Number(invoice.amount_cents))}</span>
                  {invoice.status === "paid" ? (
                    <Badge variant="secondary">Paid</Badge>
                  ) : (
                    <a
                      href={`/invoice/${invoice.pay_token}`}
                      data-testid="invoice-pay-link"
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                    >
                      Pay now
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-slate">
            Work begins once the first invoice is paid; the remaining invoices are issued every two weeks.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function DownloadRow({ docs, onOpen }: { docs: DocRow[]; onOpen: (id: string) => void }) {
  if (!docs.length) return null;
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {docs.map((doc) => (
        <Button key={doc.id} size="sm" variant="outline" onClick={() => onOpen(doc.id)}>
          Download {doc.format.toUpperCase()}
        </Button>
      ))}
    </div>
  );
}
