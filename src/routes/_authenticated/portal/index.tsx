import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { PageHero } from "@/components/PageHero";
import { Section } from "@/components/Section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getViewerRole } from "@/lib/auth.functions";
import { listMyQuotes } from "@/lib/portal.functions";
import { quoteStatusLabels, type QuoteStatus } from "@/lib/quote-schema";

export const Route = createFileRoute("/_authenticated/portal/")({
  head: () => ({
    meta: [{ title: "Your projects — BLEXware" }, { name: "robots", content: "noindex" }],
  }),
  component: PortalHome,
});

function PortalHome() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const viewer = useServerFn(getViewerRole);
  const fetchQuotes = useServerFn(listMyQuotes);

  const role = useQuery({ queryKey: ["viewer-role"], queryFn: () => viewer({ data: {} }) });
  const quotes = useQuery({
    queryKey: ["my-quotes"],
    queryFn: () => fetchQuotes({ data: {} }),
    enabled: role.data?.isClient === true,
  });

  const signOut = async () => {
    await supabase.auth.signOut();
    queryClient.clear();
    navigate({ to: "/auth" });
  };

  if (role.isLoading) {
    return (
      <Section>
        <p className="text-slate">Loading your account…</p>
      </Section>
    );
  }

  if (role.data?.isStaff) {
    return (
      <Section>
        <p className="text-slate">
          This account is a BLEXware team account.{" "}
          <Link to="/admin" className="text-primary underline">
            Go to the quote queue
          </Link>
          .
        </p>
      </Section>
    );
  }

  return (
    <>
      <PageHero
        eyebrow="Client portal"
        title="Your projects"
        description={`Signed in as ${role.data?.email ?? ""}. Quotes submitted with this email address appear here.`}
      />
      <Section tone="surface">
        <div className="mb-6 flex justify-end">
          <Button variant="outline" onClick={signOut}>
            Sign out
          </Button>
        </div>

        {quotes.isLoading ? (
          <p className="text-slate">Loading your quotes…</p>
        ) : (quotes.data?.quotes.length ?? 0) === 0 ? (
          <div className="rounded-2xl border border-border bg-background p-8 text-center">
            <p className="text-slate">
              No quote requests yet for this email address.{" "}
              <Link to="/free-quote" className="text-primary underline">
                Request a free quote
              </Link>
              .
            </p>
          </div>
        ) : (
          <ul className="grid gap-4">
            {quotes.data?.quotes.map((quote) => (
              <li key={quote.id}>
                <Link
                  to="/portal/quotes/$id"
                  params={{ id: quote.id as string }}
                  className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-6 shadow-card transition-colors hover:border-primary/40 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {quote.quote_number} — {quote.project_type}
                    </p>
                    <p className="mt-1 text-xs text-slate">
                      {quote.industry} · {quote.budget} · {quote.timeline}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {quoteStatusLabels[quote.status as QuoteStatus] ?? quote.status}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
