import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { moveItem, nudgeItem } from "@/lib/reorder";

/**
 * Editable, reorderable list of project phases used on the import form.
 * The order shown here is the order milestones are created in.
 */
export function PhaseOrderList({
  phases,
  onChange,
}: {
  phases: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [dragging, setDragging] = useState<number | null>(null);

  const add = () => {
    const value = draft.trim();
    if (!value) return;
    onChange([...phases, value]);
    setDraft("");
  };

  return (
    <div className="mt-4 rounded-xl border border-border bg-muted/20 p-4">
      <p className="text-sm font-medium">Project phases</p>
      <p className="mt-1 text-xs text-slate">
        These become the Milestones board under “Not started”, in the order shown. Drag a row, or use
        the arrows, to change the order.
      </p>

      {phases.length === 0 ? (
        <p className="mt-3 text-sm text-slate">
          No phases yet. Add them below, or upload a proposal that lists them.
        </p>
      ) : (
        <ol className="mt-3 space-y-2">
          {phases.map((phase, index) => (
            <li
              key={`${phase}-${index}`}
              draggable
              onDragStart={() => setDragging(index)}
              onDragEnd={() => setDragging(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (dragging === null) return;
                onChange(moveItem(phases, dragging, index));
                setDragging(null);
              }}
              className="flex items-center gap-2 rounded-lg border border-border bg-background p-2 text-sm"
            >
              <span className="w-6 shrink-0 text-center text-xs text-slate">{index + 1}</span>
              <Input
                aria-label={`Phase ${index + 1} name`}
                value={phase}
                onChange={(event) =>
                  onChange(phases.map((row, i) => (i === index ? event.target.value : row)))
                }
              />
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Move ${phase} up`}
                disabled={index === 0}
                onClick={() => onChange(nudgeItem(phases, index, -1))}
              >
                ↑
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Move ${phase} down`}
                disabled={index === phases.length - 1}
                onClick={() => onChange(nudgeItem(phases, index, 1))}
              >
                ↓
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Remove ${phase}`}
                onClick={() => onChange(phases.filter((_, i) => i !== index))}
              >
                Remove
              </Button>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Input
          className="max-w-sm"
          aria-label="New phase"
          placeholder="Add a phase, e.g. Phase 1 – Discovery"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
        />
        <Button variant="outline" size="sm" disabled={!draft.trim()} onClick={add}>
          Add phase
        </Button>
      </div>
    </div>
  );
}
