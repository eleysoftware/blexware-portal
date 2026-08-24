import { Badge } from "@/components/ui/badge";

export type AgreementSignatureInfo = {
  agreement_number: string;
  status: string;
  signed_at: string | null;
  signer_name: string | null;
  document_hash?: string | null;
};

export type Countersignature = {
  name: string;
  title?: string;
  signatureText: string;
  signedAt: string;
  startDate?: string;
};

function Row({
  party,
  name,
  meta,
  signature,
  signed,
  pending,
}: {
  party: string;
  name: string;
  meta?: string | null;
  signature?: string | null;
  signed: boolean;
  pending: string;
}) {
  return (
    <li className="rounded-xl border border-border px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate">{party}</span>
        <Badge variant={signed ? "secondary" : "outline"}>
          <span aria-hidden className="mr-1">
            {signed ? "✓" : "○"}
          </span>
          {signed ? "Signed" : "Awaiting signature"}
        </Badge>
      </div>
      <p className="mt-1 font-medium">{name}</p>
      {signed ? (
        <>
          {signature ? (
            <p
              className="mt-1 text-lg leading-none"
              style={{ fontFamily: '"Segoe Script","Brush Script MT","Snell Roundhand",cursive' }}
            >
              {signature}
            </p>
          ) : null}
          {meta ? <p className="mt-1 text-sm text-slate">{meta}</p> : null}
        </>
      ) : (
        <p className="mt-1 text-sm text-slate">{pending}</p>
      )}
    </li>
  );
}

/**
 * Both signatures on a Statement of Work in one place: the client's electronic
 * signature and BLEXware's countersignature, with timestamps and the signed
 * document hash for the audit trail.
 */
export function SignatureBlock({
  agreement,
  countersign,
  audience,
}: {
  agreement: AgreementSignatureInfo;
  countersign: Countersignature | null;
  audience: "admin" | "client";
}) {
  const clientSigned = Boolean(agreement.signed_at);
  return (
    <div className="mt-5 border-t border-border pt-5">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate">Signatures</h3>
      <ul className="mt-3 space-y-3 text-sm" data-testid="sow-signatures">
        <Row
          party="Client"
          name={agreement.signer_name ?? "Client signatory"}
          signature={agreement.signer_name}
          signed={clientSigned}
          pending={
            audience === "admin"
              ? "Awaiting the client's electronic signature."
              : "Sign below to accept this Statement of Work."
          }
          meta={
            agreement.signed_at
              ? `Signed ${new Date(agreement.signed_at).toLocaleString()}${
                  agreement.document_hash ? ` · document hash ${agreement.document_hash.slice(0, 16)}…` : ""
                }`
              : null
          }
        />
        <Row
          party="BLEXware"
          name={countersign?.name ?? "Kamal Eley"}
          signature={countersign?.signatureText ?? null}
          signed={Boolean(countersign)}
          pending={
            clientSigned
              ? audience === "admin"
                ? "Approve the project start date below to countersign and issue the invoice schedule."
                : "Waiting on BLEXware to countersign and confirm your project start date."
              : "BLEXware countersigns once you've signed."
          }
          meta={
            countersign
              ? `${countersign.title ? `${countersign.title} · ` : ""}Signed ${countersign.signedAt}${
                  countersign.startDate ? ` · project starts ${countersign.startDate}` : ""
                }`
              : null
          }
        />
      </ul>
    </div>
  );
}
