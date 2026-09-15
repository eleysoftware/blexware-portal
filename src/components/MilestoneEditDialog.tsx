import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { MilestoneRecord } from "@/lib/milestones.functions";

/** Edit the name, note and expected duration of a milestone that is not yet done. */
export function MilestoneEditDialog({
  milestone,
  open,
  onOpenChange,
  onSave,
  saving,
}: {
  milestone: MilestoneRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (values: { title: string; note: string; targetDuration: string }) => void;
  saving?: boolean;
}) {
  const [title, setTitle] = useState(milestone.title);
  const [note, setNote] = useState(milestone.note ?? "");
  const [duration, setDuration] = useState(milestone.target_duration ?? "");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setTitle(milestone.title);
          setNote(milestone.note ?? "");
          setDuration(milestone.target_duration ?? "");
        }
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit phase</DialogTitle>
          <DialogDescription>
            Update what this phase covers and how long it should take. The client sees these details
            on their Milestones board.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block text-sm font-medium">
            Phase name
            <Input className="mt-1" value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label className="block text-sm font-medium">
            Details
            <Textarea
              className="mt-1"
              rows={3}
              placeholder="What happens in this phase"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          <label className="block text-sm font-medium">
            Expected duration
            <Input
              className="mt-1"
              placeholder="e.g. 2 weeks"
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
            />
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!title.trim() || saving}
            onClick={() => onSave({ title: title.trim(), note: note.trim(), targetDuration: duration.trim() })}
          >
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
