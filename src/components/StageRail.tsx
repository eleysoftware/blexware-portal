import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { quoteStatusLabels, quoteStatuses, type QuoteStatus } from "@/lib/quote-schema";

/**
 * Horizontal stage rail: the focused stage sits in the middle with the
 * previous and next stages partially visible and faded at either edge.
 */
export function StageRail({
  status,
  onSelect,
  disabled,
  className,
}: {
  status: QuoteStatus;
  onSelect?: (status: QuoteStatus) => void;
  disabled?: boolean;
  className?: string;
}) {
  const currentIndex = Math.max(0, quoteStatuses.indexOf(status));
  const [index, setIndex] = useState(currentIndex);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    setIndex(currentIndex);
  }, [currentIndex]);

  const move = (delta: number) =>
    setIndex((value) => Math.min(quoteStatuses.length - 1, Math.max(0, value + delta)));

  const focused = quoteStatuses[index] as QuoteStatus;
  const previous = index > 0 ? (quoteStatuses[index - 1] as QuoteStatus) : null;
  const next = index < quoteStatuses.length - 1 ? (quoteStatuses[index + 1] as QuoteStatus) : null;

  return (
    <div className={cn("w-full", className)}>
      <div
        className="flex items-center gap-2 rounded-2xl border border-border bg-background px-2 py-2 shadow-card"
        role="group"
        aria-label="Project stage"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            move(-1);
          }
          if (event.key === "ArrowRight") {
            event.preventDefault();
            move(1);
          }
        }}
        onTouchStart={(event) => {
          touchX.current = event.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          const start = touchX.current;
          const end = event.changedTouches[0]?.clientX ?? null;
          if (start === null || end === null) return;
          if (Math.abs(end - start) > 40) move(end < start ? 1 : -1);
          touchX.current = null;
        }}
      >
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Previous stage"
          disabled={index === 0}
          onClick={() => move(-1)}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </Button>

        <div className="grid min-w-0 flex-1 grid-cols-[1fr_auto_1fr] items-center gap-2 overflow-hidden">
          <span className="truncate text-right text-xs text-slate/60">
            {previous ? quoteStatusLabels[previous] : ""}
          </span>
          <span
            className="whitespace-nowrap rounded-full bg-secondary px-4 py-1.5 text-sm font-semibold text-foreground"
            aria-live="polite"
          >
            {quoteStatusLabels[focused]}
            {focused === status ? "" : " (preview)"}
          </span>
          <span className="truncate text-xs text-slate/60">{next ? quoteStatusLabels[next] : ""}</span>
        </div>

        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Next stage"
          disabled={index === quoteStatuses.length - 1}
          onClick={() => move(1)}
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      {onSelect && focused !== status ? (
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => setIndex(currentIndex)}>
            Cancel
          </Button>
          <Button type="button" size="sm" disabled={disabled} onClick={() => onSelect(focused)}>
            Move to {quoteStatusLabels[focused]}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
