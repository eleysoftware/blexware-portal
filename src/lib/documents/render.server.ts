// Server-only renderers. Both libraries are pure JS and Worker-safe.
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import type { DocSection, ProjectDocument } from "@/lib/documents/types";

const EMERALD = rgb(0.227, 0.561, 0.451);
const CHARCOAL = rgb(0.137, 0.153, 0.184);
const SLATE = rgb(0.369, 0.392, 0.439);
const LINE = rgb(0.9, 0.91, 0.92);

/* ------------------------------------------------------------------ PDF */

export async function renderPdf(doc: ProjectDocument): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const width = 612;
  const height = 792;
  const margin = 56;
  const contentWidth = width - margin * 2;

  let page = pdf.addPage([width, height]);
  let y = height - margin;
  const pages = [page];

  const newPage = () => {
    page = pdf.addPage([width, height]);
    pages.push(page);
    y = height - margin;
  };

  const ensure = (needed: number) => {
    if (y - needed < margin + 40) newPage();
  };

  const wrap = (text: string, size: number, font: typeof regular, max: number): string[] => {
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) > max && current) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
    return lines.length ? lines : [""];
  };

  const drawText = (
    text: string,
    opts: { size?: number; font?: typeof regular; color?: typeof CHARCOAL; x?: number; maxWidth?: number; gap?: number },
  ) => {
    const size = opts.size ?? 10.5;
    const font = opts.font ?? regular;
    const x = opts.x ?? margin;
    const max = opts.maxWidth ?? contentWidth;
    for (const line of wrap(text, size, font, max)) {
      ensure(size + 4);
      page.drawText(line, { x, y: y - size, size, font, color: opts.color ?? CHARCOAL });
      y -= size + 4;
    }
    y -= opts.gap ?? 0;
  };

  // Header block
  drawText("BLEXware", { size: 16, font: bold, color: EMERALD });
  y -= 6;
  drawText(doc.title, { size: 20, font: bold });
  if (doc.subtitle) drawText(doc.subtitle, { size: 12, color: SLATE, gap: 8 });
  if (doc.documentNumber) drawText(doc.documentNumber, { size: 10, color: SLATE });

  ensure(70);
  const colWidth = contentWidth / 2 - 10;
  const partyTop = y;
  const drawParty = (label: string, party: ProjectDocument["preparedFor"], x: number) => {
    y = partyTop;
    drawText(label, { size: 9, font: bold, color: SLATE, x, maxWidth: colWidth });
    drawText(party.name, { size: 11, font: bold, x, maxWidth: colWidth });
    for (const line of [party.title, party.company, party.email, party.phone].filter(Boolean)) {
      drawText(String(line), { size: 10, color: SLATE, x, maxWidth: colWidth });
    }
    return y;
  };
  const leftEnd = drawParty("PREPARED FOR", doc.preparedFor, margin);
  const rightEnd = drawParty("PREPARED BY", doc.preparedBy, margin + colWidth + 20);
  y = Math.min(leftEnd, rightEnd) - 6;

  drawText(`Date: ${doc.date}`, { size: 10, color: SLATE });
  for (const fact of doc.facts ?? []) {
    drawText(`${fact.label}: ${fact.value}`, { size: 11, font: bold });
  }

  y -= 10;
  ensure(20);
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 1,
    color: LINE,
  });
  y -= 18;

  const drawTable = (table: NonNullable<DocSection["table"]>) => {
    const cols = table.columns.length;
    const firstWidth = cols === 2 ? contentWidth * 0.68 : contentWidth / cols;
    const otherWidth = cols === 2 ? contentWidth - firstWidth : contentWidth / cols;
    const colX = (index: number) => (index === 0 ? margin : margin + firstWidth + (index - 1) * otherWidth);
    const colW = (index: number) => (index === 0 ? firstWidth : otherWidth);

    const row = (cells: string[], isHeader: boolean) => {
      const size = 10;
      const font = isHeader ? bold : regular;
      const wrapped = cells.map((cell, index) =>
        wrap(cell, size, font, colW(index) - 12),
      );
      const lines = Math.max(...wrapped.map((w) => w.length));
      const rowHeight = lines * (size + 3) + 10;
      ensure(rowHeight + 4);
      if (isHeader) {
        page.drawRectangle({
          x: margin,
          y: y - rowHeight,
          width: contentWidth,
          height: rowHeight,
          color: rgb(0.949, 0.968, 0.958),
        });
      }
      wrapped.forEach((cellLines, index) => {
        const alignRight = table.numeric && index > 0;
        cellLines.forEach((line, lineIndex) => {
          const textWidth = font.widthOfTextAtSize(line, size);
          const x = alignRight
            ? colX(index) + colW(index) - 6 - textWidth
            : colX(index) + 6;
          page.drawText(line, {
            x,
            y: y - 14 - lineIndex * (size + 3),
            size,
            font,
            color: CHARCOAL,
          });
        });
      });
      y -= rowHeight;
      page.drawLine({
        start: { x: margin, y },
        end: { x: width - margin, y },
        thickness: 0.6,
        color: LINE,
      });
    };

    row(table.columns, true);
    for (const dataRow of table.rows) row(dataRow, false);
    y -= 12;
  };

  for (const section of doc.sections) {
    ensure(40);
    y -= 6;
    drawText(section.heading, { size: section.level === 2 ? 12.5 : 14, font: bold, color: EMERALD });
    y -= 2;
    for (const paragraph of section.body ?? []) drawText(paragraph, { size: 10.5, gap: 4 });
    for (const bullet of section.bullets ?? []) {
      drawText(`•  ${bullet}`, { size: 10.5, x: margin + 10, maxWidth: contentWidth - 10 });
    }
    if (section.bullets?.length) y -= 4;
    if (section.table) {
      y -= 6;
      drawTable(section.table);
    }
    if (section.note) drawText(section.note, { size: 9.5, color: SLATE, gap: 4 });
  }

  if (doc.acceptance) {
    ensure(140);
    y -= 10;
    drawText(doc.kind === "sow" ? "Agreement Acceptance" : "Proposal Acceptance", {
      size: 14,
      font: bold,
      color: EMERALD,
    });
    for (const line of doc.acceptance.intro ?? []) drawText(line, { size: 10.5, gap: 4 });
    y -= 6;
    drawText(`Name: ${doc.acceptance.signerName ?? "____________________________"}`, { size: 11 });
    drawText(
      `Signature: ${doc.acceptance.signatureText ?? "____________________________"}`,
      { size: 11, font: doc.acceptance.signatureText ? bold : regular },
    );
    drawText(`Date: ${doc.acceptance.signedAt ?? "____________________________"}`, { size: 11 });
    if (doc.acceptance.signatureText) {
      drawText(
        "Signed electronically through the BLEXware client portal. This electronic signature is legally binding.",
        { size: 9, color: SLATE },
      );
    }
  }

  // Footers
  pages.forEach((p, index) => {
    p.drawText(
      `BLEXware  •  Page ${index + 1} of ${pages.length}${doc.confidentialFooter ? "  •  Confidential" : ""}`,
      { x: margin, y: 32, size: 8.5, font: regular, color: SLATE },
    );
  });

  return pdf.save();
}

/* ----------------------------------------------------------------- DOCX */

const FONT = "Arial";

function docxParagraph(text: string, options: { bold?: boolean; size?: number; color?: string; spacing?: number } = {}) {
  return new Paragraph({
    spacing: { after: options.spacing ?? 120 },
    children: [
      new TextRun({
        text,
        bold: options.bold ?? false,
        size: options.size ?? 22,
        color: options.color ?? "3F3F46",
        font: FONT,
      }),
    ],
  });
}

function docxTable(table: NonNullable<DocSection["table"]>) {
  const total = 9360;
  const cols = table.columns.length;
  const widths =
    cols === 2 ? [Math.round(total * 0.68), total - Math.round(total * 0.68)] : Array(cols).fill(Math.round(total / cols));
  const border = { style: BorderStyle.SINGLE, size: 1, color: "D8DCDF" };
  const borders = { top: border, bottom: border, left: border, right: border };

  const makeRow = (cells: string[], header: boolean) =>
    new TableRow({
      children: cells.map(
        (cell, index) =>
          new TableCell({
            borders,
            width: { size: widths[index] ?? 0, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            ...(header
              ? { shading: { fill: "EAF4EF", type: ShadingType.CLEAR, color: "auto" } }
              : {}),
            children: [
              new Paragraph({
                alignment: table.numeric && index > 0 ? AlignmentType.RIGHT : AlignmentType.LEFT,
                children: [new TextRun({ text: cell, bold: header, size: 20, font: FONT })],
              }),
            ],
          }),
      ),
    });

  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: widths,
    rows: [makeRow(table.columns, true), ...table.rows.map((row) => makeRow(row, false))],
  });
}

export async function renderDocx(doc: ProjectDocument): Promise<Uint8Array> {
  const children: (Paragraph | Table)[] = [];

  children.push(docxParagraph("BLEXware", { bold: true, size: 28, color: "3A8F73" }));
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 120 },
      children: [new TextRun({ text: doc.title, bold: true, size: 40, font: FONT, color: "23272F" })],
    }),
  );
  if (doc.subtitle) children.push(docxParagraph(doc.subtitle, { size: 24, color: "5E6470" }));
  if (doc.documentNumber) children.push(docxParagraph(doc.documentNumber, { size: 20, color: "5E6470" }));

  const partyLines = (label: string, party: ProjectDocument["preparedFor"]) =>
    [
      docxParagraph(label, { bold: true, size: 18, color: "5E6470", spacing: 40 }),
      docxParagraph(party.name, { bold: true, spacing: 40 }),
      ...[party.title, party.company, party.email, party.phone]
        .filter(Boolean)
        .map((line) => docxParagraph(String(line), { size: 20, color: "5E6470", spacing: 40 })),
    ];
  children.push(...partyLines("PREPARED FOR", doc.preparedFor));
  children.push(...partyLines("PREPARED BY", doc.preparedBy));
  children.push(docxParagraph(`Date: ${doc.date}`, { size: 20, color: "5E6470" }));
  for (const fact of doc.facts ?? []) {
    children.push(docxParagraph(`${fact.label}: ${fact.value}`, { bold: true }));
  }

  for (const section of doc.sections) {
    children.push(
      new Paragraph({
        heading: section.level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_1,
        spacing: { before: 240, after: 120 },
        children: [
          new TextRun({
            text: section.heading,
            bold: true,
            size: section.level === 2 ? 26 : 30,
            font: FONT,
            color: "3A8F73",
          }),
        ],
      }),
    );
    for (const paragraph of section.body ?? []) children.push(docxParagraph(paragraph));
    for (const bullet of section.bullets ?? []) {
      children.push(
        new Paragraph({
          numbering: { reference: "blex-bullets", level: 0 },
          spacing: { after: 60 },
          children: [new TextRun({ text: bullet, size: 22, font: FONT, color: "3F3F46" })],
        }),
      );
    }
    if (section.table) children.push(docxTable(section.table));
    if (section.note) children.push(docxParagraph(section.note, { size: 19, color: "5E6470" }));
  }

  if (doc.acceptance) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 280, after: 120 },
        children: [
          new TextRun({
            text: doc.kind === "sow" ? "Agreement Acceptance" : "Proposal Acceptance",
            bold: true,
            size: 30,
            font: FONT,
            color: "3A8F73",
          }),
        ],
      }),
    );
    for (const line of doc.acceptance.intro ?? []) children.push(docxParagraph(line));
    children.push(docxParagraph(`Name: ${doc.acceptance.signerName ?? "____________________"}`));
    children.push(
      docxParagraph(`Signature: ${doc.acceptance.signatureText ?? "____________________"}`, {
        bold: Boolean(doc.acceptance.signatureText),
      }),
    );
    children.push(docxParagraph(`Date: ${doc.acceptance.signedAt ?? "____________________"}`));
  }

  const document = new Document({
    styles: { default: { document: { run: { font: FONT, size: 22 } } } },
    numbering: {
      config: [
        {
          reference: "blex-bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
          },
        },
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(document);
  return new Uint8Array(buffer);
}
