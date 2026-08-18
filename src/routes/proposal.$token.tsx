import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { PageHero } from "@/components/PageHero";
import { Section } from "@/components/Section";
import { DocumentDownloads } from "@/components/DocumentDownloads";
import { DocumentPreview } from "@/components/DocumentPreview";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getProposalByToken, getProposalDocumentUrl, respondToProposal } from "@/lib/proposals.functions";

const title = "Your BLEXware proposal";
const description = "Review, approve, or request changes to the proposal drafted for your project.";

export const Route = createFileRoute("/proposal/$token")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProposalReviewPage,
});

function ProposalReviewPage() {
  const { token } = Route.useParams();
  const fetchProposal = useServerFn(getProposalByToken);
  const fetchDocUrl = useServerFn(getProposalDocumentUrl);
  const respond = useServerFn(respondToProposal);
  const [note, setNote] = useState("");

  const query = useQuery({
    queryKey: ["proposal", token],
    queryFn: () => fetchProposal({ data: { token } }),
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: (action: "approved" | "changes_requested" | "declined") =>
      respond({ data: { token, action, note } }),
    onSuccess: () => {
      toast.success("Thank you — your response was sent to the BLEXware team.");
      void query.refetch();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (query.isLoading) {
    return (
      <Section>
        <p className="text-slate">Loading your proposal…</p>
      </Section>
    );
  }

  if (query.isError || !query.data?.proposal) {
    return (
      <>
        <PageHero
          eyebrow="Proposal"
          title="This link is no longer active"
          description="Reach out to your BLEXware contact and we'll send a fresh review link."
        />
      </>
    );
  }

  const { proposal, quote } = query.data;
  const responded = proposal.status !== "sent";

  const openDoc = async (documentId: string) => {
    try {
      const { url } = await fetchDocUrl({ data: { token, documentId } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <>
      <PageHero
        eyebrow={quote ? quote.number : "Proposal"}
        title={quote ? `Proposal for ${quote.name}` : title}
        description={
          quote ? `${quote.projectType} · prepared by the BLEXware team` : description
        }
      />
      <Section tone="surface">
        <div className="mx-auto max-w-[8.5in] overflow-hidden rounded-2xl border border-border bg-background shadow-card">
          {proposal.doc ? (
            <DocumentPreview doc={proposal.doc} />
          ) : (
            <article className="whitespace-pre-wrap p-8 leading-relaxed">{proposal.content}</article>
          )}
        </div>
        <div className="mx-auto max-w-[8.5in]">
          <DocumentDownloads docs={query.data.documents ?? []} onOpen={openDoc} />
        </div>

        <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-border bg-background p-8 shadow-card">
          {responded ? (
            <p className="text-slate">
              You responded: <strong className="text-foreground">{proposal.status.replace("_", " ")}</strong>
              {proposal.note ? ` — “${proposal.note}”` : ""}
            </p>
          ) : (
            <>
              <h2 className="text-xl">Your response</h2>
              <Textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={5}
                className="mt-4"
                placeholder="Optional: anything you'd like adjusted before we start."
                aria-label="Response note"
              />
              <div className="mt-5 flex flex-wrap gap-3">
                <Button
                  className="shadow-cta"
                  onClick={() => mutation.mutate("approved")}
                  disabled={mutation.isPending}
                >
                  Approve proposal
                </Button>
                <Button
                  variant="outline"
                  onClick={() => mutation.mutate("changes_requested")}
                  disabled={mutation.isPending}
                >
                  Request changes
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => mutation.mutate("declined")}
                  disabled={mutation.isPending}
                >
                  Decline
                </Button>
              </div>
            </>
          )}
        </div>
      </Section>
    </>
  );
}
