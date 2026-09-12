import { HelpCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function ProposalUploadHelp() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-slate">
          <HelpCircle className="h-4 w-4" />
          How this works
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Uploading an existing proposal</DialogTitle>
          <DialogDescription>
            Choose a PDF or Word file you already sent to a client. BLEXware reads it and prefills
            the project details below.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm text-slate">
          <section>
            <h3 className="font-semibold text-foreground">Supported files</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>PDF, Word (.docx), Markdown, or plain text</li>
              <li>Up to 10 MB</li>
              <li>Text-based documents work best</li>
            </ul>
            <p className="mt-2">
              Old <code>.doc</code> files and scanned/photo-only PDFs cannot be read. Save or export
              them as text PDFs or Word documents, or paste the text into the proposal field below.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-foreground">What gets filled in automatically</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>Client name, email, and company</li>
              <li>Project title and proposal text</li>
              <li>Priced line items with durations</li>
              <li>Discounts, subtotal, and total</li>
              <li>Project duration or timeline note</li>
              <li>Phases or milestones</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-foreground">
              What the file should contain for cost &amp; schedule estimates
            </h3>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>
                Each line item with a label, dollar amount, and optional duration — for example,{" "}
                <em>Discovery — $1,200 — 1 week</em>.
              </li>
              <li>A subtotal and any discount listed near the total.</li>
              <li>A project duration or timeline stated explicitly, such as "6-8 weeks".</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-foreground">Where each part lands</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>Pricing goes to the Cost &amp; schedule estimate section.</li>
              <li>Phases go to the Milestones board as "Not started".</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-foreground">Review before importing</h3>
            <p>
              Everything is a draft until you press <strong>Import project</strong>. Nothing is
              sent to the client automatically. If something is missing, edit the fields below or
              upload a cleaner file.
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
