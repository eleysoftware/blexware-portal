/** Pure helpers that turn stored SOW files into a revision history. */
export type StoredDoc = { id: string; entity: string; entity_id: string; format: string; created_at: string };
export type SowAgreement = { id: string; agreement_number: string; status: string; created_at?: string };
export type SowRevision = {
  key: string;
  agreementId: string;
  agreementNumber: string;
  agreementStatus: string;
  revision: number;
  generatedAt: string;
  pdfId: string | null;
  docxId: string | null;
  latest: boolean;
};

const PAIR_WINDOW_MS = 30_000;

/** One revision per PDF/DOCX render pair, newest first, numbered across all SOWs. */
export function sowRevisions(docs: StoredDoc[], agreements: SowAgreement[]): SowRevision[] {
  const byId = new Map(agreements.map((a) => [a.id, a]));
  const files = docs
    .filter((d) => d.entity === "agreement" && byId.has(d.entity_id))
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  const groups: { agreementId: string; at: number; pdf: StoredDoc | null; docx: StoredDoc | null }[] = [];
  for (const file of files) {
    const at = Date.parse(file.created_at);
    const fmt = file.format === "pdf" ? "pdf" : "docx";
    const group = groups.find(
      (g) => g.agreementId === file.entity_id && !g[fmt] && Math.abs(g.at - at) <= PAIR_WINDOW_MS,
    );
    if (group) group[fmt] = file;
    else groups.push({ agreementId: file.entity_id, at, pdf: fmt === "pdf" ? file : null, docx: fmt === "docx" ? file : null });
  }
  groups.sort((a, b) => a.at - b.at);
  const revisions = groups.map((g, index) => {
    const agreement = byId.get(g.agreementId)!;
    return {
      key: `${g.agreementId}-${g.at}`,
      agreementId: g.agreementId,
      agreementNumber: agreement.agreement_number,
      agreementStatus: agreement.status,
      revision: index + 1,
      generatedAt: new Date(g.at).toISOString(),
      pdfId: g.pdf?.id ?? null,
      docxId: g.docx?.id ?? null,
      latest: false,
    };
  });
  if (revisions.length) revisions[revisions.length - 1].latest = true;
  return revisions.reverse();
}
