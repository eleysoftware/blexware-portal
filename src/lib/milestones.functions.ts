import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { guarded } from "@/lib/errors";

export const MILESTONE_LANES = ["not_started", "in_progress", "testing", "done"] as const;
export type MilestoneLane = (typeof MILESTONE_LANES)[number];

export const MILESTONE_LANE_LABELS: Record<MilestoneLane, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  testing: "Testing",
  done: "Done",
};

export type MilestoneRecord = {
  id: string;
  quote_id: string;
  title: string;
  note: string | null;
  target_duration: string | null;
  lane: MilestoneLane;
  position: number;
};

const SELECT = "id, quote_id, title, note, target_duration, lane, position";

function viewerDb(supabase: unknown): SupabaseClient {
  return supabase as SupabaseClient;
}

function sortMilestones(rows: MilestoneRecord[]): MilestoneRecord[] {
  return [...rows].sort((a, b) =>
    a.lane === b.lane ? a.position - b.position : MILESTONE_LANES.indexOf(a.lane) - MILESTONE_LANES.indexOf(b.lane),
  );
}

/** Milestones for a project. RLS decides whether the caller may see them. */
export const listMilestones = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { quoteId: string }) => {
    if (!data?.quoteId) throw new Error("Missing project");
    return data;
  })
  .handler(
    guarded("listMilestones", "loading the milestones", async ({ data, context }) => {
      const { data: rows, error } = await viewerDb(context.supabase)
        .from("project_milestones")
        .select(SELECT)
        .eq("quote_id", data.quoteId);
      if (error) {
        // The milestones table has not been created in this database yet.
        if (/project_milestones/.test(error.message)) return { milestones: [], unavailable: true };
        throw new Error(error.message);
      }
      return { milestones: sortMilestones((rows ?? []) as MilestoneRecord[]), unavailable: false };
    }),
  );

export type SaveMilestoneInput = {
  quoteId: string;
  id?: string;
  title: string;
  note?: string;
  targetDuration?: string;
  lane?: MilestoneLane;
};

/** Create or rename a milestone (admin only). */
export const saveMilestone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: SaveMilestoneInput) => {
    if (!data?.quoteId) throw new Error("Missing project");
    if (!data.title?.trim()) throw new Error("Give the milestone a name");
    return data;
  })
  .handler(
    guarded("saveMilestone", "saving the milestone", async ({ data, context }) => {
      const { requireAdmin, adminDb } = await import("@/lib/blex.server");
      await requireAdmin(context.supabase, context.userId);
      const db = adminDb();

      const values = {
        title: data.title.trim(),
        note: data.note?.trim() || null,
        target_duration: data.targetDuration?.trim() || null,
      };

      if (data.id) {
        const { data: current } = await db
          .from("project_milestones")
          .select("lane")
          .eq("id", data.id)
          .maybeSingle();
        if ((current?.lane as MilestoneLane | undefined) === "done") {
          throw new Error(
            "This phase is marked Done. Move it out of Done before changing its details.",
          );
        }
        const { error } = await db.from("project_milestones").update(values).eq("id", data.id);
        if (error) throw new Error(error.message);
        return { id: data.id };
      }

      const lane: MilestoneLane = data.lane ?? "not_started";
      const { data: existing } = await db
        .from("project_milestones")
        .select("position")
        .eq("quote_id", data.quoteId)
        .eq("lane", lane)
        .order("position", { ascending: false })
        .limit(1);
      const nextPosition = ((existing?.[0]?.position as number | undefined) ?? -1) + 1;

      const { data: row, error } = await db
        .from("project_milestones")
        .insert({ quote_id: data.quoteId, lane, position: nextPosition, ...values })
        .select("id")
        .single();
      if (error || !row) throw new Error(error?.message ?? "Could not add the milestone");
      return { id: row.id as string };
    }),
  );

/** Move a milestone into a lane at a given index, renumbering both lanes. */
export const moveMilestone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string; quoteId: string; lane: MilestoneLane; index?: number }) => {
    if (!data?.id || !data.quoteId) throw new Error("Missing milestone");
    if (!MILESTONE_LANES.includes(data.lane)) throw new Error("Unknown lane");
    return data;
  })
  .handler(
    guarded("moveMilestone", "moving the milestone", async ({ data, context }) => {
      const { requireAdmin, adminDb } = await import("@/lib/blex.server");
      await requireAdmin(context.supabase, context.userId);
      const db = adminDb();

      const { data: rows, error } = await db
        .from("project_milestones")
        .select(SELECT)
        .eq("quote_id", data.quoteId);
      if (error) throw new Error(error.message);

      const all = (rows ?? []) as MilestoneRecord[];
      const moving = all.find((row) => row.id === data.id);
      if (!moving) throw new Error("That milestone no longer exists");

      const target = all
        .filter((row) => row.lane === data.lane && row.id !== data.id)
        .sort((a, b) => a.position - b.position);
      const index = Math.max(0, Math.min(data.index ?? target.length, target.length));
      target.splice(index, 0, { ...moving, lane: data.lane });

      const source = all
        .filter((row) => row.lane === moving.lane && row.lane !== data.lane && row.id !== data.id)
        .sort((a, b) => a.position - b.position);

      const updates = [
        ...target.map((row, i) => ({ id: row.id, lane: data.lane, position: i })),
        ...source.map((row, i) => ({ id: row.id, lane: row.lane, position: i })),
      ];

      for (const update of updates) {
        const { error: updateError } = await db
          .from("project_milestones")
          .update({ lane: update.lane, position: update.position })
          .eq("id", update.id);
        if (updateError) throw new Error(updateError.message);
      }

      return { ok: true };
    }),
  );

export const deleteMilestone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string }) => {
    if (!data?.id) throw new Error("Missing milestone");
    return data;
  })
  .handler(
    guarded("deleteMilestone", "removing the milestone", async ({ data, context }) => {
      const { requireAdmin, adminDb } = await import("@/lib/blex.server");
      await requireAdmin(context.supabase, context.userId);
      const { error } = await adminDb().from("project_milestones").delete().eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }),
  );
