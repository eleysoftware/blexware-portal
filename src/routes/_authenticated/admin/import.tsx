import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { PageHero } from "@/components/PageHero";
import { Section } from "@/components/Section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/documents/types";
import { importProject, type ImportStage } from "@/lib/import.functions";

export const Route = createFileRoute("/_authenticated/admin/import")({
  head: () => ({
    meta: [
      { title: "Import an existing project — BLEXware team" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ImportProjectPage,
});

type LineRow = { label: string; amount: string; duration: string };

const stages: { value: ImportStage; label: string; hint: string }[] = [
  { value: "proposal_draft", label: "Proposal draft", hint: "Nothing sent to the client yet." },
  { value: "proposal_sent", label: "Proposal sent", hint: "Client is reviewing the proposal." },
  { value: "approved", label: "Proposal approved", hint: "Ready for cost + schedule estimate." },
  { value: "estimate_draft", label: "Estimate draft", hint: "Estimate written, not sent." },
  { value: "estimate_sent", label: "Estimate sent", hint: "Client is reviewing the estimate." },
  {
    value: "estimate_approved",
    label: "Estimate approved",
    hint: "Client already approved — go straight to the SOW.",
  },
];

const ESTIMATE_STAGES: ImportStage[] = ["estimate_draft", "estimate_sent", "estimate_approved"];

function ImportProjectPage() {
  const navigate = useNavigate();
  const runImport = useServerFn(importProject);

  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [projectType, setProjectType] = useState("Website");
  const [industry, setIndustry] = useState("Professional services");
  const [services, setServices] = useState("Web design, Web development");
  const [budget, setBudget] = useState("$2,500 - $5,000");
  const [timeline, setTimeline] = useState("1-2 months");
  const [goals, setGoals] = useState("");
  const [features, setFeatures] = useState("");
  const [documentTitle, setDocumentTitle] = useState("");
  const [proposalMarkdown, setProposalMarkdown] = useState("");
  const [stage, setStage] = useState<ImportStage>("approved");
  const [durationNote, setDurationNote] = useState("");
  const [rows, setRows] = useState<LineRow[]>([{ label: "", amount: "", duration: "" }]);

  const needsEstimate = ESTIMATE_STAGES.includes(stage);
  const lineItems = rows
    .filter((row) => row.label.trim() && row.amount.trim())
    .map((row) => ({
      label: row.label.trim(),
      amountCents: Math.round(Number(row.amount) * 100),
      ...(row.duration.trim() ? { durationLabel: row.duration.trim() } : {}),
    }));
  const total = lineItems.reduce((sum, item) => sum + item.amountCents, 0);

  const readFile = async (file: File) => {
    const text = await file.text();
    setProposalMarkdown(text);
    toast.success(`Loaded ${file.name}`);
  };

  const mutation = useMutation({
    mutationFn: () =>
      runImport({
        data: {
          contactName,
          contactEmail,
          company,
          phone,
          projectType,
          industry,
          services: services
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          budget,
          timeline,
          goals,
          features,
          documentTitle,
          proposalMarkdown,
          stage,
          ...(needsEstimate ? { lineItems, durationNote } : {}),
        },
      }),
    onSuccess: (result) => {
      toast.success(`Imported as ${result.quoteNumber}`);
      navigate({ to: "/admin/quotes/$id", params: { id: result.quoteId } });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <>
      <PageHero
        eyebrow="Team"
        title="Import an existing project"
        description="Bring a proposal that was written outside the portal into the pipeline, at whatever stage the client is actually at."
      />
      <Section>
        <div className="mx-auto max-w-3xl space-y-8">
          <div className="rounded-2xl border border-border bg-background p-6 shadow-card">
            <h2 className="text-xl">Client</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">
                Contact name
                <Input className="mt-1" value={contactName} onChange={(e) => setContactName(e.target.value)} />
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
            <h2 className="text-xl">Engagement details</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">
                Project type
                <Input className="mt-1" value={projectType} onChange={(e) => setProjectType(e.target.value)} />
              </label>
              <label className="text-sm font-medium">
                Industry
                <Input className="mt-1" value={industry} onChange={(e) => setIndustry(e.target.value)} />
              </label>
              <label className="text-sm font-medium sm:col-span-2">
                Services (comma separated)
                <Input className="mt-1" value={services} onChange={(e) => setServices(e.target.value)} />
              </label>
              <label className="text-sm font-medium">
                Budget band
                <Input className="mt-1" value={budget} onChange={(e) => setBudget(e.target.value)} />
              </label>
              <label className="text-sm font-medium">
                Timeline
                <Input className="mt-1" value={timeline} onChange={(e) => setTimeline(e.target.value)} />
              </label>
              <label className="text-sm font-medium sm:col-span-2">
                Goals
                <Textarea className="mt-1" rows={3} value={goals} onChange={(e) => setGoals(e.target.value)} />
              </label>
              <label className="text-sm font-medium sm:col-span-2">
                Features / notes
                <Textarea
                  className="mt-1"
                  rows={2}
                  value={features}
                  onChange={(e) => setFeatures(e.target.value)}
                />
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background p-6 shadow-card">
            <h2 className="text-xl">Proposal content</h2>
            <p className="mt-1 text-sm text-slate">
              Paste the proposal as markdown — use <code>##</code> headings for each section. For a PDF or
              Word file, copy the text out of the document and paste it here, or upload a .md/.txt export.
            </p>
            <label className="mt-4 block text-sm font-medium">
              Document title (optional)
              <Input
                className="mt-1"
                value={documentTitle}
                placeholder="e.g. Website Enhancement Proposal"
                onChange={(e) => setDocumentTitle(e.target.value)}
              />
            </label>
            <input
              className="mt-4 block w-full text-sm text-slate"
              type="file"
              accept=".md,.markdown,.txt,text/plain,text/markdown"
              aria-label="Upload a markdown or text proposal"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void readFile(file);
              }}
            />
            <Textarea
              className="mt-4 font-mono text-sm"
              rows={14}
              value={proposalMarkdown}
              placeholder={"## Overview\n\nWhat we're building…"}
              onChange={(e) => setProposalMarkdown(e.target.value)}
            />
          </div>

          <div className="rounded-2xl border border-border bg-background p-6 shadow-card">
            <h2 className="text-xl">Starting stage</h2>
            <div className="mt-4 space-y-2">
              {stages.map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 text-sm"
                >
                  <input
                    type="radio"
                    name="stage"
                    className="mt-1"
                    checked={stage === option.value}
                    onChange={() => setStage(option.value)}
                  />
                  <span>
                    <span className="font-medium">{option.label}</span>
                    <span className="block text-slate">{option.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {needsEstimate ? (
            <div className="rounded-2xl border border-border bg-background p-6 shadow-card">
              <h2 className="text-xl">Estimate line items</h2>
              <div className="mt-4 space-y-2">
                {rows.map((row, index) => (
                  <div key={index} className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
                    <Input
                      aria-label="Line item"
                      placeholder="Phase or deliverable"
                      value={row.label}
                      onChange={(e) =>
                        setRows(rows.map((r, i) => (i === index ? { ...r, label: e.target.value } : r)))
                      }
                    />
                    <Input
                      aria-label="Amount in dollars"
                      inputMode="decimal"
                      placeholder="Amount ($)"
                      value={row.amount}
                      onChange={(e) =>
                        setRows(rows.map((r, i) => (i === index ? { ...r, amount: e.target.value } : r)))
                      }
                    />
                    <Input
                      aria-label="Duration"
                      placeholder="Duration"
                      value={row.duration}
                      onChange={(e) =>
                        setRows(rows.map((r, i) => (i === index ? { ...r, duration: e.target.value } : r)))
                      }
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Remove line item"
                      onClick={() => setRows(rows.filter((_, i) => i !== index))}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRows([...rows, { label: "", amount: "", duration: "" }])}
                >
                  Add line item
                </Button>
              </div>
              <label className="mt-4 block text-sm font-medium">
                Duration summary
                <Input
                  className="mt-1"
                  value={durationNote}
                  placeholder="e.g. 24–36 business days"
                  onChange={(e) => setDurationNote(e.target.value)}
                />
              </label>
              <p className="mt-3 text-sm text-slate">
                Total <span className="font-semibold text-foreground">{formatMoney(total)}</span>
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              className="shadow-cta"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate()}
              data-testid="import-submit"
            >
              {mutation.isPending ? "Importing…" : "Import project"}
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
