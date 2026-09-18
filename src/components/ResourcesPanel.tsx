import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileText, Paperclip } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  MAX_RESOURCE_DESCRIPTION,
  canEditResource,
  formatBytes,
  validateResourceDetails,
  validateResourceFile,
  type ResourceRecord,
} from "@/lib/resource-rules";
import {
  deleteResource,
  listResources,
  resourceDownloadUrl,
  saveResource,
  setResourceArchived,
} from "@/lib/resources.functions";

function when(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Shared project Resources tab: notes with optional attachments. Clients may
 * post and manage their own entries; admins may manage and archive any entry.
 */
export function ResourcesPanel({ quoteId }: { quoteId: string }) {
  const queryClient = useQueryClient();
  const fetchResources = useServerFn(listResources);
  const save = useServerFn(saveResource);
  const remove = useServerFn(deleteResource);
  const archive = useServerFn(setResourceArchived);
  const download = useServerFn(resourceDownloadUrl);

  const [showArchived, setShowArchived] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ResourceRecord | null>(null);
  const [selected, setSelected] = useState<ResourceRecord | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [removeFile, setRemoveFile] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const key = ["resources", quoteId, showArchived];
  const resources = useQuery({
    queryKey: key,
    queryFn: () => fetchResources({ data: { quoteId, includeArchived: showArchived } }),
  });

  const rows = resources.data?.resources ?? [];
  const isAdmin = resources.data?.isAdmin ?? false;
  const viewer = { userId: resources.data?.userId ?? null, isAdmin };
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["resources", quoteId], exact: false });

  const resetForm = () => {
    setEditing(null);
    setTitle("");
    setDescription("");
    setFile(null);
    setRemoveFile(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const openNew = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (resource: ResourceRecord) => {
    setEditing(resource);
    setTitle(resource.title);
    setDescription(resource.description ?? "");
    setFile(null);
    setRemoveFile(false);
    setSelected(null);
    setOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.set("quoteId", quoteId);
      if (editing) form.set("id", editing.id);
      form.set("title", title);
      form.set("description", description);
      form.set("removeFile", removeFile ? "true" : "false");
      if (file) form.set("file", file);
      return save({ data: form });
    },
    onSuccess: () => {
      setOpen(false);
      resetForm();
      void invalidate();
      toast.success("Resource saved");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      setSelected(null);
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const archiveMutation = useMutation({
    mutationFn: (input: { id: string; archived: boolean }) => archive({ data: input }),
    onSuccess: () => {
      setSelected(null);
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const downloadMutation = useMutation({
    mutationFn: (id: string) => download({ data: { id } }),
    onSuccess: (result: { url: string }) => window.open(result.url, "_blank", "noopener"),
    onError: (error: Error) => toast.error(error.message),
  });

  const submit = () => {
    const problem = validateResourceDetails({ title, description });
    if (problem) {
      toast.error(problem);
      return;
    }
    if (file) {
      const fileProblem = validateResourceFile(file);
      if (fileProblem) {
        toast.error(fileProblem);
        return;
      }
    }
    saveMutation.mutate();
  };

  return (
    <div className="rounded-2xl border border-border bg-background p-6 shadow-card">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-xl">Resources</h2>
          <p className="mt-1 text-sm text-slate">
            Instructions, references and files for this project. A title and short note are enough —
            attachments are optional.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowArchived((value) => !value)}
            >
              {showArchived ? "Back to active" : "Archived"}
            </Button>
          ) : null}
          <Button size="sm" onClick={openNew}>
            Add a resource
          </Button>
        </div>
      </div>

      {resources.isLoading ? (
        <p className="mt-4 text-sm text-slate">Loading resources…</p>
      ) : resources.data?.unavailable ? (
        <p className="mt-4 text-sm text-slate">
          Resources aren't set up in this database yet.
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate">
          {showArchived
            ? "Nothing has been archived."
            : "No resources yet. Add a title and a short note — attach a file if there's one to share."}
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-border rounded-xl border border-border">
          {rows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => setSelected(row)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <FileText className="size-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-foreground">{row.title}</span>
                  <span className="block truncate text-xs text-slate">
                    {row.author_role === "client" ? "Client" : "BLEXware team"} · {when(row.created_at)}
                    {row.description ? ` · ${row.description}` : ""}
                  </span>
                </span>
                {row.storage_path ? (
                  <span className="flex shrink-0 items-center gap-1 text-xs text-slate">
                    <Paperclip className="size-3.5" aria-hidden="true" />
                    <span className="max-w-[12rem] truncate">{row.original_name}</span>
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Detail view */}
      <Dialog open={Boolean(selected)} onOpenChange={(value) => !value && setSelected(null)}>
        <DialogContent>
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle>{selected.title}</DialogTitle>
                <DialogDescription>
                  Posted by {selected.author_label ?? (selected.author_role === "client" ? "Client" : "BLEXware team")} on{" "}
                  {when(selected.created_at)}
                </DialogDescription>
              </DialogHeader>

              {selected.description ? (
                <p className="whitespace-pre-wrap text-sm text-foreground">{selected.description}</p>
              ) : (
                <p className="text-sm text-slate">No description was added.</p>
              )}

              {selected.storage_path ? (
                <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3 text-sm">
                  <Paperclip className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{selected.original_name}</span>
                  <span className="shrink-0 text-xs text-slate">
                    {selected.byte_size ? formatBytes(selected.byte_size) : ""}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={downloadMutation.isPending}
                    onClick={() => downloadMutation.mutate(selected.id)}
                  >
                    <Download className="size-4" aria-hidden="true" />
                    Download
                  </Button>
                </div>
              ) : null}

              <DialogFooter className="flex-wrap gap-2">
                {canEditResource(selected, viewer) ? (
                  <>
                    <Button variant="outline" size="sm" onClick={() => openEdit(selected)}>
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        if (window.confirm(`Delete "${selected.title}"? This cannot be undone.`))
                          deleteMutation.mutate(selected.id);
                      }}
                    >
                      Delete
                    </Button>
                  </>
                ) : null}
                {isAdmin ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={archiveMutation.isPending}
                    onClick={() =>
                      archiveMutation.mutate({
                        id: selected.id,
                        archived: !selected.archived_at,
                      })
                    }
                  >
                    {selected.archived_at ? "Restore" : "Archive"}
                  </Button>
                ) : null}
                <Button size="sm" onClick={() => setSelected(null)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Add / edit form */}
      <Dialog
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value) resetForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit resource" : "Add a resource"}</DialogTitle>
            <DialogDescription>
              A title is required. The description is limited to {MAX_RESOURCE_DESCRIPTION} characters.
              Files are optional, up to 50 MB each.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="resource-title">Title</Label>
              <Input
                id="resource-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Brand guidelines"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="resource-description">Short description</Label>
              <Textarea
                id="resource-description"
                value={description}
                maxLength={MAX_RESOURCE_DESCRIPTION}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Any instructions the team should follow."
              />
              <p className="text-xs text-slate">
                {description.length} / {MAX_RESOURCE_DESCRIPTION} characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="resource-file">Attachment (optional)</Label>
              <Input
                id="resource-file"
                ref={fileRef}
                type="file"
                onChange={(event) => {
                  const chosen = event.target.files?.[0] ?? null;
                  setFile(chosen);
                  if (chosen) setRemoveFile(false);
                }}
              />
              {editing?.original_name && !file ? (
                <p className="text-xs text-slate">
                  Currently attached: {editing.original_name}.{" "}
                  <button
                    type="button"
                    className="text-primary underline"
                    onClick={() => setRemoveFile((value) => !value)}
                  >
                    {removeFile ? "Keep the file" : "Remove the file"}
                  </button>
                </p>
              ) : null}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : "Save resource"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
