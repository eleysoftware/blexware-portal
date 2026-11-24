import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileUp } from "lucide-react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { importProposalIntoQuote } from "@/lib/admin.functions";
import { extractProposalFromFile } from "@/lib/import.functions";
import { normalizeSecondaryEmails } from "@/lib/collaborators";

type Props = { quoteId: string; hasProposal: boolean; onImported: () => void };

export function ImportProposalDialog({ quoteId, hasProposal, onImported }: Props) {
  const runExtract = useServerFn(extractProposalFromFile);
  const runImport = useServerFn(importProposalIntoQuote);
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [reading, setReading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [title, setTitle] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [secondaryEmails, setSecondaryEmails] = useState("");

  const reset = () => {
    setFileName("");
    setTitle("");
    setMarkdown("");
    setSecondaryEmails("");
  };

  const readFile = async (file: File) => {
    const name = file.name.toLowerCase();
    setFileName(file.name);
    if (name.endsWith(".md") || name.endsWith(".markdown") || name.endsWith(".txt")) {
      setMarkdown(await file.text());
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("That file is larger than 10 MB. Please upload a smaller document.");
      return;
    }
    setReading(true);
    try {
      const buffer = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      for (let i = 0; i < buffer.length; i += 1) binary += String.fromCharCode(buffer[i]!);
      const result = await runExtract({
        data: { fileName: file.name, contentType: file.type || undefined, base64: btoa(binary) },
      });
      setMarkdown(result.markdown);
      if (result.documentTitle) setTitle((current) => current || result.documentTitle!);
      toast.success(
        result.aiFormatted
          ? "Converted to the BLEXware proposal format — review it below."
          : "Read the document text — tidy up the sections below.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That document could not be read.");
    } finally {
      setReading(false);
    }
  };

  const mutation = useMutation({
    mutationFn: () =>
      runImport({
        data: {
          quoteId,
          markdown,
          documentTitle: title,
          secondaryEmails: normalizeSecondaryEmails(secondaryEmails),
        },
      }),
    onSuccess: (result) => {
      toast.success(result.replaced ? "Proposal replaced with the imported document" : "Proposal imported");
      setOpen(false);
      reset();
      onImported();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" data-testid="proposal-import">
          <FileUp className="mr-1 h-4 w-4" aria-hidden="true" />
          Import document
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import a proposal document</DialogTitle>
          <DialogDescription>
            Upload a PDF, Word (.docx), markdown or text file up to 10 MB. Review the text before
            importing — nothing is saved or sent to the client until you confirm.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={fileRef}
          className="sr-only"
          type="file"
          tabIndex={-1}
          accept=".pdf,.docx,.md,.markdown,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void readFile(file);
            event.target.value = "";
          }}
        />
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <Button disabled={reading} onClick={() => fileRef.current?.click()}>
            {reading ? "Reading the document…" : "Choose a file"}
          </Button>
          {fileName ? <span className="min-w-0 truncate text-sm text-slate">{fileName}</span> : null}
        </div>

        {hasProposal ? (
          <p className="rounded-lg border border-border bg-muted p-3 text-sm text-foreground">
            This replaces the current proposal text and formatted documents. Its status stays the same.
          </p>
        ) : null}

        <label className="block text-sm font-medium">
          Document title
          <Input
            className="mt-1"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Website Enhancement Proposal"
          />
        </label>
        <label className="block text-sm font-medium">
          Secondary emails (optional)
          <Input
            className="mt-1"
            value={secondaryEmails}
            onChange={(event) => setSecondaryEmails(event.target.value)}
            placeholder="collaborator@example.com, reviewer@example.com"
          />
          <span className="mt-1 block text-xs font-normal text-slate">
            Collaborators receive project emails and can view documents, share resources and help with UAT. Only the primary contact can approve or sign.
          </span>
        </label>
        <label className="block text-sm font-medium">
          Proposal text
          <Textarea
            className="mt-1 min-h-[18rem] font-mono text-xs"
            value={markdown}
            onChange={(event) => setMarkdown(event.target.value)}
            placeholder="Upload a file or paste the proposal here. Use '## ' for section headings."
          />
        </label>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            className="shadow-cta"
            disabled={!markdown.trim() || reading || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Importing…" : "Import proposal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
