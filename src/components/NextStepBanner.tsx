import { ArrowRight, CheckCircle2, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NextStep } from "@/lib/workflow-guidance";

const TAB_LABELS: Record<string, string> = {
  overview: "Overview",
  intake: "Intake",
  proposal: "Proposal",
  estimate: "Estimate",
  sow: "SOW",
  invoices: "Invoices",
};

export function NextStepBanner({
  step,
  onGoToTab,
  className,
}: {
  step: NextStep;
  onGoToTab: (tab: string) => void;
  className?: string;
}) {
  const done = step.actor === "none";
  const Icon = done ? CheckCircle2 : step.actionable ? ArrowRight : Clock;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 shadow-card",
        step.actionable
          ? "border-primary/40 bg-primary/5"
          : "border-border bg-secondary/40",
        className,
      )}
      role="status"
    >
      <div className="flex min-w-0 items-start gap-3">
        <Icon
          className={cn("mt-0.5 h-5 w-5 shrink-0", step.actionable ? "text-primary" : "text-slate")}
          aria-hidden="true"
        />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate">
            {done ? "Nothing outstanding" : step.actionable ? "Your next step" : "Waiting on"}
          </p>
          <p className="mt-1 text-sm text-foreground">{step.message}</p>
        </div>
      </div>
      {done ? null : (
        <Button size="sm" variant={step.actionable ? "default" : "outline"} onClick={() => onGoToTab(step.tab)}>
          Go to {TAB_LABELS[step.tab] ?? step.tab}
        </Button>
      )}
    </div>
  );
}
