import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { MilestoneEditDialog } from "@/components/MilestoneEditDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  deleteMilestone,
  listMilestones,
  moveMilestone,
  saveMilestone,
  MILESTONE_LANES,
  MILESTONE_LANE_LABELS,
  type MilestoneLane,
  type MilestoneRecord,
} from "@/lib/milestones.functions";

export function milestoneProgress(rows: MilestoneRecord[]): string | null {
  if (!rows.length) return null;
  const done = rows.filter((row) => row.lane === "done").length;
  return `${done} of ${rows.length} milestone${rows.length === 1 ? "" : "s"} done`;
}

/**
 * Kanban board of project phases. Admins can add, edit, reorder and drag
 * milestones between lanes; clients see the same board read-only.
 */
export function MilestoneBoard({
  quoteId,
  readOnly = false,
}: {
  quoteId: string;
  readOnly?: boolean;
}) {
  const queryClient = useQueryClient();
  const fetchMilestones = useServerFn(listMilestones);
  const save = useServerFn(saveMilestone);
  const move = useServerFn(moveMilestone);
  const remove = useServerFn(deleteMilestone);

  const [title, setTitle] = useState("");
  const [dragging, setDragging] = useState<string | null>(null);
  const [editing, setEditing] = useState<MilestoneRecord | null>(null);

  const key = ["milestones", quoteId];
  const milestones = useQuery({
    queryKey: key,
    queryFn: () => fetchMilestones({ data: { quoteId } }),
  });
  const rows = milestones.data?.milestones ?? [];
  const invalidate = () => queryClient.invalidateQueries({ queryKey: key });

  const addMutation = useMutation({
    mutationFn: () => save({ data: { quoteId, title } }),
    onSuccess: () => {
      setTitle("");
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const moveMutation = useMutation({
    mutationFn: (input: { id: string; lane: MilestoneLane; index?: number }) =>
      move({
        data: {
          id: input.id,
          quoteId,
          lane: input.lane,
          ...(input.index === undefined ? {} : { index: input.index }),
        },
      }),
    onSuccess: () => void invalidate(),
    onError: (error: Error) => toast.error(error.message),
  });

  const editMutation = useMutation({
    mutationFn: (input: {
      id: string;
      title: string;
      note: string;
      targetDuration: string;
    }) =>
      save({
        data: {
          quoteId,
          id: input.id,
          title: input.title,
          note: input.note,
          targetDuration: input.targetDuration,
        },
      }),
    onSuccess: () => {
      setEditing(null);
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => void invalidate(),
    onError: (error: Error) => toast.error(error.message),
  });

  const progress = milestoneProgress(rows);

  return (
    <div className="rounded-2xl border border-border bg-background p-6 shadow-card">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-xl">Milestones</h2>
        {progress ? <p className="text-sm text-slate">{progress}</p> : null}
      </div>

      {milestones.isLoading ? (
        <p className="mt-3 text-sm text-slate">Loading milestones…</p>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-sm text-slate">
          {readOnly
            ? "No milestones yet. They appear here once the BLEXware team maps out the project phases."
            : "No milestones yet. Add the project phases below — imported proposals fill these in automatically."}
        </p>
      ) : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-4">
        {MILESTONE_LANES.map((lane) => {
          const laneRows = rows.filter((row) => row.lane === lane);
          const dropAt = (index: number) => (event: React.DragEvent) => {
            event.preventDefault();
            event.stopPropagation();
            const id = event.dataTransfer.getData("text/plain") || dragging;
            setDragging(null);
            if (id) moveMutation.mutate({ id, lane, index });
          };
          return (
            <div
              key={lane}
              className={cn(
                "rounded-xl border border-border bg-muted/30 p-3",
                !readOnly && dragging ? "border-dashed border-primary/50" : "",
              )}
              onDragOver={readOnly ? undefined : (event) => event.preventDefault()}
              onDrop={readOnly ? undefined : dropAt(laneRows.length)}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate">
                {MILESTONE_LANE_LABELS[lane]}
                <span className="ml-2 font-normal">{laneRows.length}</span>
              </p>
              <ul className="mt-3 space-y-2">
                {laneRows.map((row, index) => (
                  <li
                    key={row.id}
                    draggable={!readOnly}
                    onDragStart={
                      readOnly
                        ? undefined
                        : (event) => {
                            event.dataTransfer.setData("text/plain", row.id);
                            setDragging(row.id);
                          }
                    }
                    onDragEnd={() => setDragging(null)}
                    onDragOver={readOnly ? undefined : (event) => event.preventDefault()}
                    onDrop={readOnly ? undefined : dropAt(index)}
                    className={cn(
                      "rounded-lg border border-border bg-background p-3 text-sm shadow-sm",
                      !readOnly && dragging && dragging !== row.id ? "border-t-2 border-t-primary/40" : "",
                    )}
                  >
                    <p className="font-medium text-foreground">{row.title}</p>
                    {row.note ? <p className="mt-1 text-xs text-slate">{row.note}</p> : null}
                    {row.target_duration ? (
                      <p className="mt-1 text-xs text-slate">{row.target_duration}</p>
                    ) : null}
                    {readOnly ? null : (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <label className="sr-only" htmlFor={`lane-${row.id}`}>
                          Move {row.title} to a lane
                        </label>
                        <select
                          id={`lane-${row.id}`}
                          className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                          value={row.lane}
                          onChange={(event) =>
                            moveMutation.mutate({
                              id: row.id,
                              lane: event.target.value as MilestoneLane,
                            })
                          }
                        >
                          {MILESTONE_LANES.map((option) => (
                            <option key={option} value={option}>
                              {MILESTONE_LANE_LABELS[option]}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          aria-label={`Move ${row.title} up`}
                          disabled={index === 0}
                          className="rounded border border-border px-1 text-xs disabled:opacity-40"
                          onClick={() =>
                            moveMutation.mutate({ id: row.id, lane, index: index - 1 })
                          }
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          aria-label={`Move ${row.title} down`}
                          disabled={index === laneRows.length - 1}
                          className="rounded border border-border px-1 text-xs disabled:opacity-40"
                          onClick={() =>
                            moveMutation.mutate({ id: row.id, lane, index: index + 1 })
                          }
                        >
                          ↓
                        </button>
                        {row.lane === "done" ? (
                          <span className="text-xs text-slate">
                            Complete — move out of Done to edit
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="text-xs text-primary underline-offset-4 hover:underline"
                            onClick={() => setEditing(row)}
                          >
                            Edit
                          </button>
                        )}
                        <button
                          type="button"
                          className="text-xs text-slate underline-offset-4 hover:underline"
                          onClick={() => deleteMutation.mutate(row.id)}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {editing ? (
        <MilestoneEditDialog
          key={editing.id}
          milestone={editing}
          open
          saving={editMutation.isPending}
          onOpenChange={(next) => {
            if (!next) setEditing(null);
          }}
          onSave={(values) => editMutation.mutate({ id: editing.id, ...values })}
        />
      ) : null}

      {readOnly ? null : (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Input
            className="max-w-sm"
            aria-label="New milestone"
            placeholder="Add a phase, e.g. Phase 1 – Discovery"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && title.trim()) addMutation.mutate();
            }}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={!title.trim() || addMutation.isPending}
            onClick={() => addMutation.mutate()}
          >
            Add milestone
          </Button>
        </div>
      )}
    </div>
  );
}
