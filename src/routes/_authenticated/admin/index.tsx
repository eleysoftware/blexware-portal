import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { CreateTeamMemberCard } from "@/components/CreateTeamMemberCard";
import { PageHero } from "@/components/PageHero";
import { Section } from "@/components/Section";
import { PaymentMethodSettingsCard } from "@/components/admin/PaymentMethodSettingsCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  archiveQuote,
  deleteQuotePermanently,
  getAdminStatus,
  listQuotes,
  refreshProposalDocuments,
} from "@/lib/admin.functions";
import { quoteStatusLabels, quoteStatuses } from "@/lib/quote-schema";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [{ title: "Quote queue — BLEXware team" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const status = useServerFn(getAdminStatus);
  const fetchQuotes = useServerFn(listQuotes);
  const setArchived = useServerFn(archiveQuote);
  const deleteQuote = useServerFn(deleteQuotePermanently);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [converting, setConverting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const convertProposals = useServerFn(refreshProposalDocuments);

  const access = useQuery({ queryKey: ["admin-status"], queryFn: () => status({ data: {} }) });
  const quotes = useQuery({
    queryKey: ["quotes", filter, search],
    queryFn: () => fetchQuotes({ data: { status: filter, search } }),
    enabled: access.data?.isAdmin === true,
  });

  const signOut = async () => {
    await supabase.auth.signOut();
    queryClient.clear();
    navigate({ to: "/auth" });
  };

  const toggleArchive = async (id: string, archived: boolean, label: string) => {
    if (archived && !window.confirm(`Archive ${label}? You can restore it from the Archived view.`)) {
      return;
    }
    setBusyId(id);
    try {
      await setArchived({ data: { id, archived } });
      toast.success(archived ? `${label} archived.` : `${label} restored.`);
      void queryClient.invalidateQueries({ queryKey: ["quotes"] });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const permanentlyDelete = async (id: string, label: string) => {
    const typed = window.prompt(
      `This permanently deletes ${label} and everything attached to it. Type the quote number to confirm.`,
    );
    if (!typed) return;
    setBusyId(id);
    try {
      await deleteQuote({ data: { id, confirmQuoteNumber: typed } });
      toast.success(`${label} deleted.`);
      void queryClient.invalidateQueries({ queryKey: ["quotes"] });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  if (access.isLoading) {
    return (
      <Section>
        <p className="text-slate">Checking your access…</p>
      </Section>
    );
  }

  if (!access.data?.isAdmin) {
    return (
      <>
        <PageHero
          eyebrow="Team portal"
          title="No team access"
          description="This account isn't a BLEXware team account."
        />
        <Section>
          <div className="flex flex-wrap gap-3">
            <Button asChild className="shadow-cta">
              <Link to="/portal">Go to your client portal</Link>
            </Button>
            <Button variant="outline" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </Section>
      </>
    );
  }

  const counts = quotes.data?.counts ?? {};
  const viewingArchived = filter === "archived";

  return (
    <>
      <PageHero
        eyebrow="Team portal"
        title="Quote queue"
        description="Every inbound request, its attachments, and the proposal drafts your team reviews before anything reaches a client."
      >
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate">
          <span>Signed in as {access.data.email}</span>
          <Button variant="outline" size="sm" onClick={signOut}>
            Sign out
          </Button>
          <Button variant="secondary" size="sm" asChild>
            <Link to="/admin/import">Import existing project</Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={converting}
            onClick={async () => {
              setConverting(true);
              try {
                const result = await convertProposals({ data: {} });
                toast.success(
                  result.converted
                    ? `Converted ${result.converted} proposal${result.converted === 1 ? "" : "s"}`
                    : "No markdown-only proposals left to convert",
                );
                void queryClient.invalidateQueries({ queryKey: ["quotes"] });
              } catch (error) {
                toast.error((error as Error).message);
              } finally {
                setConverting(false);
              }
            }}
          >
            {converting ? "Converting…" : "Convert existing proposals"}
          </Button>
        </div>
      </PageHero>

      <Section tone="surface">
        <div className="flex flex-wrap items-center gap-2">
          {["all", ...quoteStatuses, "archived"].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                filter === value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-slate hover:border-primary/50"
              }`}
            >
              {value === "all"
                ? "All"
                : value === "archived"
                  ? "Archived"
                  : quoteStatusLabels[value as keyof typeof quoteStatusLabels]}
              {value !== "all" && counts[value] ? ` (${counts[value]})` : ""}
            </button>
          ))}
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, email, company, quote #"
            className="ml-auto w-full max-w-xs"
            aria-label="Search quotes"
          />
        </div>

        <div className="mt-8 overflow-x-auto rounded-2xl border border-border bg-background shadow-card">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-slate">
              <tr>
                <th className="px-5 py-4">Quote</th>
                <th className="px-5 py-4">Contact</th>
                <th className="px-5 py-4">Project</th>
                <th className="px-5 py-4">Budget</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Received</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {quotes.isLoading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-slate">
                    Loading quotes…
                  </td>
                </tr>
              ) : (quotes.data?.quotes.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-slate">
                    {viewingArchived
                      ? "Nothing is archived right now."
                      : "No quote requests match this view yet."}
                  </td>
                </tr>
              ) : (
                quotes.data?.quotes.map((quote) => {
                  const id = quote.id as string;
                  const label = String(quote.quote_number);
                  const archived = Boolean(quote.deleted_at);
                  return (
                    <tr key={id} className="border-b border-border/60 last:border-0">
                      <td className="px-5 py-4 font-medium">
                        <Link
                          to="/admin/quotes/$id"
                          params={{ id }}
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          {label}
                        </Link>
                      </td>
                      <td className="px-5 py-4">
                        <span className="block">{quote.contact_name}</span>
                        <span className="text-xs text-slate">
                          {quote.company ?? quote.contact_email}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate">
                        {quote.project_type} · {quote.industry}
                      </td>
                      <td className="px-5 py-4 text-slate">{quote.budget}</td>
                      <td className="px-5 py-4">
                        <span className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">
                            {quoteStatusLabels[quote.status as keyof typeof quoteStatusLabels]}
                          </Badge>
                          {archived ? <Badge variant="outline">Archived</Badge> : null}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate">
                        {new Date(quote.created_at as string).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-4">
                        <span className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busyId === id}
                            onClick={() => void toggleArchive(id, !archived, label)}
                          >
                            {archived ? "Restore" : "Archive"}
                          </Button>
                          {archived ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              disabled={busyId === id}
                              onClick={() => void permanentlyDelete(id, label)}
                            >
                              Delete
                            </Button>
                          ) : null}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <PaymentMethodSettingsCard />

        <CreateTeamMemberCard />
      </Section>
    </>
  );
}
