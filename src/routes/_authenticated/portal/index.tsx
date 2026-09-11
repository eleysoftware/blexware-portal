import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { PageHero } from "@/components/PageHero";
import { Section } from "@/components/Section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getViewerRole } from "@/lib/auth.functions";
import { formatMoney } from "@/lib/documents/types";

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

  const totals = quotes.data?.totals;
  const billing = quotes.data?.billing ?? {};
  const invoices = quotes.data?.invoices ?? {};


  return (
    <>
      <PageHero
        eyebrow="Client portal"
        title="Your projects"
        description={`Signed in as ${role.data?.email ?? ""}. Quotes submitted with this email address appear here.`}
      />
      <Section tone="surface">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          {totals ? (
            <p className="text-sm text-slate" data-testid="account-billing-summary">
              <span className="font-semibold text-foreground">{formatMoney(totals.paidCents)}</span>{" "}
              paid to date ·{" "}
              <span className="font-semibold text-foreground">
                {formatMoney(totals.outstandingCents)}
              </span>{" "}
              currently outstanding
            </p>
          ) : (
            <span />
          )}
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
            {quotes.data?.quotes.map((quote) => {
              const money = billing[quote.id as string];
              const rows = invoices[quote.id as string] ?? [];
              return (
                <li
                  key={quote.id}
                  className="rounded-2xl border border-border bg-background p-6 shadow-card"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <Link
                        to="/portal/quotes/$id"
                        params={{ id: quote.id as string }}
                        className="text-sm font-semibold text-foreground hover:text-primary"
                      >
                        {quote.quote_number} — {quote.project_type}
                      </Link>
                      <p className="mt-1 text-xs text-slate">
                        {quote.industry} · {quote.budget} · {quote.timeline}
                      </p>
                      <p className="mt-2 text-xs">
                        {!money || money.billedCents === 0 ? (
                          <span className="text-slate">No invoices yet</span>
                        ) : money.outstandingCents === 0 ? (
                          <span className="text-slate">
                            Paid in full · {formatMoney(money.paidCents)}
                          </span>
                        ) : (
                          <span
                            className={
                              money.payableCount ? "font-semibold text-primary" : "text-slate"
                            }
                          >
                            {formatMoney(money.outstandingCents)} outstanding
                            {money.payableCount
                              ? ` · ${money.payableCount} invoice${money.payableCount === 1 ? "" : "s"} to pay`
                              : ""}
                            {money.overdueCount ? " · overdue" : ""}
                          </span>
                        )}
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {quoteStatusLabels[quote.status as QuoteStatus] ?? quote.status}
                    </Badge>
                  </div>

                  {rows.length ? (
                    <details className="mt-4 border-t border-border pt-3" open={rows.length <= 6}>
                      <summary className="cursor-pointer text-xs font-medium text-slate">
                        {rows.length} invoice{rows.length === 1 ? "" : "s"} on this project
                      </summary>
                      <ul className="mt-3 space-y-2" data-testid="portal-project-invoices">
                        {rows.map((invoice) => {
                          const balance = Math.max(
                            0,
                            invoice.amountCents - invoice.amountPaidCents,
                          );
                          return (
                            <li
                              key={invoice.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/40 px-3 py-2 text-xs"
                            >
                              <span className="font-medium text-foreground">
                                {invoice.invoiceNumber}
                              </span>
                              <span className="text-slate">
                                {invoice.issueDate ? `Issued ${invoice.issueDate}` : "Scheduled"}
                                {invoice.dueDate ? ` · due ${invoice.dueDate}` : ""}
                              </span>
                              <span className="text-foreground">
                                {formatMoney(invoice.amountCents)}
                                {balance === 0 ? " · paid" : ""}
                              </span>
                              {invoice.payToken ? (
                                <Button size="sm" asChild>
                                  <Link
                                    to="/invoice/$token"
                                    params={{ token: invoice.payToken }}
                                    search={{ return: "/portal" }}
                                  >
                                    Pay {formatMoney(balance)}
                                  </Link>
                                </Button>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    </details>
                  ) : null}

                  <div className="mt-4">
                    <Link
                      to="/portal/quotes/$id"
                      params={{ id: quote.id as string }}
                      className="text-xs text-primary underline"
                    >
                      Open project
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>

        )}
      </Section>
    </>
  );
}

