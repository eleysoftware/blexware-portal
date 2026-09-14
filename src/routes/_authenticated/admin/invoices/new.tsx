import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { PageHero } from "@/components/PageHero";
import { Section } from "@/components/Section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createDirectInvoice,
  listClientProjects,
  listInvoiceClients,
} from "@/lib/direct-invoice.functions";

import { SPLIT_COUNTS, evenSplitRows } from "@/lib/documents/compose";
import { formatMoney } from "@/lib/documents/types";

export const Route = createFileRoute("/_authenticated/admin/invoices/new")({
  head: () => ({
    meta: [{ title: "New invoice — BLEXware team" }, { name: "robots", content: "noindex" }],
  }),
  component: NewInvoicePage,
});

type ItemRow = { label: string; qty: string; unit: string; note: string };
type SplitMode = "full" | "even" | "custom";
type CustomRow = { label: string; amount: string };

const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

const cents = (value: string) => Math.round(Number(value || 0) * 100);

function NewInvoicePage() {
  const navigate = useNavigate();
  const create = useServerFn(createDirectInvoice);
  const fetchClients = useServerFn(listInvoiceClients);
  const fetchProjects = useServerFn(listClientProjects);

  const clients = useQuery({
    queryKey: ["invoice-clients"],
    queryFn: () => fetchClients({ data: {} }),
  });

  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const projects = useQuery({
    queryKey: ["invoice-client-projects", contactEmail.trim().toLowerCase()],
    queryFn: () => fetchProjects({ data: { email: contactEmail.trim().toLowerCase() } }),
    enabled: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contactEmail.trim()),
  });

  const [existingQuoteId, setExistingQuoteId] = useState("");
  const touchedProject = useRef(false);

  // Default to the client's most recent project so a second bill for the same
  // job doesn't silently create a duplicate project.
  useEffect(() => {
    const first = projects.data?.projects[0];
    if (!touchedProject.current && first && !existingQuoteId) setExistingQuoteId(first.id);
  }, [projects.data, existingQuoteId]);

  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [projectType, setProjectType] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [description, setDescription] = useState("");
  const [issueDate, setIssueDate] = useState(today());
  const [dueDate, setDueDate] = useState(plusDays(7));
  const [rows, setRows] = useState<ItemRow[]>([{ label: "", qty: "1", unit: "", note: "" }]);

  const [discount, setDiscount] = useState("");
  const [splitMode, setSplitMode] = useState<SplitMode>("full");
  const [splitCount, setSplitCount] = useState(2);
  const [customRows, setCustomRows] = useState<CustomRow[]>([
    { label: "Deposit", amount: "" },
    { label: "Balance", amount: "" },
  ]);

  const lineItems = rows
    .filter((row) => row.label.trim() && row.unit.trim())
    .map((row) => {
      const quantity = Number(row.qty || 1);
      const amountCents = Math.round(cents(row.unit) * (Number.isFinite(quantity) ? quantity : 1));
      return {
        label: row.label.trim(),
        amountCents,
        ...(row.note.trim()
          ? { note: row.note.trim() }
          : quantity && quantity !== 1
            ? { note: `${quantity} × ${formatMoney(cents(row.unit))}` }
            : {}),
      };
    });

  const subtotalCents = lineItems.reduce((sum, item) => sum + item.amountCents, 0);
  const discountCents = Math.min(subtotalCents, Math.max(0, cents(discount)));
  const totalCents = subtotalCents - discountCents;

  const paymentRows = useMemo(() => {
    if (splitMode === "full") return [{ label: "Due on receipt", amountCents: totalCents }];
    if (splitMode === "even") return evenSplitRows(totalCents, splitCount);
    return customRows
      .filter((row) => row.amount.trim())
      .map((row, index) => ({
        label: row.label.trim() || `Payment ${index + 1}`,
        amountCents: cents(row.amount),
      }));
  }, [splitMode, splitCount, customRows, totalCents]);

  const scheduledTotal = paymentRows.reduce((sum, row) => sum + row.amountCents, 0);
  const balanced = scheduledTotal === totalCents;

  const applyClient = (email: string) => {
    touchedProject.current = false;
    setExistingQuoteId("");
    const match = clients.data?.clients.find((entry) => entry.email === email);
    if (!match) return;
    setContactEmail(match.email);
    setContactName(match.name);
    setCompany(match.company ?? "");
  };

  const mutation = useMutation({
    mutationFn: (sendNow: boolean) =>
      create({
        data: {
          ...(existingQuoteId ? { quoteId: existingQuoteId } : {}),
          contactName,
          contactEmail,
          company,
          phone,
          projectType,

          internalNotes,
          description,
          issueDate,
          dueDate,
          lineItems,
          discountCents,
          paymentKind: splitMode === "full" ? "full" : "custom",
          ...(splitMode === "full" ? {} : { customPayments: paymentRows }),
          sendNow,
        },
      }),
    onSuccess: (result) => {
      const later = result.scheduledCount
        ? ` The remaining ${result.scheduledCount} payment${
            result.scheduledCount === 1 ? "" : "s"
          } will be emailed on their due dates.`
        : "";
      if (result.deliveryError) {
        toast.error(
          `We couldn't email invoice ${result.firstInvoiceNumber ?? ""}: ${result.deliveryError}. Use Retry on the project page.`,
        );
      } else {
        toast.success(
          result.sent
            ? `Invoice ${result.firstInvoiceNumber ?? ""} sent to the client.${later}`
            : `Created ${result.invoiceCount} invoice${result.invoiceCount === 1 ? "" : "s"}.${later}`,
        );
      }
      navigate({ to: "/admin/quotes/$id", params: { id: result.quoteId } });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const missing: string[] = [];
  if (!contactName.trim()) missing.push("the client's name");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contactEmail.trim())) missing.push("a valid client email");
  if (!description.trim()) missing.push("a description for the invoice");
  if (!lineItems.length || totalCents <= 0) missing.push("at least one priced line");
  if (!balanced) missing.push("payments that add up to the total");

  const canSubmit = missing.length === 0 && !mutation.isPending;

  return (
    <>
      <PageHero
        eyebrow="Team"
        title="New invoice"
        description="Bill a client directly — no quote, proposal or Statement of Work needed. Split it into several payments if you like."
      />
      <Section>
        <div className="mx-auto max-w-3xl space-y-8">
          <div className="rounded-2xl border border-border bg-background p-6 shadow-card">
            <h2 className="text-xl">Client</h2>
            {clients.data?.clients.length ? (
              <label className="mt-4 block text-sm font-medium">
                Existing client
                <select
                  className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                  defaultValue=""
                  onChange={(event) => applyClient(event.target.value)}
                >
                  <option value="">New client…</option>
                  {clients.data.clients.map((entry) => (
                    <option key={entry.email} value={entry.email}>
                      {entry.company ? `${entry.company} — ` : ""}
                      {entry.name} ({entry.email})
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">
                Contact name
                <Input
                  className="mt-1"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                />
              </label>
              <label className="text-sm font-medium">
                Contact email
                <Input
                  className="mt-1"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                />
              </label>
              <label className="text-sm font-medium">
                Company
                <Input className="mt-1" value={company} onChange={(e) => setCompany(e.target.value)} />
              </label>
              <label className="text-sm font-medium">
                Phone
                <Input className="mt-1" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background p-6 shadow-card">
            <h2 className="text-xl">Project</h2>
            {projects.data?.projects.length ? (
              <div className="mt-4 space-y-3">
                <p className="text-sm font-medium">Where should this invoice go?</p>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    className="mt-1"
                    name="project-choice"
                    checked={Boolean(existingQuoteId)}
                    onChange={() => {
                      touchedProject.current = true;
                      setExistingQuoteId(projects.data?.projects[0]?.id ?? "");
                    }}
                  />
                  <span>
                    Add to an existing project
                    <span className="block text-xs text-slate">
                      Keeps this bill alongside the client's other invoices in their portal.
                    </span>
                  </span>
                </label>
                {existingQuoteId ? (
                  <select
                    className="ml-6 h-10 w-[calc(100%-1.5rem)] rounded-md border border-border bg-background px-3 text-sm"
                    value={existingQuoteId}
                    onChange={(event) => {
                      touchedProject.current = true;
                      setExistingQuoteId(event.target.value);
                    }}
                  >
                    {projects.data.projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.quoteNumber} — {project.name}
                      </option>
                    ))}
                  </select>
                ) : null}
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    className="mt-1"
                    name="project-choice"
                    checked={!existingQuoteId}
                    onChange={() => {
                      touchedProject.current = true;
                      setExistingQuoteId("");
                    }}
                  />
                  <span>
                    Start a new project
                    <span className="block text-xs text-slate">
                      Only for genuinely new work — it appears as a separate card in the portal.
                    </span>
                  </span>
                </label>
                <p className="text-xs text-slate">
                  {existingQuoteId
                    ? `This invoice will appear under ${
                        projects.data.projects.find((p) => p.id === existingQuoteId)?.quoteNumber ??
                        "the selected project"
                      }.`
                    : "This invoice will create a new project for this client."}
                </p>
              </div>
            ) : null}
            {existingQuoteId ? null : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-medium">
                  Project name
                  <Input
                    className="mt-1"
                    placeholder="e.g. Website maintenance — Q3"
                    value={projectType}
                    onChange={(e) => setProjectType(e.target.value)}
                  />
                </label>
                <label className="text-sm font-medium">
                  Internal note (not shown to the client)
                  <Input
                    className="mt-1"
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                  />
                </label>
              </div>
            )}
          </div>


          <div className="rounded-2xl border border-border bg-background p-6 shadow-card">
            <h2 className="text-xl">Invoice</h2>
            <label className="mt-4 block text-sm font-medium">
              Description shown on the invoice
              <Textarea
                className="mt-1"
                rows={2}
                placeholder="e.g. Monthly support and hosting — August 2026"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">
                Issue date
                <Input
                  className="mt-1"
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                />
              </label>
              <label className="text-sm font-medium">
                Due date (first payment)
                <Input
                  className="mt-1"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </label>
            </div>

            <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-slate">
              Services & products
            </h3>
            <div className="mt-3 space-y-2">
              {rows.map((row, index) => (
                <div key={index} className="grid gap-2 sm:grid-cols-[2fr_0.6fr_1fr_1fr_auto]">
                  <Input
                    aria-label="Item description"
                    placeholder="Service or product"
                    value={row.label}
                    onChange={(e) =>
                      setRows(rows.map((r, i) => (i === index ? { ...r, label: e.target.value } : r)))
                    }
                  />
                  <Input
                    aria-label="Quantity"
                    inputMode="decimal"
                    placeholder="Qty"
                    value={row.qty}
                    onChange={(e) =>
                      setRows(rows.map((r, i) => (i === index ? { ...r, qty: e.target.value } : r)))
                    }
                  />
                  <Input
                    aria-label="Unit price in dollars"
                    inputMode="decimal"
                    placeholder="Unit price ($)"
                    value={row.unit}
                    onChange={(e) =>
                      setRows(rows.map((r, i) => (i === index ? { ...r, unit: e.target.value } : r)))
                    }
                  />
                  <Input
                    aria-label="Note"
                    placeholder="Note (optional)"
                    value={row.note}
                    onChange={(e) =>
                      setRows(rows.map((r, i) => (i === index ? { ...r, note: e.target.value } : r)))
                    }
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Remove item"
                    onClick={() => setRows(rows.filter((_, i) => i !== index))}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRows([...rows, { label: "", qty: "1", unit: "", note: "" }])}
              >
                Add item
              </Button>
            </div>

            <label className="mt-4 block max-w-xs text-sm font-medium">
              Discount ($)
              <Input
                className="mt-1"
                inputMode="decimal"
                placeholder="0"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
              />
            </label>

            <dl className="mt-4 space-y-1 text-sm text-slate">
              <div className="flex justify-between">
                <dt>Subtotal</dt>
                <dd>{formatMoney(subtotalCents)}</dd>
              </div>
              {discountCents > 0 ? (
                <div className="flex justify-between">
                  <dt>Discount</dt>
                  <dd>-{formatMoney(discountCents)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between text-base font-semibold text-foreground">
                <dt>Grand total</dt>
                <dd>{formatMoney(totalCents)}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-border bg-background p-6 shadow-card">
            <h2 className="text-xl">Payments</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {(
                [
                  { id: "full", label: "Pay in full" },
                  { id: "even", label: "Even split" },
                  { id: "custom", label: "Custom amounts" },
                ] as { id: SplitMode; label: string }[]
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSplitMode(option.id)}
                  className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                    splitMode === option.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-slate hover:border-primary/50"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {splitMode === "even" ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {SPLIT_COUNTS.filter((count) => count > 1).map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setSplitCount(count)}
                    className={`rounded-md border px-3 py-1 text-sm ${
                      splitCount === count
                        ? "border-primary text-foreground"
                        : "border-border text-slate"
                    }`}
                  >
                    {count} payments
                  </button>
                ))}
              </div>
            ) : null}

            {splitMode === "custom" ? (
              <div className="mt-4 space-y-2">
                {customRows.map((row, index) => (
                  <div key={index} className="grid gap-2 sm:grid-cols-[2fr_1fr_auto]">
                    <Input
                      aria-label="Payment label"
                      value={row.label}
                      onChange={(e) =>
                        setCustomRows(
                          customRows.map((r, i) =>
                            i === index ? { ...r, label: e.target.value } : r,
                          ),
                        )
                      }
                    />
                    <Input
                      aria-label="Payment amount in dollars"
                      inputMode="decimal"
                      placeholder="Amount ($)"
                      value={row.amount}
                      onChange={(e) =>
                        setCustomRows(
                          customRows.map((r, i) =>
                            i === index ? { ...r, amount: e.target.value } : r,
                          ),
                        )
                      }
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Remove payment"
                      onClick={() => setCustomRows(customRows.filter((_, i) => i !== index))}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCustomRows([
                      ...customRows,
                      { label: `Payment ${customRows.length + 1}`, amount: "" },
                    ])
                  }
                >
                  Add payment
                </Button>
              </div>
            ) : null}

            <ul className="mt-4 space-y-1 text-sm text-slate">
              {paymentRows.map((row, index) => (
                <li key={index} className="flex justify-between">
                  <span>
                    {index + 1}. {row.label}
                    {index === 0 ? " (sent first)" : ""}
                  </span>
                  <span>{formatMoney(row.amountCents)}</span>
                </li>
              ))}
            </ul>
            {!balanced ? (
              <p className="mt-3 text-sm text-destructive">
                The payments add up to {formatMoney(scheduledTotal)} — they must match the grand
                total of {formatMoney(totalCents)}.
              </p>
            ) : null}
            <p className="mt-3 text-xs text-slate">
              The first payment can go out now; the rest are saved as drafts you send from the
              project's invoices tab.
            </p>
          </div>

          {missing.length ? (
            <p className="text-sm text-destructive">
              Before sending, add {missing.join(", ")}.
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              className="shadow-cta"
              disabled={!canSubmit}
              onClick={() => mutation.mutate(true)}
              data-testid="direct-invoice-send"
            >
              {mutation.isPending ? "Working…" : "Create and send now"}
            </Button>
            <Button variant="outline" disabled={!canSubmit} onClick={() => mutation.mutate(false)}>
              Save as draft
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/admin">Back to the queue</Link>
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}
