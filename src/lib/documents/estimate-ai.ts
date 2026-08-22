import { z } from "zod";

import type { EstimateLineItem } from "./types";

/** Dollar band a client picked on the quote form. `max` is null for the open top band. */
export type BudgetBand = { min: number; max: number | null };

const DOLLARS = /\$?\s*([\d,]+(?:\.\d+)?)\s*(k)?/gi;

/** Parses "Under $2,500", "$5,000 - $10,000", "$25,000+" into a numeric band. */
export function parseBudgetBand(budget: string | null | undefined): BudgetBand | null {
  if (!budget) return null;
  const values: number[] = [];
  for (const match of budget.matchAll(DOLLARS)) {
    const raw = Number(match[1]!.replace(/,/g, ""));
    if (!Number.isFinite(raw)) continue;
    values.push(match[2] ? raw * 1000 : raw);
  }
  if (!values.length) return null;

  const openEnded = /\+|and up|or more/i.test(budget);
  if (values.length === 1) {
    const only = values[0]!;
    if (openEnded) return { min: only, max: null };
    if (/under|less than|below|up to/i.test(budget)) return { min: Math.round(only * 0.4), max: only };
    return { min: only, max: only };
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  return { min, max: openEnded ? null : max };
}

export const estimateAiSchema = z.object({
  lineItems: z
    .array(
      z.object({
        label: z.string().min(1),
        amount: z.number().nonnegative(),
        durationLabel: z.string().optional().default(""),
        note: z.string().optional().default(""),
      }),
    )
    .min(1),
  durationNote: z.string().optional().default(""),
  rationale: z.string().optional().default(""),
});

export type EstimateAiOutput = z.infer<typeof estimateAiSchema>;

function roundTo(cents: number, step = 5000): number {
  return Math.max(step, Math.round(cents / step) * step);
}

export type ReconciledEstimate = {
  lineItems: EstimateLineItem[];
  totalCents: number;
  adjusted: boolean;
};

/**
 * Scales AI line items proportionally so the total lands inside the client's
 * budget band, rounded to clean $50 increments. Open-ended bands are never
 * clamped from above.
 */
export function reconcileToBudget(
  items: { label: string; amount: number; durationLabel?: string; note?: string }[],
  band: BudgetBand | null,
): ReconciledEstimate {
  const base = items.map((item) => ({
    label: item.label.trim(),
    amountCents: Math.max(0, Math.round(item.amount * 100)),
    durationLabel: item.durationLabel?.trim() || undefined,
    note: item.note?.trim() || undefined,
  }));
  const rawTotal = base.reduce((sum, item) => sum + item.amountCents, 0);
  if (!band || rawTotal <= 0) {
    return { lineItems: base, totalCents: rawTotal, adjusted: false };
  }

  const minCents = Math.round(band.min * 100);
  const maxCents = band.max === null ? null : Math.round(band.max * 100);
  const withinFloor = rawTotal >= minCents;
  const withinCeiling = maxCents === null || rawTotal <= maxCents;
  if (withinFloor && withinCeiling) {
    return { lineItems: base, totalCents: rawTotal, adjusted: false };
  }

  // Aim for the middle-to-upper part of the band.
  const targetCents =
    maxCents === null ? Math.max(minCents, rawTotal) : Math.round(minCents + (maxCents - minCents) * 0.7);
  const factor = targetCents / rawTotal;

  const scaled = base.map((item) => ({ ...item, amountCents: roundTo(item.amountCents * factor) }));
  let total = scaled.reduce((sum, item) => sum + item.amountCents, 0);

  // Rounding drift lands on the largest line item.
  const drift = targetCents - total;
  if (drift !== 0 && scaled.length) {
    const largest = scaled.reduce((a, b) => (b.amountCents > a.amountCents ? b : a));
    largest.amountCents = Math.max(5000, largest.amountCents + roundTo(Math.abs(drift)) * Math.sign(drift));
    total = scaled.reduce((sum, item) => sum + item.amountCents, 0);
  }

  return { lineItems: scaled, totalCents: total, adjusted: true };
}

export function describeBand(band: BudgetBand | null): string {
  if (!band) return "no stated budget";
  if (band.max === null) return `$${band.min.toLocaleString()} and up (no upper limit)`;
  return `$${band.min.toLocaleString()} to $${band.max.toLocaleString()}`;
}

/** Best-effort JSON extraction from a model reply that may be fenced. */
export function parseEstimateJson(content: string): EstimateAiOutput {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const slice = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  return estimateAiSchema.parse(JSON.parse(slice));
}
