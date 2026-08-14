import type { ProjectDocument } from "@/lib/documents/types";

/** Read-only on-screen rendering of a proposal / estimate / SOW document. */
export function DocumentPreview({ doc }: { doc: ProjectDocument }) {
  return (
    <article className="space-y-6 text-sm leading-relaxed text-foreground">
      <header className="border-b border-border pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">BLEXware</p>
        <h3 className="mt-2 text-xl font-bold">{doc.title}</h3>
        {doc.subtitle ? <p className="mt-1 text-slate">{doc.subtitle}</p> : null}
        {doc.documentNumber ? <p className="mt-1 text-xs text-slate">{doc.documentNumber}</p> : null}
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate">Prepared for</dt>
            <dd className="mt-1">
              {doc.preparedFor.name}
              {doc.preparedFor.company ? ` · ${doc.preparedFor.company}` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate">Prepared by</dt>
            <dd className="mt-1">
              {doc.preparedBy.name} · {doc.preparedBy.company}
            </dd>
          </div>
        </dl>
        {(doc.facts ?? []).map((fact) => (
          <p key={fact.label} className="mt-2 font-semibold">
            {fact.label}: {fact.value}
          </p>
        ))}
      </header>

      {doc.sections.map((section, index) => (
        <section key={`${section.heading}-${index}`}>
          <h4
            className={
              section.level === 2
                ? "text-base font-semibold text-primary"
                : "text-lg font-semibold text-primary"
            }
          >
            {section.heading}
          </h4>
          {(section.body ?? []).map((paragraph, bodyIndex) => (
            <p key={bodyIndex} className="mt-2">
              {paragraph}
            </p>
          ))}
          {section.bullets?.length ? (
            <ul className="mt-3 list-disc space-y-1 pl-5">
              {section.bullets.map((bullet, bulletIndex) => (
                <li key={bulletIndex}>{bullet}</li>
              ))}
            </ul>
          ) : null}
          {section.table ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-surface">
                    {section.table.columns.map((column, columnIndex) => (
                      <th
                        key={column}
                        className={`border border-border px-3 py-2 text-left font-semibold ${
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
                    <tr key={rowIndex}>
                      {row.map((cell, cellIndex) => (
                        <td
                          key={cellIndex}
                          className={`border border-border px-3 py-2 ${
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
          {section.note ? <p className="mt-3 text-xs text-slate">{section.note}</p> : null}
        </section>
      ))}

      {doc.acceptance ? (
        <footer className="border-t border-border pt-5">
          <h4 className="text-lg font-semibold text-primary">
            {doc.kind === "sow" ? "Agreement acceptance" : "Acceptance"}
          </h4>
          {(doc.acceptance.intro ?? []).map((line, index) => (
            <p key={index} className="mt-2">
              {line}
            </p>
          ))}
          {doc.acceptance.signatureText ? (
            <p className="mt-3 text-slate">
              Signed by <span className="font-semibold text-foreground">{doc.acceptance.signatureText}</span>
              {doc.acceptance.signedAt ? ` on ${doc.acceptance.signedAt}` : ""}
            </p>
          ) : null}
        </footer>
      ) : null}
    </article>
  );
}
