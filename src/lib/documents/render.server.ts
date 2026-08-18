// Server-only renderers. Both libraries are pure JS and Worker-safe.
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  LevelFormat,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import type { DocSection, DocTable, DocTableRowTone, ProjectDocument } from "@/lib/documents/types";
import { runningHeader } from "@/lib/documents/types";

const NAVY = rgb(31 / 255, 78 / 255, 121 / 255);
const BODY = rgb(51 / 255, 51 / 255, 51 / 255);
const MUTED = rgb(102 / 255, 102 / 255, 102 / 255);
const BLUE_FILL = rgb(214 / 255, 227 / 255, 240 / 255);
const GREEN_FILL = rgb(232 / 255, 245 / 255, 233 / 255);
const GRAY_FILL = rgb(245 / 255, 245 / 255, 245 / 255);
const RULE = rgb(204 / 255, 204 / 255, 204 / 255);

const NAVY_HEX = "1F4E79";
const BODY_HEX = "333333";
const MUTED_HEX = "666666";

function toneFill(tone: DocTableRowTone | undefined): ReturnType<typeof rgb> | null {
  if (tone === "fill" || tone === "total") return BLUE_FILL;
  if (tone === "discount") return GREEN_FILL;
  if (tone === "muted") return GRAY_FILL;
  return null;
}

function toneHex(tone: DocTableRowTone | undefined, header = false): string | undefined {
  if (header) return "D6E3F0";
  if (tone === "fill" || tone === "total") return "D6E3F0";
  if (tone === "discount") return "E8F5E9";
  if (tone === "muted") return "F5F5F5";
  return undefined;
}

function headingSize(level?: 1 | 2 | 3) {
  if (level === 3) return 11;
  if (level === 2) return 12;
  return 14;
}

/* ------------------------------------------------------------------ PDF */

export async function renderPdf(doc: ProjectDocument): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const width = 612;
  const height = 792;
  const margin = 54;
  const headerY = height - 36;
  const footerY = 28;
  const contentTop = height - 58;
  const contentBottom = 52;
  const contentWidth = width - margin * 2;
  const headerText = runningHeader(doc);

  let page = pdf.addPage([width, height]);
  let y = contentTop;
  const pages = [page];

  const newPage = () => {
    page = pdf.addPage([width, height]);
    pages.push(page);
    y = contentTop;
  };

  const ensure = (needed: number) => {
    if (y - needed < contentBottom) newPage();
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
    opts: {
      size?: number;
      font?: typeof regular;
      color?: typeof BODY;
      x?: number;
      maxWidth?: number;
      gap?: number;
      align?: "left" | "center" | "right";
    } = {},
  ) => {
    const size = opts.size ?? 10;
    const font = opts.font ?? regular;
    const max = opts.maxWidth ?? contentWidth;
    const align = opts.align ?? "left";
    for (const line of wrap(text, size, font, max)) {
      ensure(size + 4);
      const textWidth = font.widthOfTextAtSize(line, size);
      let x = opts.x ?? margin;
      if (align === "center") x = margin + (contentWidth - textWidth) / 2;
      if (align === "right") x = (opts.x ?? margin + contentWidth) - textWidth;
      page.drawText(line, { x, y: y - size, size, font, color: opts.color ?? BODY });
      y -= size + 3;
    }
    y -= opts.gap ?? 0;
  };

  const drawCallout = (section: DocSection) => {
    const fill = section.callout === "success" ? GREEN_FILL : BLUE_FILL;
    const parts = [
      section.heading,
      ...(section.body ?? []),
      ...(section.note ? [section.note] : []),
    ];
    const lines = parts.flatMap((part, index) =>
      wrap(part, index === 0 ? 10 : 9.5, index === 0 ? bold : regular, contentWidth - 16),
    );
    const boxHeight = lines.length * 13 + 16;
    ensure(boxHeight + 8);
    page.drawRectangle({
      x: margin,
      y: y - boxHeight,
      width: contentWidth,
      height: boxHeight,
      color: fill,
    });
    let cursor = y - 12;
    parts.forEach((part, index) => {
      const font = index === 0 ? bold : regular;
      const size = index === 0 ? 10 : 9.5;
      for (const line of wrap(part, size, font, contentWidth - 16)) {
        page.drawText(line, { x: margin + 8, y: cursor - size, size, font, color: BODY });
        cursor -= size + 3;
      }
      cursor -= 2;
    });
    y -= boxHeight + 10;
  };

  const drawTable = (table: DocTable) => {
    const cols = table.columns.length;
    const firstWidth = cols === 2 ? contentWidth * 0.72 : contentWidth / cols;
    const otherWidth = cols === 2 ? contentWidth - firstWidth : contentWidth / cols;
    const colX = (index: number) => (index === 0 ? margin : margin + firstWidth + (index - 1) * otherWidth);
    const colW = (index: number) => (index === 0 ? firstWidth : otherWidth);

    const paintRow = (cells: string[], isHeader: boolean, tone?: DocTableRowTone) => {
      const size = 10;
      const font = isHeader || tone === "total" ? bold : regular;
      const wrapped = cells.map((cell, index) => wrap(cell, size, font, colW(index) - 12));
      const lines = Math.max(...wrapped.map((item) => item.length), 1);
      const rowHeight = lines * (size + 3) + 10;
      ensure(rowHeight + 2);
      const fill = isHeader ? BLUE_FILL : toneFill(tone);
      if (fill) {
        page.drawRectangle({
          x: margin,
          y: y - rowHeight,
          width: contentWidth,
          height: rowHeight,
          color: fill,
        });
      }
      wrapped.forEach((cellLines, index) => {
        const alignRight = Boolean(table.numeric && index > 0);
        cellLines.forEach((line, lineIndex) => {
          const textWidth = font.widthOfTextAtSize(line, size);
          const x = alignRight ? colX(index) + colW(index) - 6 - textWidth : colX(index) + 6;
          page.drawText(line, {
            x,
            y: y - 13 - lineIndex * (size + 3),
            size,
            font,
            color: BODY,
          });
        });
      });
      y -= rowHeight;
    };

    paintRow(table.columns, true);
    table.rows.forEach((dataRow, index) => paintRow(dataRow, false, table.rowTones?.[index]));
    y -= 10;
  };

  const drawSection = (section: DocSection) => {
    if (section.callout) {
      drawCallout(section);
      return;
    }
    ensure(36);
    y -= 6;
    drawText(section.heading, { size: headingSize(section.level), font: bold, color: NAVY });
    y -= 2;
    for (const paragraph of section.body ?? []) drawText(paragraph, { size: 10, gap: 4 });
    for (const group of section.groups ?? []) {
      drawText(group.heading, { size: 10, font: bold, gap: 2 });
      for (const bullet of group.bullets) {
        drawText(`•  ${bullet}`, { size: 10, x: margin + 12, maxWidth: contentWidth - 12 });
      }
      y -= 4;
    }
    for (const bullet of section.bullets ?? []) {
      drawText(`•  ${bullet}`, { size: 10, x: margin + 12, maxWidth: contentWidth - 12 });
    }
    if (section.bullets?.length) y -= 4;
    if (section.table) drawTable(section.table);
    if (section.note) drawText(section.note, { size: 9.5, color: MUTED, gap: 4 });
    for (const child of section.children ?? []) drawSection(child);
  };

  drawText(doc.title, { size: 18, font: bold, color: NAVY, align: "center", gap: 2 });
  if (doc.subtitle) drawText(doc.subtitle, { size: 13, font: bold, color: BODY, align: "center", gap: 2 });
  if (doc.projectLabel) drawText(doc.projectLabel, { size: 11, color: MUTED, align: "center", gap: 10 });

  const colWidth = contentWidth / 2 - 8;
  const partyTop = y;
  const drawParty = (label: string, party: ProjectDocument["preparedFor"], x: number) => {
    y = partyTop;
    drawText(`${label}:`, { size: 10, font: bold, color: NAVY, x, maxWidth: colWidth });
    const nameLine = party.title ? `${party.name}, ${party.title}` : party.name;
    drawText(nameLine, { size: 10, font: bold, x, maxWidth: colWidth });
    for (const line of [party.company, party.email, party.phone].filter(Boolean)) {
      drawText(String(line), { size: 10, color: MUTED, x, maxWidth: colWidth });
    }
    return y;
  };
  const leftEnd = drawParty("Prepared For", doc.preparedFor, margin);
  const rightEnd = drawParty("Prepared By", doc.preparedBy, margin + colWidth + 16);
  y = Math.min(leftEnd, rightEnd) - 8;

  drawText(`Proposal Date: ${doc.date}`, { size: 10, font: bold, color: NAVY, align: "center", gap: 8 });

  if (doc.facts?.length) {
    const factLines = [
      doc.facts.map((fact) => `${fact.label}:  ${fact.value}`).slice(0, 1).join(""),
      doc.facts
        .slice(1)
        .map((fact) => `${fact.label}: ${fact.value}`)
        .join("  •  "),
    ].filter(Boolean);
    const wrapped = factLines.flatMap((line, index) => wrap(line, index === 0 ? 11 : 10, index === 0 ? bold : regular, contentWidth - 16));
    const boxHeight = wrapped.length * 14 + 14;
    ensure(boxHeight + 8);
    page.drawRectangle({
      x: margin,
      y: y - boxHeight,
      width: contentWidth,
      height: boxHeight,
      color: BLUE_FILL,
    });
    let cursor = y - 12;
    factLines.forEach((line, index) => {
      const font = index === 0 ? bold : regular;
      const size = index === 0 ? 11 : 10;
      for (const wrappedLine of wrap(line, size, font, contentWidth - 16)) {
        page.drawText(wrappedLine, { x: margin + 8, y: cursor - size, size, font, color: BODY });
        cursor -= size + 3;
      }
    });
    y -= boxHeight + 12;
  }

  for (const section of doc.sections) drawSection(section);

  if (doc.acceptance) {
    ensure(140);
    y -= 8;
    drawText(doc.kind === "sow" ? "Agreement Acceptance" : "Proposal Acceptance", {
      size: 14,
      font: bold,
      color: NAVY,
    });
    for (const line of doc.acceptance.intro ?? []) drawText(line, { size: 10, gap: 4 });
    y -= 6;
    drawText("Accepted By:", { size: 10, font: bold });
    drawText(`Name: ${doc.acceptance.signerName ?? ""}`, { size: 10 });
    drawText(`Date: ${doc.acceptance.signedAt ?? ""}`, { size: 10 });
    drawText(
      `Signature: ${doc.acceptance.signatureText ?? ""}`,
      { size: 10, font: doc.acceptance.signatureText ? bold : regular },
    );
    if (doc.acceptance.signatureText) {
      drawText(
        "Signed electronically through the BLEXware client portal. This electronic signature is legally binding.",
        { size: 9, color: MUTED },
      );
    }
    y -= 10;
    drawText("Prepared By", { size: 10, font: bold, color: NAVY });
    drawText(doc.preparedBy.name, { size: 10, font: bold });
    for (const line of [doc.preparedBy.company, doc.preparedBy.phone, doc.preparedBy.email, doc.date].filter(Boolean)) {
      drawText(String(line), { size: 10, color: MUTED });
    }
  }

  pages.forEach((p, index) => {
    const [left, right] = headerText.split(" | ");
    p.drawText(left ?? headerText, { x: margin, y: headerY, size: 9, font: bold, color: NAVY });
    if (right) {
      const suffix = `  |  ${right}`;
      const leftWidth = bold.widthOfTextAtSize(left ?? "", 9);
      p.drawText(suffix, { x: margin + leftWidth, y: headerY, size: 9, font: regular, color: MUTED });
    }
    p.drawLine({
      start: { x: margin, y: headerY - 6 },
      end: { x: width - margin, y: headerY - 6 },
      thickness: 1.25,
      color: NAVY,
    });
    const footer = `BLEXware  •  Page ${index + 1} of ${pages.length}${doc.confidentialFooter === false ? "" : "  •  Confidential"}`;
    const footerWidth = regular.widthOfTextAtSize(footer, 8);
    p.drawLine({
      start: { x: margin, y: footerY + 12 },
      end: { x: width - margin, y: footerY + 12 },
      thickness: 0.6,
      color: RULE,
    });
    p.drawText(footer, { x: (width - footerWidth) / 2, y: footerY, size: 8, font: regular, color: MUTED });
  });

  return pdf.save();
}

/* ----------------------------------------------------------------- DOCX */

const FONT = "Arial";

function docxParagraph(
  text: string,
  options: {
    bold?: boolean;
    size?: number;
    color?: string;
    spacing?: number;
    before?: number;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
  } = {},
) {
  return new Paragraph({
    alignment: options.align,
    spacing: { after: options.spacing ?? 120, before: options.before ?? 0 },
    children: [
      new TextRun({
        text,
        bold: options.bold ?? false,
        size: options.size ?? 20,
        color: options.color ?? BODY_HEX,
        font: FONT,
      }),
    ],
  });
}

function docxHeading(text: string, level: 1 | 2 | 3 = 1) {
  const size = level === 3 ? 22 : level === 2 ? 24 : 28;
  const heading =
    level === 3 ? HeadingLevel.HEADING_3 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_1;
  return new Paragraph({
    heading,
    spacing: { before: level === 1 ? 280 : 200, after: 120 },
    children: [new TextRun({ text, bold: true, size, font: FONT, color: NAVY_HEX })],
  });
}

function docxTable(table: DocTable) {
  const total = 9360;
  const cols = table.columns.length;
  const widths =
    cols === 2 ? [Math.round(total * 0.72), total - Math.round(total * 0.72)] : Array(cols).fill(Math.round(total / cols));
  const border = { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" };
  const borders = { top: border, bottom: border, left: border, right: border };

  const makeRow = (cells: string[], header: boolean, tone?: DocTableRowTone) => {
    const fill = toneHex(tone, header);
    return new TableRow({
      children: cells.map(
        (cell, index) =>
          new TableCell({
            borders,
            width: { size: widths[index] ?? 0, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            ...(fill ? { shading: { fill, type: ShadingType.CLEAR, color: "auto" } } : {}),
            children: [
              new Paragraph({
                alignment: table.numeric && index > 0 ? AlignmentType.RIGHT : AlignmentType.LEFT,
                children: [
                  new TextRun({
                    text: cell,
                    bold: header || tone === "total",
                    size: 20,
                    font: FONT,
                    color: BODY_HEX,
                  }),
                ],
              }),
            ],
          }),
      ),
    });
  };

  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: widths,
    rows: [makeRow(table.columns, true), ...table.rows.map((row, index) => makeRow(row, false, table.rowTones?.[index]))],
  });
}

function docxCallout(section: DocSection) {
  const fill = section.callout === "success" ? "E8F5E9" : "D6E3F0";
  const lines = [section.heading, ...(section.body ?? []), ...(section.note ? [section.note] : [])];
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { fill, type: ShadingType.CLEAR, color: "auto" },
            margins: { top: 120, bottom: 120, left: 160, right: 160 },
            children: lines.map(
              (line, index) =>
                new Paragraph({
                  spacing: { after: 80 },
                  children: [
                    new TextRun({
                      text: line,
                      bold: index === 0,
                      size: index === 0 ? 20 : 19,
                      font: FONT,
                      color: BODY_HEX,
                    }),
                  ],
                }),
            ),
          }),
        ],
      }),
    ],
  });
}

function docxSection(section: DocSection): (Paragraph | Table)[] {
  if (section.callout) return [docxCallout(section), new Paragraph({ spacing: { after: 160 }, children: [] })];
  const nodes: (Paragraph | Table)[] = [docxHeading(section.heading, section.level ?? 1)];
  for (const paragraph of section.body ?? []) nodes.push(docxParagraph(paragraph));
  for (const group of section.groups ?? []) {
    nodes.push(docxParagraph(group.heading, { bold: true, spacing: 80 }));
    for (const bullet of group.bullets) {
      nodes.push(
        new Paragraph({
          numbering: { reference: "blex-bullets", level: 0 },
          spacing: { after: 60 },
          children: [new TextRun({ text: bullet, size: 20, font: FONT, color: BODY_HEX })],
        }),
      );
    }
  }
  for (const bullet of section.bullets ?? []) {
    nodes.push(
      new Paragraph({
        numbering: { reference: "blex-bullets", level: 0 },
        spacing: { after: 60 },
        children: [new TextRun({ text: bullet, size: 20, font: FONT, color: BODY_HEX })],
      }),
    );
  }
  if (section.table) nodes.push(docxTable(section.table), new Paragraph({ spacing: { after: 160 }, children: [] }));
  if (section.note) nodes.push(docxParagraph(section.note, { size: 19, color: MUTED_HEX }));
  for (const child of section.children ?? []) nodes.push(...docxSection(child));
  return nodes;
}

export async function renderDocx(doc: ProjectDocument): Promise<Uint8Array> {
  const children: (Paragraph | Table)[] = [];
  const headerText = runningHeader(doc);
  const [headerLeft, headerRight] = headerText.split(" | ");

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [new TextRun({ text: doc.title, bold: true, size: 36, font: FONT, color: NAVY_HEX })],
    }),
  );
  if (doc.subtitle) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [new TextRun({ text: doc.subtitle, bold: true, size: 26, font: FONT, color: BODY_HEX })],
      }),
    );
  }
  if (doc.projectLabel) {
    children.push(docxParagraph(doc.projectLabel, { size: 22, color: MUTED_HEX, align: AlignmentType.CENTER }));
  }

  const partyCell = (label: string, party: ProjectDocument["preparedFor"]) =>
    new TableCell({
      margins: { top: 80, bottom: 80, left: 80, right: 160 },
      children: [
        docxParagraph(`${label}:`, { bold: true, color: NAVY_HEX, spacing: 40 }),
        docxParagraph(party.title ? `${party.name}, ${party.title}` : party.name, { bold: true, spacing: 40 }),
        ...[party.company, party.email, party.phone]
          .filter(Boolean)
          .map((line) => docxParagraph(String(line), { size: 20, color: MUTED_HEX, spacing: 40 })),
      ],
    });

  children.push(
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [4680, 4680],
      rows: [new TableRow({ children: [partyCell("Prepared For", doc.preparedFor), partyCell("Prepared By", doc.preparedBy)] })],
    }),
  );
  children.push(
    docxParagraph(`Proposal Date: ${doc.date}`, {
      bold: true,
      color: NAVY_HEX,
      align: AlignmentType.CENTER,
      before: 160,
    }),
  );

  if (doc.facts?.length) {
    const lines = [
      doc.facts.slice(0, 1).map((fact) => `${fact.label}:  ${fact.value}`).join(""),
      doc.facts.slice(1).map((fact) => `${fact.label}: ${fact.value}`).join("  •  "),
    ].filter(Boolean);
    children.push(
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                shading: { fill: "D6E3F0", type: ShadingType.CLEAR, color: "auto" },
                margins: { top: 120, bottom: 120, left: 160, right: 160 },
                children: lines.map((line, index) =>
                  docxParagraph(line, { bold: index === 0, size: index === 0 ? 22 : 20, spacing: 60 }),
                ),
              }),
            ],
          }),
        ],
      }),
    );
    children.push(new Paragraph({ spacing: { after: 200 }, children: [] }));
  }

  for (const section of doc.sections) children.push(...docxSection(section));

  if (doc.acceptance) {
    children.push(docxHeading(doc.kind === "sow" ? "Agreement Acceptance" : "Proposal Acceptance"));
    for (const line of doc.acceptance.intro ?? []) children.push(docxParagraph(line));
    children.push(docxParagraph("Accepted By:", { bold: true }));
    children.push(docxParagraph(`Name: ${doc.acceptance.signerName ?? ""}`));
    children.push(docxParagraph(`Date: ${doc.acceptance.signedAt ?? ""}`));
    children.push(
      docxParagraph(`Signature: ${doc.acceptance.signatureText ?? ""}`, {
        bold: Boolean(doc.acceptance.signatureText),
      }),
    );
    children.push(docxParagraph("Prepared By", { bold: true, color: NAVY_HEX, before: 200 }));
    children.push(docxParagraph(doc.preparedBy.name, { bold: true, spacing: 40 }));
    for (const line of [doc.preparedBy.company, doc.preparedBy.phone, doc.preparedBy.email, doc.date].filter(Boolean)) {
      children.push(docxParagraph(String(line), { color: MUTED_HEX, spacing: 40 }));
    }
  }

  const document = new Document({
    styles: { default: { document: { run: { font: FONT, size: 20 } } } },
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
            margin: { top: 1080, right: 1080, bottom: 1080, left: 1080, header: 708, footer: 708 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: NAVY_HEX, space: 4 } },
                spacing: { after: 120 },
                children: [
                  new TextRun({ text: headerLeft ?? headerText, bold: true, size: 18, font: FONT, color: NAVY_HEX }),
                  ...(headerRight
                    ? [new TextRun({ text: `  |  ${headerRight}`, size: 18, font: FONT, color: MUTED_HEX })]
                    : []),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                border: { top: { style: BorderStyle.SINGLE, size: 6, color: "CCCCCC", space: 4 } },
                spacing: { before: 80 },
                children: [
                  new TextRun({ text: "BLEXware  •  Page ", size: 16, font: FONT, color: MUTED_HEX }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, font: FONT, color: MUTED_HEX }),
                  new TextRun({ text: " of ", size: 16, font: FONT, color: MUTED_HEX }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, font: FONT, color: MUTED_HEX }),
                  new TextRun({
                    text: doc.confidentialFooter === false ? "" : "  •  Confidential",
                    size: 16,
                    font: FONT,
                    color: MUTED_HEX,
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(document);
  return new Uint8Array(buffer);
}
