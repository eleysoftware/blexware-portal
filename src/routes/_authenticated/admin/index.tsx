import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { CreateTeamMemberCard } from "@/components/CreateTeamMemberCard";
import { DeleteProjectDialog } from "@/components/DeleteProjectDialog";
import { PageHero } from "@/components/PageHero";
import { Section } from "@/components/Section";
import { PaymentEnvironmentCard } from "@/components/admin/PaymentEnvironmentCard";
import { PaymentMethodSettingsCard } from "@/components/admin/PaymentMethodSettingsCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/documents/types";

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
  const [expanded, setExpanded] = useState<string[]>([]);

  const [converting, setConverting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NonNullable<
    typeof quotes.data
  >["quotes"][number] | null>(null);
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

  const handleDeleteConfirm = async (target: NonNullable<typeof quotes.data>["quotes"][number]) => {
    const id = target.id as string;
    const label = String(target.quote_number);
    setBusyId(id);
    try {
      await deleteQuote({ data: { id, confirmQuoteNumber: label } });
      toast.success(`${label} deleted.`);
      setDeleteTarget(null);
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
  const billing = quotes.data?.billing ?? {};

  // Quotes come back flat; the queue is presented grouped by client email.
  const clients = (() => {
    const map = new Map<
      string,
      {
        email: string;
        name: string;
        company: string | null;
        outstandingCents: number;
        lastActivity: string;
        quotes: NonNullable<typeof quotes.data>["quotes"];
      }
    >();
    for (const quote of quotes.data?.quotes ?? []) {
      const email = String(quote.contact_email ?? "").toLowerCase();
      const created = String(quote.created_at ?? "");
      const entry = map.get(email) ?? {
        email,
        name: String(quote.contact_name ?? email),
        company: (quote.company as string | null) ?? null,
        outstandingCents: 0,
        lastActivity: created,
        quotes: [],
      };
      entry.quotes.push(quote);
      entry.outstandingCents += billing[quote.id as string]?.outstandingCents ?? 0;
      if (created > entry.lastActivity) {
        entry.lastActivity = created;
        entry.name = String(quote.contact_name ?? email);
        entry.company = (quote.company as string | null) ?? null;
      }
      map.set(email, entry);
    }
    return [...map.values()].sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
  })();

  // A search that lands on a specific quote opens that client automatically.
  const searching = search.trim().length > 0;
  const isOpen = (email: string) =>
    expanded.includes(email) || (searching && clients.length <= 3) || clients.length === 1;


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
          <Button size="sm" asChild className="shadow-cta">
            <Link to="/admin/invoices/new">New invoice</Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilter("archived")}
            disabled={filter === "archived"}
          >
            View archived
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

        <div className="mt-8 space-y-4">
          {quotes.isLoading ? (
            <p className="text-slate">Loading clients…</p>
          ) : clients.length === 0 ? (
            <div className="rounded-2xl border border-border bg-background p-8 text-slate shadow-card">
              {viewingArchived
                ? "Nothing is archived right now."
                : "No clients match this view yet."}
            </div>
          ) : (
            clients.map((client) => {
              const open = isOpen(client.email);
              return (
                <div
                  key={client.email}
                  className="overflow-hidden rounded-2xl border border-border bg-background shadow-card"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpanded((current) =>
                        current.includes(client.email)
                          ? current.filter((value) => value !== client.email)
                          : [...current, client.email],
                      )
                    }
                    aria-expanded={open}
                    className="flex w-full flex-wrap items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-surface"
                  >
                    <span>
                      <span className="block font-semibold text-foreground">
                        {client.company ?? client.name}
                      </span>
                      <span className="block text-xs text-slate">
                        {client.name} · {client.email}
                      </span>
                    </span>
                    <span className="flex flex-wrap items-center gap-4 text-sm text-slate">
                      <span>
                        {client.quotes.length} project{client.quotes.length === 1 ? "" : "s"}
                      </span>
                      <span
                        className={
                          client.outstandingCents > 0 ? "font-semibold text-foreground" : undefined
                        }
                      >
                        {client.outstandingCents > 0
                          ? `${formatMoney(client.outstandingCents)} outstanding`
                          : "Nothing outstanding"}
                      </span>
                      <span className="text-xs">
                        Last activity {new Date(client.lastActivity).toLocaleDateString()}
                      </span>
                      <span aria-hidden>{open ? "▴" : "▾"}</span>
                    </span>
                  </button>

                  {open ? (
                    <div className="overflow-x-auto border-t border-border">
                      <table className="w-full min-w-[860px] text-left text-sm">
                        <thead className="border-b border-border text-xs uppercase tracking-wide text-slate">
                          <tr>
                            <th className="px-5 py-3">Quote</th>
                            <th className="px-5 py-3">Project</th>
                            <th className="px-5 py-3">Budget</th>
                            <th className="px-5 py-3">Status</th>
                            <th className="px-5 py-3">Outstanding</th>
                            <th className="px-5 py-3">Received</th>
                            <th className="px-5 py-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {client.quotes.map((quote) => {
                            const id = quote.id as string;
                            const label = String(quote.quote_number);
                            const archived = Boolean(quote.deleted_at);
                            const owed = billing[id]?.outstandingCents ?? 0;
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
                                <td className="px-5 py-4 text-slate">
                                  {quote.project_type} · {quote.industry}
                                </td>
                                <td className="px-5 py-4 text-slate">{quote.budget}</td>
                                <td className="px-5 py-4">
                                  <span className="flex flex-wrap items-center gap-2">
                                    <Badge variant="secondary">
                                      {
                                        quoteStatusLabels[
                                          quote.status as keyof typeof quoteStatusLabels
                                        ]
                                      }
                                    </Badge>
                                    {archived ? <Badge variant="outline">Archived</Badge> : null}
                                  </span>
                                </td>
                                <td className="px-5 py-4 text-slate">
                                  {owed > 0 ? formatMoney(owed) : "—"}
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
                                      <DeleteProjectDialog
                                        quoteNumber={label}
                                        contactName={String(quote.contact_name ?? "")}
                                        contactEmail={String(quote.contact_email ?? "")}
                                        company={quote.company as string | null | undefined}
                                        hasSignedSow={false}
                                        hasInvoices={Boolean(billing[id]?.billedCents)}
                                        onConfirm={() => handleDeleteConfirm(quote)}
                                      >
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="text-destructive"
                                          disabled={busyId === id}
                                        >
                                          Delete
                                        </Button>
                                      </DeleteProjectDialog>
                                    ) : null}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>


        <PaymentEnvironmentCard />

        <PaymentMethodSettingsCard />

        <CreateTeamMemberCard />
      </Section>
    </>
  );
}
