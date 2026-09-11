/**
 * Turns an uploaded proposal file (PDF, .docx, markdown, plain text) into
 * markdown-ish text we can feed into the BLEXware proposal builder.
 * Pure JS only — this runs in the Worker runtime.
 */
import { UserFacingError } from "@/lib/errors";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_m, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&amp;/g, "&");
}

/** Maps a WordprocessingML body into markdown paragraphs, headings and bullets. */
export function docxXmlToMarkdown(xml: string): string {
  const paragraphs = xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? [];
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const text = decodeXmlEntities(
      (paragraph.match(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g) ?? [])
        .map((run) => run.replace(/<w:t(?:\s[^>]*)?>/, "").replace(/<\/w:t>/, ""))
        .join(""),
    )
      .replace(/\s+/g, " ")
      .trim();

    if (!text) {
      if (lines.length && lines[lines.length - 1] !== "") lines.push("");
      continue;
    }

    const styleMatch = paragraph.match(/<w:pStyle\s+w:val="([^"]+)"/);
    const style = styleMatch?.[1] ?? "";
    const headingLevel = /^Heading(\d)$/i.exec(style)?.[1];
    const isTitle = /^Title$/i.test(style);
    const isList = /<w:numPr[ >/]/.test(paragraph) || /ListParagraph/i.test(style);

    if (isTitle) lines.push(`# ${text}`);
    else if (headingLevel) lines.push(`${"#".repeat(Math.min(Number(headingLevel) + 1, 6))} ${text}`);
    else if (isList) lines.push(`- ${text}`);
    else lines.push(text);

    if (isTitle || headingLevel) lines.push("");
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

async function extractDocx(bytes: Uint8Array): Promise<string> {
  const { unzipSync, strFromU8 } = await import("fflate");
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, { filter: (file) => file.name === "word/document.xml" });
  } catch {
    throw new UserFacingError(
      "That Word file could not be opened. Save it as .docx (not .doc) and try again.",
    );
  }
  const entry = files["word/document.xml"];
  if (!entry) {
    throw new UserFacingError(
      "That does not look like a .docx file. Old .doc files are not supported — save it as .docx or paste the text below.",
    );
  }
  return docxXmlToMarkdown(strFromU8(entry));
}

async function extractPdf(bytes: Uint8Array): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return (Array.isArray(text) ? text.join("\n\n") : text)
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type ExtractInput = { fileName: string; contentType?: string; bytes: Uint8Array };

/** Returns the document's text. Throws a user-facing error when it cannot be read. */
export async function extractDocumentText({
  fileName,
  contentType,
  bytes,
}: ExtractInput): Promise<string> {
  if (!bytes.length) throw new UserFacingError("That file is empty.");
  if (bytes.length > MAX_UPLOAD_BYTES) {
    throw new UserFacingError("That file is larger than 10 MB. Please upload a smaller document.");
  }

  const name = fileName.toLowerCase();
  const type = (contentType ?? "").toLowerCase();
  let text: string;

  if (name.endsWith(".pdf") || type.includes("pdf")) {
    text = await extractPdf(bytes);
  } else if (name.endsWith(".docx") || type.includes("wordprocessingml")) {
    text = await extractDocx(bytes);
  } else if (name.endsWith(".doc")) {
    throw new UserFacingError(
      "Old .doc files are not supported. Save the document as .docx or PDF and try again.",
    );
  } else if (name.endsWith(".md") || name.endsWith(".markdown") || name.endsWith(".txt")) {
    const { strFromU8 } = await import("fflate");
    text = strFromU8(bytes).trim();
  } else {
    throw new UserFacingError("Upload a PDF, Word (.docx), markdown or plain text file.");
  }

  if (text.replace(/\s/g, "").length < 40) {
    throw new UserFacingError(
      "No readable text was found — the document may be a scan or picture of a page. Copy the text out of it and paste it below instead.",
    );
  }
  return text;
}
