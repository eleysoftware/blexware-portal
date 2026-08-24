import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { EngagementPanel } from "@/components/EngagementPanel";
import { DocumentDownloads } from "@/components/DocumentDownloads";
import { DocumentPreview } from "@/components/DocumentPreview";
import { Section } from "@/components/Section";
import { NextStepBanner } from "@/components/NextStepBanner";
import { StageRail } from "@/components/StageRail";
import { TabIntro } from "@/components/TabIntro";
import { WorkspacePanel, WorkspaceTabs, type WorkspaceTab } from "@/components/WorkspaceTabs";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getMyDocumentUrl } from "@/lib/client-engagement.functions";
import { respondToProposal } from "@/lib/proposals.functions";
import { getMyQuote, getMyQuoteFileUrl } from "@/lib/portal.functions";
import { quoteStatusLabels, type QuoteStatus } from "@/lib/quote-schema";
import { getNextStep, getTabPurpose } from "@/lib/workflow-guidance";

export const Route = createFileRoute("/_authenticated/portal/quotes/$id")({
  head: () => ({
    meta: [{ title: "Project details — BLEXware" }, { name: "robots", content: "noindex" }],
  }),
  component: PortalQuoteDetail,
});

function PortalQuoteDetail() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const fetchQuote = useServerFn(getMyQuote);
  const fetchFileUrl = useServerFn(getMyQuoteFileUrl);
  const fetchDocUrl = useServerFn(getMyDocumentUrl);
  const respond = useServerFn(respondToProposal);
  const [note, setNote] = useState("");
  const [tab, setTab] = useState("overview");

  const detail = useQuery({
    queryKey: ["my-quote", id],
    queryFn: () => fetchQuote({ data: { id } }),
  });

  // Land on the tab that needs the client's attention, once, on first load.
  const autoTabbed = useRef(false);
  const loadedStatus = detail.data?.quote?.status as QuoteStatus | undefined;
  useEffect(() => {
    if (!loadedStatus || autoTabbed.current) return;
    autoTabbed.current = true;
    const step = getNextStep(loadedStatus, "client");
    if (step.actionable) setTab(step.tab);
  }, [loadedStatus]);

  const respondMutation = useMutation({
    mutationFn: (action: "approved" | "changes_requested" | "declined") => {
      const token = detail.data?.proposal?.review_token;
      if (!token) throw new Error("No proposal to respond to");
      return respond({ data: { token, action, note } });
    },
    onSuccess: () => {
      toast.success("Thanks — your response has been recorded.");
      void queryClient.invalidateQueries({ queryKey: ["my-quote", id] });
      void queryClient.invalidateQueries({ queryKey: ["my-quotes"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const download = async (fileId: string) => {
    try {
      const { url } = await fetchFileUrl({ data: { fileId } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const openDoc = async (documentId: string) => {
    try {
      const { url } = await fetchDocUrl({ data: { documentId } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  if (detail.isLoading) {
    return (
      <Section>
        <p className="text-slate">Loading…</p>
      </Section>
    );
  }

  const quote = detail.data?.quote;
  if (!quote) {
    return (
      <Section>
        <p className="text-slate">
          We couldn't find that project on your account.{" "}
          <Link to="/portal" className="text-primary underline">
            Back to your projects
          </Link>
          .
        </p>
      </Section>
    );
  }

  const nextStep = getNextStep(quote.status as QuoteStatus, "client");
  const tabs: WorkspaceTab[] = [
    { id: "overview", label: "Overview" },
    { id: "proposal", label: "Proposal" },
    { id: "estimate", label: "Estimate" },
    { id: "sow", label: "SOW" },
    { id: "invoices", label: "Invoices" },
  ].map((item) =>
    item.id === nextStep.tab
      ? { ...item, state: nextStep.actionable ? ("action" as const) : ("pending" as const) }
      : item,
  );

  const proposal = detail.data?.proposal ?? null;
  const answered = proposal ? proposal.status !== "sent" : false;

  return (
    <Section>
      <Link to="/portal" className="text-sm text-primary underline">
        ← Your projects
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">
            {quote.quote_number} — {quote.project_type}
          </h1>
          <Badge variant="secondary">
            {quoteStatusLabels[quote.status as QuoteStatus] ?? quote.status}
          </Badge>
        </div>
        <StageRail className="w-full max-w-md" status={quote.status as QuoteStatus} />
      </div>

      <div className="mt-6">
        <NextStepBanner step={nextStep} onGoToTab={setTab} />
      </div>

      <div className="mt-8">
        <WorkspaceTabs tabs={tabs} value={tab} onChange={setTab} />
      </div>

      <div className="mt-6">
        <WorkspacePanel id="overview" active={tab === "overview"}>
          <TabIntro purpose={getTabPurpose("overview", "client")} />
          <div className="rounded-2xl border border-border bg-background p-6 shadow-card">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate">
              What you told us
            </h2>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              <Field label="Industry" value={quote.industry} />
              <Field label="Budget" value={quote.budget} />
              <Field label="Timeline" value={quote.timeline} />
              <Field label="Services" value={(quote.services ?? []).join(", ")} />
            </dl>
            <div className="mt-5 space-y-4 text-sm">
              <Field label="Goals" value={quote.goals} block />
              {quote.features ? <Field label="Features" value={quote.features} block /> : null}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background p-6 shadow-card">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate">
              Your attachments
            </h2>
            {(detail.data?.files.length ?? 0) === 0 ? (
              <p className="mt-3 text-sm text-slate">No files were attached.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {detail.data?.files.map((file) => (
                  <li key={file.id}>
                    <button
                      type="button"
                      onClick={() => download(file.id)}
                      className="text-sm text-primary underline"
                    >
                      {file.original_name}
                    </button>
                    <span className="ml-2 text-xs text-slate">
                      {(file.byte_size / 1024 / 1024).toFixed(1)} MB
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </WorkspacePanel>

        <WorkspacePanel id="proposal" active={tab === "proposal"}>
          <TabIntro purpose={getTabPurpose("proposal", "client")} />
          {proposal ? (
            <div className="rounded-2xl border border-border bg-background p-6 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate">
                  Your proposal
                </h2>
                <Badge variant="outline">{proposal.status.replace("_", " ")}</Badge>
              </div>
              <div className="mt-4 max-h-[36rem] overflow-y-auto rounded-xl border border-border">
                {proposal.doc ? (
                  <DocumentPreview doc={proposal.doc} />
                ) : (
                  <div className="whitespace-pre-wrap p-4 text-sm leading-relaxed text-foreground">
                    {proposal.content}
                  </div>
                )}
              </div>
              <DocumentDownloads docs={detail.data?.documents ?? []} onOpen={openDoc} />

              {answered ? (
                <p className="mt-6 text-sm text-slate">
                  You responded to this proposal
                  {proposal.responded_at
                    ? ` on ${new Date(proposal.responded_at).toLocaleDateString()}`
                    : ""}
                  . Reach out to your BLEXware contact if anything has changed.
                </p>
              ) : (
                <div className="mt-6 space-y-3 border-t border-border pt-6">
                  <label htmlFor="note" className="text-sm font-medium text-foreground">
                    Add a note (optional)
                  </label>
                  <Textarea
                    id="note"
                    value={note}
                    maxLength={2000}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Anything you'd like us to adjust?"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      className="shadow-cta"
                      data-testid="proposal-approve"
                      disabled={respondMutation.isPending}
                      onClick={() => respondMutation.mutate("approved")}
                    >
                      Approve proposal
                    </Button>
                    <Button
                      variant="outline"
                      disabled={respondMutation.isPending}
                      onClick={() => respondMutation.mutate("changes_requested")}
                    >
                      Request changes
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={respondMutation.isPending}
                      onClick={() => respondMutation.mutate("declined")}
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-slate">
              No proposal has been released for this project yet. We'll email you when it's ready.
            </div>
          )}
        </WorkspacePanel>

        <WorkspacePanel id="estimate" active={tab === "estimate"}>
          <TabIntro purpose={getTabPurpose("estimate", "client")} />
          <EngagementPanel quoteId={id} tab="estimate" />
        </WorkspacePanel>

        <WorkspacePanel id="sow" active={tab === "sow"}>
          <TabIntro purpose={getTabPurpose("sow", "client")} />
          <EngagementPanel quoteId={id} tab="sow" />
        </WorkspacePanel>

        <WorkspacePanel id="invoices" active={tab === "invoices"}>
          <TabIntro purpose={getTabPurpose("invoices", "client")} />
          <EngagementPanel quoteId={id} tab="invoices" />
        </WorkspacePanel>
      </div>
    </Section>
  );
}

function Field({ label, value, block }: { label: string; value?: string | null; block?: boolean }) {
  return (
    <div className={block ? "" : undefined}>
      <dt className="text-xs uppercase tracking-wide text-slate">{label}</dt>
      <dd className="mt-1 text-foreground">{value || "—"}</dd>
    </div>
  );
}
