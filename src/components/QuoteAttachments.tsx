import { FileText, Paperclip, X } from "lucide-react";
import { useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export const MAX_FILES = 3;
export const MAX_FILE_BYTES = 20 * 1024 * 1024;

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateAttachment(file: File, existing: File[]): string | null {
  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) return `${file.name} isn't a PDF. Please attach PDF files only.`;
  if (file.size === 0) return `${file.name} appears to be empty.`;
  if (file.size > MAX_FILE_BYTES)
    return `${file.name} is ${formatBytes(file.size)} — the limit is 20 MB per file.`;
  if (existing.some((item) => item.name === file.name && item.size === file.size))
    return `${file.name} is already attached.`;
  return null;
}

export function QuoteAttachments({
  files,
  onChange,
}: {
  files: File[];
  onChange: (files: File[]) => void;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const addFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const accepted: File[] = [...files];
    let message: string | null = null;

    for (const file of Array.from(list)) {
      if (accepted.length >= MAX_FILES) {
        message = `You can attach up to ${MAX_FILES} PDFs.`;
        break;
      }
      const problem = validateAttachment(file, accepted);
      if (problem) {
        message = problem;
        continue;
      }
      accepted.push(file);
    }

    setError(message);
    onChange(accepted);
    if (inputRef.current) inputRef.current.value = "";
  };

  const remove = (index: number) => {
    setError(null);
    onChange(files.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <Label htmlFor={inputId}>Attach a brief, RFP, or spec (optional)</Label>
      <p className="text-sm text-slate">
        PDF only, up to {MAX_FILES} files and 20 MB each. Files are stored privately and only
        reviewed by our team.
      </p>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="sr-only"
        onChange={(event) => addFiles(event.target.files)}
      />

      <Button
        type="button"
        variant="outline"
        onClick={() => inputRef.current?.click()}
        disabled={files.length >= MAX_FILES}
      >
        <Paperclip className="size-4" aria-hidden="true" />
        {files.length > 0 ? "Add another PDF" : "Choose PDF files"}
      </Button>

      {files.length > 0 ? (
        <ul className="space-y-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${index}`}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3 text-sm"
            >
              <FileText className="size-4 shrink-0 text-primary" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-headline">{file.name}</span>
              <span className="shrink-0 text-xs text-slate">{formatBytes(file.size)}</span>
              <button
                type="button"
                onClick={() => remove(index)}
                aria-label={`Remove ${file.name}`}
                className="rounded-md p-1 text-slate transition-colors hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
