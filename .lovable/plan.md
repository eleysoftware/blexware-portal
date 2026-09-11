# Upload a PDF or Word proposal on "Import an existing project"

Today the import page only accepts `.md` or `.txt` files and reads them in the browser. You should be able to drop in the actual proposal PDF or Word document you sent the client, and have it come back as a BLEXware-formatted proposal.

## What changes for you

On **Import an existing project**:

1. The upload box accepts **PDF, Word (.docx), Markdown and plain text**, up to 10 MB.
2. After the file is read, the text is turned into a clean BLEXware proposal — headings, overview, scope, deliverables, timeline, investment — and dropped into the Proposal content box.
3. Where the document makes it obvious, the client name, company, email, project type and document title are filled in for you too.
4. Everything stays editable, and nothing is saved until you press **Import project** — same as now.
5. If a file can't be read (a scanned/image-only PDF, for example), you get a plain message telling you to copy the text in manually, instead of a silent failure.

## Notes and limits

- Scanned PDFs that contain pictures of text rather than real text can't be read; there's no text to extract. The message will say so.
- Word `.doc` (old format) is not supported — only `.docx`. The message will say so.
- Formatting like tables and images is not carried over; the result is the written content restructured into BLEXware's proposal sections.
- Extraction is a draft: always read it over before importing.

## Technical approach

- New `src/lib/documents/extract.server.ts`
  - `.docx`: unzip with `fflate` (pure JS, Worker-safe), read `word/document.xml`, map `<w:p>` to paragraphs and `<w:t>` runs to text; map heading styles (`Heading1/2`) to `#`/`##`, list paragraphs to `-`.
  - `.pdf`: `unpdf` (`extractText`), which ships a Worker-compatible pdf.js build. Empty/near-empty output → throw the "looks like a scan" message.
  - `.md`/`.txt`: passthrough.
  - No `child_process`, `sharp`, or native deps — Worker runtime constraints respected.
- New server fn `extractProposalFromFile` in `src/lib/import.functions.ts`:
  - `.middleware([requireSupabaseAuth])` + `requireAdmin`, wrapped in the existing `guarded(...)` helper so real errors go to logs and the user sees a friendly message.
  - Input: `{ fileName, contentType, base64 }`; 10 MB cap validated before decode.
  - Extract raw text, then run one AI pass through the existing `src/lib/ai.server.ts` (model chosen by the current admin AI settings) with a prompt that reformats the text into BLEXware proposal markdown using `##` section headings, and returns JSON `{ markdown, documentTitle?, contactName?, contactEmail?, company?, projectType? }`.
  - If the AI key is unavailable, fall back to returning the extracted text as-is (graceful degradation, matching how regenerate behaves today).
- `src/routes/_authenticated/admin/import.tsx`:
  - Widen the `accept` attribute; for `.md`/`.txt` keep the current instant client-side read, for `.pdf`/`.docx` base64 the file and call the server fn behind a "Reading document…" pending state.
  - Prefill only fields the extraction confidently returns; never overwrite a field the admin already typed.
- New unit test `tests/unit/proposal-extract.spec.ts` covering the DOCX XML → markdown mapping and the size/type guards, using a small fixture built with the existing `docx` dependency.
- New dependencies: `fflate`, `unpdf`.
