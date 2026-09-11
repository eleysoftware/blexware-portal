import { expect, test } from "@playwright/test";

import { docxXmlToMarkdown, extractDocumentText } from "@/lib/documents/extract.server";

const XML = `
<w:document xmlns:w="x"><w:body>
<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>Website Enhancement Proposal</w:t></w:r></w:p>
<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Overview</w:t></w:r></w:p>
<w:p><w:r><w:t>We will rebuild the </w:t></w:r><w:r><w:t>marketing site &amp; portal.</w:t></w:r></w:p>
<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/></w:numPr></w:pPr><w:r><w:t>Discovery workshop</w:t></w:r></w:p>
<w:p/>
</w:body></w:document>`;

test("maps Word XML into markdown headings, text and bullets", () => {
  const markdown = docxXmlToMarkdown(XML);
  expect(markdown).toContain("# Website Enhancement Proposal");
  expect(markdown).toContain("## Overview");
  expect(markdown).toContain("We will rebuild the marketing site & portal.");
  expect(markdown).toContain("- Discovery workshop");
});

test("rejects unsupported and empty files with a readable message", async () => {
  await expect(
    extractDocumentText({ fileName: "proposal.doc", bytes: new Uint8Array(64) }),
  ).rejects.toThrow(/\.docx/);

  await expect(
    extractDocumentText({ fileName: "notes.txt", bytes: new Uint8Array(0) }),
  ).rejects.toThrow(/empty/i);

  await expect(
    extractDocumentText({ fileName: "proposal.pages", bytes: new Uint8Array(64) }),
  ).rejects.toThrow(/PDF, Word/);
});

test("flags text-free documents as scans", async () => {
  const bytes = new TextEncoder().encode("Proposal");
  await expect(extractDocumentText({ fileName: "short.txt", bytes })).rejects.toThrow(/scan|picture/i);
});
