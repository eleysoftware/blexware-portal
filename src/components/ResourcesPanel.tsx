import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileText, Paperclip, X } from "lucide-react";
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
  attachmentsOf,
  canEditResource,
  formatBytes,
  validateResourceDetails,
  validateResourceFile,
  type ResourceAttachment,
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
 * Shared project Resources tab: notes with any number of optional attachments.
 * Clients may post and manage their own entries; admins may manage and archive
 * any entry.
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
  const [files, setFiles] = useState<File[]>([]);
  const [removePaths, setRemovePaths] = useState<string[]>([]);
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
    setFiles([]);
    setRemovePaths([]);
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
    setFiles([]);
    setRemovePaths([]);
    setSelected(null);
    setOpen(true);
  };

  const chooseFiles = (chosen: FileList | null) => {
    if (!chosen || chosen.length === 0) return;
    const accepted: File[] = [];
    for (const file of Array.from(chosen)) {
      const problem = validateResourceFile(file);
      if (problem) {
        toast.error(problem);
        continue;
      }
      accepted.push(file);
    }
    if (accepted.length > 0) setFiles((current) => [...current, ...accepted]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.set("quoteId", quoteId);
      if (editing) form.set("id", editing.id);
      form.set("title", title);
      form.set("description", description);
      form.set("removePaths", JSON.stringify(removePaths));
      for (const file of files) form.append("files", file);
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
    mutationFn: (input: { id: string; path: string }) => download({ data: input }),
    onSuccess: (result: { url: string }) => window.open(result.url, "_blank", "noopener"),
    onError: (error: Error) => toast.error(error.message),
  });

  const submit = () => {
    const problem = validateResourceDetails({ title, description });
    if (problem) {
      toast.error(problem);
      return;
    }
    for (const file of files) {
      const fileProblem = validateResourceFile(file);
      if (fileProblem) {
        toast.error(fileProblem);
        return;
      }
    }
    saveMutation.mutate();
  };

  const existingAttachments: ResourceAttachment[] = editing ? attachmentsOf(editing) : [];

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
            : "No resources yet. Add a title and a short note — attach files if there are some to share."}
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-border rounded-xl border border-border">
          {rows.map((row) => {
            const attachmentCount = attachmentsOf(row).length;
            return (
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
                  {attachmentCount > 0 ? (
                    <span className="flex shrink-0 items-center gap-1 text-xs text-slate">
                      <Paperclip className="size-3.5" aria-hidden="true" />
                      {attachmentCount} {attachmentCount === 1 ? "file" : "files"}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
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

              {attachmentsOf(selected).length > 0 ? (
                <div className="space-y-2">
                  {attachmentsOf(selected).map((attachment) => (
                    <div
                      key={attachment.path}
                      className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3 text-sm"
                    >
                      <Paperclip className="size-4 shrink-0 text-primary" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
                      <span className="shrink-0 text-xs text-slate">
                        {attachment.size ? formatBytes(attachment.size) : ""}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={downloadMutation.isPending}
                        onClick={() =>
                          downloadMutation.mutate({ id: selected.id, path: attachment.path })
                        }
                      >
                        <Download className="size-4" aria-hidden="true" />
                        Download
                      </Button>
                    </div>
                  ))}
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
              Files are optional — attach as many as you need, up to 50 MB each.
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
              <Label htmlFor="resource-file">Attachments (optional)</Label>
              <Input
                id="resource-file"
                ref={fileRef}
                type="file"
                multiple
                onChange={(event) => chooseFiles(event.target.files)}
              />

              {existingAttachments.length > 0 ? (
                <ul className="space-y-1">
                  {existingAttachments.map((attachment) => {
                    const marked = removePaths.includes(attachment.path);
                    return (
                      <li
                        key={attachment.path}
                        className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm"
                      >
                        <Paperclip className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
                        <button
                          type="button"
                          className="shrink-0 text-xs text-primary underline"
                          onClick={() =>
                            setRemovePaths((current) =>
                              marked
                                ? current.filter((path) => path !== attachment.path)
                                : [...current, attachment.path],
                            )
                          }
                        >
                          {marked ? "Keep the file" : "Remove"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}

              {files.length > 0 ? (
                <ul className="space-y-1">
                  {files.map((file, index) => (
                    <li
                      key={`${file.name}-${index}`}
                      className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm"
                    >
                      <Paperclip className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate">{file.name}</span>
                      <span className="shrink-0 text-xs text-slate">{formatBytes(file.size)}</span>
                      <button
                        type="button"
                        aria-label={`Remove ${file.name}`}
                        className="shrink-0 rounded-sm p-1 text-slate hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() =>
                          setFiles((current) => current.filter((_, at) => at !== index))
                        }
                      >
                        <X className="size-4" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
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
