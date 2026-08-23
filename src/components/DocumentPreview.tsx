import type { DocSection, ProjectDocument } from "@/lib/documents/types";
import { runningHeader } from "@/lib/documents/types";

const navy = "#1F4E79";

function toneClass(tone?: string) {
  if (tone === "fill" || tone === "total") return "bg-[#D6E3F0] font-semibold";
  if (tone === "discount") return "bg-[#E8F5E9]";
  if (tone === "muted") return "bg-[#F5F5F5]";
  return "";
}

function SectionView({ section }: { section: DocSection }) {
  if (section.callout) {
    return (
      <aside
        className={`rounded-sm px-4 py-3 text-sm ${
          section.callout === "success" ? "bg-[#E8F5E9]" : "bg-[#D6E3F0]"
        }`}
      >
        <p className="font-semibold text-[#333333]">{section.heading}</p>
        {(section.body ?? []).map((paragraph, index) => (
          <p key={index} className="mt-2 text-[#333333]">
            {paragraph}
          </p>
        ))}
        {section.note ? <p className="mt-2 text-xs text-[#333333]">{section.note}</p> : null}
      </aside>
    );
  }

  const headingClass =
    section.level === 3
      ? "text-[11pt] font-bold"
      : section.level === 2
        ? "text-[12pt] font-bold"
        : "text-[14pt] font-bold";

  return (
    <section className="space-y-2">
      <h4 className={headingClass} style={{ color: navy }}>
        {section.heading}
      </h4>
      {(section.body ?? []).map((paragraph, bodyIndex) => (
        <p key={bodyIndex} className="text-[10pt] leading-relaxed text-[#333333]">
          {paragraph}
        </p>
      ))}
      {section.groups?.map((group) => (
        <div key={group.heading} className="mt-2">
          <p className="text-[10pt] font-bold text-[#333333]">{group.heading}</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-[10pt] text-[#333333]">
            {group.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        </div>
      ))}
      {section.bullets?.length ? (
        <ul className="list-disc space-y-1 pl-5 text-[10pt] text-[#333333]">
          {section.bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      ) : null}
      {section.table ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-[10pt]">
            <thead>
              <tr className="bg-[#D6E3F0]">
                {section.table.columns.map((column, columnIndex) => (
                  <th
                    key={column}
                    className={`border border-[#CCCCCC] px-3 py-2 text-left font-semibold ${
                      section.table!.numeric && columnIndex > 0 ? "text-right" : ""
                    }`}
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.table.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className={toneClass(section.table!.rowTones?.[rowIndex])}>
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className={`border border-[#CCCCCC] px-3 py-2 ${
                        section.table!.numeric && cellIndex > 0 ? "text-right" : ""
                      }`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {section.note ? <p className="text-xs text-[#666666]">{section.note}</p> : null}
      {section.children?.map((child, index) => (
        <SectionView key={`${child.heading}-${index}`} section={child} />
      ))}
    </section>
  );
}

/** Read-only on-screen rendering of a proposal / estimate / SOW document. */
export function DocumentPreview({ doc }: { doc: ProjectDocument }) {
  const header = runningHeader(doc);
  const [left, right] = header.split(" | ");

  return (
    <article className="mx-auto max-w-[8.5in] space-y-5 bg-white px-8 py-6 text-[#333333] shadow-sm">
      <div className="border-b-2 pb-2" style={{ borderColor: navy }}>
        <p className="text-[9pt]">
          <span className="font-bold" style={{ color: navy }}>
            {left}
          </span>
          {right ? <span className="text-[#666666]">{"  |  "}{right}</span> : null}
        </p>
      </div>

      <header className="space-y-1 text-center">
        <h3 className="text-[18pt] font-bold" style={{ color: navy }}>
          {doc.title}
        </h3>
        {doc.subtitle ? <p className="text-[13pt] font-bold">{doc.subtitle}</p> : null}
        {doc.projectLabel ? <p className="text-[11pt] text-[#666666]">{doc.projectLabel}</p> : null}
      </header>

      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-[10pt] font-bold" style={{ color: navy }}>
            Prepared For:
          </dt>
          <dd className="mt-1 text-[10pt]">
            <p className="font-bold">
              {doc.preparedFor.name}
              {doc.preparedFor.title ? `, ${doc.preparedFor.title}` : ""}
            </p>
            {doc.preparedFor.company ? <p className="text-[#666666]">{doc.preparedFor.company}</p> : null}
            {doc.preparedFor.email ? <p className="text-[#666666]">{doc.preparedFor.email}</p> : null}
            {doc.preparedFor.phone ? <p className="text-[#666666]">{doc.preparedFor.phone}</p> : null}
          </dd>
        </div>
        <div>
          <dt className="text-[10pt] font-bold" style={{ color: navy }}>
            Prepared By:
          </dt>
          <dd className="mt-1 text-[10pt]">
            <p className="font-bold">{doc.preparedBy.name}</p>
            {doc.preparedBy.company ? <p className="text-[#666666]">{doc.preparedBy.company}</p> : null}
            {doc.preparedBy.email ? <p className="text-[#666666]">{doc.preparedBy.email}</p> : null}
            {doc.preparedBy.phone ? <p className="text-[#666666]">{doc.preparedBy.phone}</p> : null}
          </dd>
        </div>
      </dl>

      <p className="text-center text-[10pt] font-bold" style={{ color: navy }}>
        Proposal Date: {doc.date}
      </p>

      {doc.facts?.length ? (
        <div className="bg-[#D6E3F0] px-4 py-3 text-[10pt]">
          {doc.facts.slice(0, 1).map((fact) => (
            <p key={fact.label} className="font-bold">
              {fact.label}: {fact.value}
            </p>
          ))}
          {doc.facts.length > 1 ? (
            <p className="mt-1">
              {doc.facts
                .slice(1)
                .map((fact) => `${fact.label}: ${fact.value}`)
                .join("  •  ")}
            </p>
          ) : null}
        </div>
      ) : null}

      {doc.sections.map((section, index) => (
        <SectionView key={`${section.heading}-${index}`} section={section} />
      ))}

      {doc.acceptance ? (
        <footer className="space-y-2 border-t border-[#CCCCCC] pt-5">
          <h4 className="text-[14pt] font-bold" style={{ color: navy }}>
            {doc.kind === "sow" ? "Agreement Acceptance" : "Proposal Acceptance"}
          </h4>
          {(doc.acceptance.intro ?? []).map((line, index) => (
            <p key={index} className="text-[10pt] leading-relaxed">
              {line}
            </p>
          ))}
          <p className="text-[10pt] font-bold">Accepted By:</p>
          <p className="text-[10pt]">Name: {doc.acceptance.signerName ?? ""}</p>
          <p className="text-[10pt]">Date: {doc.acceptance.signedAt ?? ""}</p>
          <p className="text-[10pt]">
            Signature:{" "}
            {doc.acceptance.signatureText ? (
              <span className="font-semibold">{doc.acceptance.signatureText}</span>
            ) : (
              ""
            )}
          </p>
          {doc.acceptance.signatureText ? (
            <p className="text-xs text-[#666666]">
              Signed electronically through the BLEXware client portal. This electronic signature is legally
              binding.
            </p>
          ) : null}
          {doc.acceptance.countersign ? (
            <div className="pt-4">
              <p className="text-[10pt] font-bold">Accepted for BLEXware:</p>
              <p className="text-[10pt]">
                Name: {doc.acceptance.countersign.name}
                {doc.acceptance.countersign.title ? ` — ${doc.acceptance.countersign.title}` : ""}
              </p>
              <p className="text-[10pt]">Date: {doc.acceptance.countersign.signedAt}</p>
              <p className="text-[10pt]">
                Signature:{" "}
                <span
                  className="text-[16pt]"
                  style={{ fontFamily: '"Segoe Script","Brush Script MT","Snell Roundhand",cursive' }}
                >
                  {doc.acceptance.countersign.signatureText}
                </span>
              </p>
              {doc.acceptance.countersign.startDate ? (
                <p className="text-[10pt]">Project start date: {doc.acceptance.countersign.startDate}</p>
              ) : null}
            </div>
          ) : null}

          <div className="pt-4 text-[10pt]">
            <p className="font-bold" style={{ color: navy }}>
              Prepared By
            </p>
            <p className="font-bold">{doc.preparedBy.name}</p>
            <p className="text-[#666666]">{doc.preparedBy.company}</p>
            <p className="text-[#666666]">{doc.preparedBy.phone}</p>
            <p className="text-[#666666]">{doc.preparedBy.email}</p>
            <p className="text-[#666666]">{doc.date}</p>
          </div>
        </footer>
      ) : null}

      <p className="border-t border-[#CCCCCC] pt-3 text-center text-[8pt] text-[#666666]">
        BLEXware • Confidential
      </p>
    </article>
  );
}
