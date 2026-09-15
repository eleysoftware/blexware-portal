import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { CreateTeamMemberCard } from "@/components/CreateTeamMemberCard";
import { CleanupTestClientsDialog } from "@/components/admin/CleanupTestClientsDialog";
import { DeleteProjectDialog } from "@/components/DeleteProjectDialog";
import { PageHero } from "@/components/PageHero";
import { Section } from "@/components/Section";
import { EditClientDialog } from "@/components/admin/EditClientDialog";
import { PaymentEnvironmentCard } from "@/components/admin/PaymentEnvironmentCard";
import { InvoiceStatusControl } from "@/components/admin/InvoiceStatusControl";
import { PaymentMethodSettingsCard } from "@/components/admin/PaymentMethodSettingsCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/documents/types";
import { describeEmailFailure, isOutOfCredits } from "@/lib/email-failure";

import {
  archiveQuote,
  deleteQuotePermanently,
  getAdminStatus,
  getCronHeartbeat,
  listQuotes,
  refreshProposalDocuments,
  setQuoteTestFlag,
} from "@/lib/admin.functions";
import { sendInvoiceNow } from "@/lib/engagement.functions";
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
  const [resending, setResending] = useState<string | null>(null);
  const resendInvoice = useServerFn(sendInvoiceNow);
  const fetchHeartbeat = useServerFn(getCronHeartbeat);

  const handleResend = async (invoiceId: string) => {
    setResending(invoiceId);
    try {
      const result = await resendInvoice({ data: { invoiceId } });
      if (result.emailed) toast.success("Invoice emailed to the client.");
      else {
        const failure = describeEmailFailure(result.reason);
        toast.error(`${failure.headline}. ${failure.action}`);
      }
      void queryClient.invalidateQueries({ queryKey: ["quotes"] });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setResending(null);
    }
  };

  /** Hand the client's own invoice link to the team, e.g. to send it manually. */
  const copyPayLink = async (payToken: string, invoiceNumber: string) => {
    const url = `${window.location.origin}/invoice/${payToken}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(`Payment link for ${invoiceNumber} copied.`);
    } catch {
      window.prompt(`Copy the payment link for ${invoiceNumber}`, url);
    }
  };

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
  const heartbeat = useQuery({
    queryKey: ["cron-heartbeat"],
    queryFn: () => fetchHeartbeat(),
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
  const invoicesByQuote = quotes.data?.invoicesByQuote ?? {};
  const hasProposal = quotes.data?.hasProposal ?? {};
  // One warning beats discovering the same provider problem invoice by invoice.
  const creditsBlocked = Object.values(invoicesByQuote).some((rows) =>
    rows.some((invoice) => isOutOfCredits(invoice.deliveryError)),
  );

  // Quotes come back flat; the queue is presented grouped by client email.
  const clients = (() => {
    const map = new Map<
      string,
      {
        email: string;
        name: string;
        company: string | null;
        phone: string | null;
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
        phone: (quote.phone as string | null) ?? null,
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
        entry.phone = (quote.phone as string | null) ?? null;
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
          <span data-testid="cron-heartbeat">
            {heartbeat.data?.heartbeat
              ? `Scheduled invoice mail last ran ${new Date(
                  heartbeat.data.heartbeat.ranAt ?? "",
                ).toLocaleString()} — ${heartbeat.data.heartbeat.invoicesSent} sent${
                  heartbeat.data.heartbeat.invoicesFailed
                    ? `, ${heartbeat.data.heartbeat.invoicesFailed} failed`
                    : ""
                }`
              : "Scheduled invoice mail: no run recorded yet"}
          </span>
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
        {creditsBlocked ? (
          <div
            role="status"
            data-testid="email-credits-warning"
            className="mb-6 rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm"
          >
            <p className="font-medium text-destructive">
              Invoice emails are not going out — the email account is out of sending credits.
            </p>
            <p className="mt-1 text-slate">
              Top up the sending credits in ZeptoMail, then press Retry on the affected invoices.
              In the meantime you can copy a payment link and send it yourself.
            </p>
          </div>
        ) : null}
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

                  <div className="flex justify-end px-5 pb-3">
                    <EditClientDialog
                      currentEmail={client.email}
                      contactName={client.name}
                      company={client.company}
                      phone={client.phone}
                      projectCount={client.quotes.length}
                      otherEmails={clients
                        .map((entry) => entry.email)
                        .filter((value) => value !== client.email)}
                    >
                      <Button variant="ghost" size="sm">
                        Edit client
                      </Button>
                    </EditClientDialog>
                  </div>

                  {open ? (
                    <div className="divide-y divide-border border-t border-border">
                      {(() => {
                        const shells = client.quotes.filter(
                          (quote) =>
                            !(invoicesByQuote[quote.id as string] ?? []).length &&
                            !hasProposal[quote.id as string],
                        );
                        const active = client.quotes.filter((quote) => !shells.includes(quote));
                        return (
                          <>
                            {active.map((quote) => {
                              const id = quote.id as string;
                              const label = String(quote.quote_number);
                              const archived = Boolean(quote.deleted_at);
                              const owed = billing[id]?.outstandingCents ?? 0;
                              const rows = invoicesByQuote[id] ?? [];
                              return (
                                <div key={id} className="px-5 py-4">
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                      <Link
                                        to="/admin/quotes/$id"
                                        params={{ id }}
                                        className="font-medium text-primary underline-offset-4 hover:underline"
                                      >
                                        {label} — {quote.project_type}
                                      </Link>
                                      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate">
                                        <Badge variant="secondary">
                                          {
                                            quoteStatusLabels[
                                              quote.status as keyof typeof quoteStatusLabels
                                            ]
                                          }
                                        </Badge>
                                        {archived ? <Badge variant="outline">Archived</Badge> : null}
                                        <span>
                                          Started{" "}
                                          {new Date(
                                            quote.created_at as string,
                                          ).toLocaleDateString()}
                                        </span>
                                        <span>
                                          {owed > 0
                                            ? `${formatMoney(owed)} outstanding`
                                            : "Nothing outstanding"}
                                        </span>
                                      </p>
                                    </div>
                                    <div className="flex gap-2">
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
                                    </div>
                                  </div>

                                  {rows.length ? (
                                    <ul
                                      className="mt-3 space-y-2 border-l-2 border-border pl-4"
                                      data-testid="admin-project-invoices"
                                    >
                                      {rows.map((invoice) => {
                                        const balance = Math.max(
                                          0,
                                          invoice.amountCents - invoice.amountPaidCents,
                                        );
                                        const failure = invoice.deliveryError
                                          ? describeEmailFailure(invoice.deliveryError)
                                          : null;
                                        return (
                                          <li
                                            key={invoice.id}
                                            className="flex flex-wrap items-center justify-between gap-3 text-sm"
                                          >
                                            <span className="flex flex-wrap items-center gap-2">
                                              <span className="font-medium">
                                                {invoice.invoiceNumber}
                                              </span>
                                              <Badge variant="outline">{invoice.status}</Badge>
                                              {invoice.status === "scheduled" ? (
                                                <span className="text-xs text-slate">
                                                  Client can't open this link yet — set it to Sent.
                                                </span>
                                              ) : null}
                                              {failure ? (
                                                <Badge
                                                  variant="destructive"
                                                  title={`${failure.action} (${invoice.deliveryError})`}
                                                >
                                                  {failure.headline}
                                                </Badge>
                                              ) : null}
                                              <span className="text-xs text-slate">
                                                {invoice.issueDate
                                                  ? `Issued ${invoice.issueDate}`
                                                  : "Not issued"}
                                                {invoice.dueDate ? ` · due ${invoice.dueDate}` : ""}
                                              </span>
                                            </span>
                                            <span className="flex items-center gap-3 text-slate">
                                              <span className="font-medium text-foreground">
                                                {formatMoney(invoice.amountCents)}
                                              </span>
                                              <span className="text-xs">
                                                {balance > 0
                                                  ? `${formatMoney(balance)} due`
                                                  : "Paid"}
                                              </span>
                                              {invoice.deliveryError ||
                                              invoice.status === "draft" ||
                                              invoice.status === "scheduled" ? (
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  disabled={resending === invoice.id}
                                                  onClick={() => void handleResend(invoice.id)}
                                                >
                                                  {resending === invoice.id
                                                    ? "Sending…"
                                                    : invoice.deliveryError
                                                      ? "Retry"
                                                      : "Send now"}
                                                </Button>
                                              ) : null}
                                              <InvoiceStatusControl
                                                invoiceId={invoice.id}
                                                invoiceNumber={invoice.invoiceNumber}
                                                status={invoice.status}
                                              />
                                              {invoice.payToken ? (
                                                <>
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() =>
                                                      void copyPayLink(
                                                        invoice.payToken as string,
                                                        invoice.invoiceNumber,
                                                      )
                                                    }
                                                  >
                                                    Copy payment link
                                                  </Button>
                                                  <Link
                                                    to="/invoice/$token"
                                                    params={{ token: invoice.payToken }}
                                                    search={{ return: "/admin" }}
                                                    className="text-primary underline-offset-4 hover:underline"
                                                  >
                                                    Open
                                                  </Link>
                                                </>
                                              ) : null}
                                            </span>
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  ) : (
                                    <p className="mt-3 border-l-2 border-border pl-4 text-sm text-slate">
                                      No invoices yet
                                    </p>
                                  )}
                                </div>
                              );
                            })}

                            {shells.length ? (
                              <div className="px-5 py-4 text-sm text-slate">
                                <p className="font-medium text-foreground">
                                  {shells.length} unused project shell
                                  {shells.length === 1 ? "" : "s"}
                                </p>
                                <p className="mt-1 text-xs">
                                  No invoices and no proposal — safe to archive.
                                </p>
                                <ul className="mt-2 space-y-1">
                                  {shells.map((quote) => {
                                    const id = quote.id as string;
                                    const label = String(quote.quote_number);
                                    const archived = Boolean(quote.deleted_at);
                                    return (
                                      <li
                                        key={id}
                                        className="flex flex-wrap items-center justify-between gap-2"
                                      >
                                        <Link
                                          to="/admin/quotes/$id"
                                          params={{ id }}
                                          className="text-primary underline-offset-4 hover:underline"
                                        >
                                          {label} — {quote.project_type}
                                        </Link>
                                        <span className="flex gap-2">
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
                                              hasInvoices={false}
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
                                      </li>
                                    );
                                  })}
                                </ul>
                              </div>
                            ) : null}
                          </>
                        );
                      })()}
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
