import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AdminEngagementPanel } from "@/components/admin/AdminEngagementPanel";
import { DocumentDownloads } from "@/components/DocumentDownloads";
import { DocumentPreview } from "@/components/DocumentPreview";
import { Section } from "@/components/Section";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  generateProposal,
  getAiStatus,
  getQuoteDetail,
  getQuoteFileUrl,
  refreshProposalDocuments,
  saveProposal,
  sendProposal,
  updateQuoteStatus,
} from "@/lib/admin.functions";
import { getDocumentUrl } from "@/lib/engagement.functions";
import { quoteStatusLabels, quoteStatuses, type QuoteStatus } from "@/lib/quote-schema";

export const Route = createFileRoute("/_authenticated/admin/quotes/$id")({
  head: () => ({ meta: [{ title: "Quote detail — BLEXware team" }, { name: "robots", content: "noindex" }] }),
  component: QuoteDetailPage,
});

function formatBytes(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function QuoteDetailPage() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();

  const fetchDetail = useServerFn(getQuoteDetail);
  const fileUrl = useServerFn(getQuoteFileUrl);
  const setStatus = useServerFn(updateQuoteStatus);
  const draft = useServerFn(generateProposal);
  const save = useServerFn(saveProposal);
  const send = useServerFn(sendProposal);
  const refreshDocs = useServerFn(refreshProposalDocuments);
  const docUrl = useServerFn(getDocumentUrl);
  const aiStatusFn = useServerFn(getAiStatus);

  const detail = useQuery({
    queryKey: ["quote", id],
    queryFn: () => fetchDetail({ data: { id } }),
  });

  const aiStatus = useQuery({
    queryKey: ["ai-status"],
    queryFn: () => aiStatusFn({ data: {} }),
    staleTime: 5 * 60 * 1000,
  });
  const aiReady = aiStatus.data?.configured !== false;

  const [content, setContent] = useState("");
  const [documentTitle, setDocumentTitle] = useState("");
  const proposal = detail.data?.proposals[0] ?? null;

  useEffect(() => {
    if (proposal) setContent(proposal.content);
    const title = proposal?.doc?.documentTitle ?? detail.data?.quote.project_type;
    if (title) setDocumentTitle(title.endsWith("Proposal") ? title : `${title} Proposal`);
  }, [proposal?.id, proposal?.content, proposal?.doc, detail.data?.quote.project_type]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["quote", id] });

  const statusMutation = useMutation({
    mutationFn: (status: QuoteStatus) => setStatus({ data: { id, status } }),
    onSuccess: () => {
      toast.success("Status updated");
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const draftMutation = useMutation({
    mutationFn: () => draft({ data: { quoteId: id } }),
    onSuccess: () => {
      toast.success("Draft generated — review before sending");
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const saveMutation = useMutation({
    mutationFn: () => save({ data: { id: proposal!.id, content, documentTitle } }),
    onSuccess: () => {
      toast.success("Draft saved");
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      await save({ data: { id: proposal!.id, content, documentTitle } });
      return send({ data: { id: proposal!.id } });
    },
    onSuccess: (result) => {
      toast.success("Proposal emailed to the client");
      void navigator.clipboard
        ?.writeText(`${window.location.origin}${result.reviewPath}`)
        .then(() => toast.success("Review link copied to clipboard"))
        .catch(() => undefined);
      void invalidate();
      void queryClient.invalidateQueries({ queryKey: ["engagement-admin", id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const refreshMutation = useMutation({
    mutationFn: () => refreshDocs({ data: { quoteId: id } }),
    onSuccess: () => {
      toast.success("Formatted documents refreshed");
      void invalidate();
      void queryClient.invalidateQueries({ queryKey: ["engagement-admin", id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const copyReviewLink = async () => {
    if (!proposal?.review_token) return;
    const url = `${window.location.origin}/proposal/${proposal.review_token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Review link copied to clipboard");
    } catch {
      toast.error("Could not copy link. Copy it manually from the address bar.");
    }
  };

  const openFile = async (fileId: string) => {
    try {
      const { url } = await fileUrl({ data: { fileId } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const openDoc = async (documentId: string) => {
    try {
      const { url } = await docUrl({ data: { documentId } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  if (detail.isLoading) {
    return (
      <Section>
        <p className="text-slate">Loading quote…</p>
      </Section>
    );
  }

  if (detail.isError || !detail.data) {
    return (
      <Section>
        <p className="text-slate">This quote could not be loaded.</p>
        <Link to="/admin" className="text-primary underline-offset-4 hover:underline">
          Back to the queue
        </Link>
      </Section>
    );
  }

  const { quote, files, audit } = detail.data;

  return (
    <Section>
      <Link to="/admin" className="text-sm text-primary underline-offset-4 hover:underline">
        ← Back to the queue
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl">{quote.quote_number}</h1>
          <p className="mt-2 text-slate">
            {quote.contact_name}
            {quote.company ? ` · ${quote.company}` : ""} ·{" "}
            <a className="text-primary" href={`mailto:${quote.contact_email}`}>
              {quote.contact_email}
            </a>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {quoteStatuses.map((status) => (
            <Button
              key={status}
              size="sm"
              variant={quote.status === status ? "default" : "outline"}
              onClick={() => statusMutation.mutate(status)}
              disabled={statusMutation.isPending}
            >
              {quoteStatusLabels[status]}
            </Button>
          ))}
        </div>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-2xl border border-border bg-background p-6 shadow-card">
            <h2 className="text-xl">Intake answers</h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              {[
                ["Project type", quote.project_type],
                ["Industry", quote.industry],
                ["Budget", quote.budget],
                ["Timeline", quote.timeline],
                ["Phone", quote.phone ?? "—"],
                ["Received", new Date(quote.created_at).toLocaleString()],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs uppercase tracking-wide text-slate">{label}</dt>
                  <dd className="mt-1">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-6">
              <p className="text-xs uppercase tracking-wide text-slate">Services</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {quote.services.map((service) => (
                  <Badge key={service} variant="secondary">
                    {service}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="mt-6 space-y-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate">Goals</p>
                <p className="mt-1 whitespace-pre-wrap leading-relaxed">{quote.goals}</p>
              </div>
              {quote.features ? (
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate">Desired features</p>
                  <p className="mt-1 whitespace-pre-wrap leading-relaxed">{quote.features}</p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background p-6 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl">Proposal draft</h2>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => draftMutation.mutate()}
                  disabled={draftMutation.isPending}
                >
                  {draftMutation.isPending ? "Generating…" : proposal ? "Regenerate" : "Generate draft"}
                </Button>
                {proposal ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      data-testid="proposal-save"
                      onClick={() => saveMutation.mutate()}
                      disabled={saveMutation.isPending}
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      data-testid="proposal-send"
                      onClick={() => sendMutation.mutate()}
                      disabled={sendMutation.isPending}
                    >
                      {sendMutation.isPending ? "Sending…" : "Send to client"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={copyReviewLink}
                      disabled={!proposal?.review_token}
                    >
                      Copy review link
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      data-testid="proposal-refresh-docs"
                      onClick={() => refreshMutation.mutate()}
                      disabled={refreshMutation.isPending}
                    >
                      {refreshMutation.isPending ? "Refreshing…" : "Refresh formatted documents"}
                    </Button>
                  </>
                ) : null}
              </div>
            </div>

            <p className="mt-3 text-sm text-slate">
              AI drafts are always reviewed by a human before they reach a client. "Send to client"
              emails the review link from quote@blexware.com and copies it for you; "Copy review link"
              shares it manually without sending mail.
            </p>

            {proposal ? (
              <>
                <label className="mt-4 block text-sm font-medium">
                  Document title
                  <Input
                    className="mt-1"
                    value={documentTitle}
                    onChange={(event) => setDocumentTitle(event.target.value)}
                    placeholder="Website Enhancement Proposal"
                    aria-label="Document title used in the header"
                  />
                </label>
                <p className="mt-1 text-xs text-slate">
                  Appears in the running header as{" "}
                  <span className="font-medium text-foreground">
                    {detail.data?.quote.company || detail.data?.quote.contact_name} | {documentTitle || "…"}
                  </span>
                </p>
                {proposal.doc ? (
                  <div className="mt-4 max-h-[32rem] overflow-y-auto rounded-xl border border-border">
                    <DocumentPreview doc={{ ...proposal.doc, documentTitle: documentTitle || proposal.doc.documentTitle }} />
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate">
                    This proposal is still markdown-only. Refresh formatted documents to generate the letter layout, PDF, and Word file.
                  </p>
                )}
                <DocumentDownloads
                  docs={(detail.data?.documents ?? []).filter(
                    (doc) => doc.entity === "proposal" && doc.entity_id === proposal.id,
                  )}
                  onOpen={openDoc}
                />
                <Textarea
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  rows={24}
                  className="mt-4 font-mono text-sm"
                  aria-label="Proposal draft content"
                  data-testid="proposal-content"
                />
                <p className="mt-2 text-xs text-slate">
                  Status: {proposal.status.replace("_", " ")}
                  {proposal.client_response_note
                    ? ` · Client note: ${proposal.client_response_note}`
                    : ""}
                </p>
              </>
            ) : (
              <p className="mt-4 text-slate">No draft yet.</p>
            )}
          </div>

          <AdminEngagementPanel quoteId={id} proposalId={proposal?.id ?? null} />
        </div>


        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-background p-6 shadow-card">
            <h2 className="text-lg">Attachments</h2>
            {files.length === 0 ? (
              <p className="mt-3 text-sm text-slate">No files were attached.</p>
            ) : (
              <ul className="mt-3 space-y-3 text-sm">
                {files.map((file) => (
                  <li key={file.id} className="flex items-center justify-between gap-3">
                    <span className="truncate">{file.original_name}</span>
                    <button
                      type="button"
                      onClick={() => openFile(file.id)}
                      className="shrink-0 text-primary underline-offset-4 hover:underline"
                    >
                      Open ({formatBytes(file.byte_size)})
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-background p-6 shadow-card">
            <h2 className="text-lg">Activity</h2>
            <ul className="mt-3 space-y-3 text-sm text-slate">
              {audit.map((entry) => (
                <li key={entry.id}>
                  <span className="block text-foreground">{entry.action.replace(/[._]/g, " ")}</span>
                  {entry.actor_label ? `${entry.actor_label} · ` : ""}
                  {new Date(entry.created_at).toLocaleString()}
                </li>
              ))}
              {audit.length === 0 ? <li>No activity recorded yet.</li> : null}
            </ul>
          </div>
        </div>
      </div>
    </Section>
  );
}
