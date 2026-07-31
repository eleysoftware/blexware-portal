import { createFileRoute } from "@tanstack/react-router";

import { LegalPage } from "@/components/LegalPage";
import { CONTACT_EMAIL } from "@/content/site";

const title = "Security & Compliance — BLEXware";
const description =
  "How BLEXware secures the software it builds: encryption, least-privilege access, validated inputs, scanned uploads, accessibility, and responsible AI use.";

export const Route = createFileRoute("/security")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: SecurityPage,
});

function SecurityPage() {
  return (
    <LegalPage
      eyebrow="Trust"
      title="Security & Compliance"
      intro="Security is scoped into every engagement from the first estimate, not bolted on before launch."
      updated="July 31, 2026"
      sections={[
        {
          heading: "Data protection",
          body: (
            <p>
              All traffic is served over TLS with HSTS. Data at rest is encrypted by the managed
              platforms we deploy on. Access to production data follows least privilege, and every
              privileged action is logged.
            </p>
          ),
        },
        {
          heading: "Application hardening",
          body: (
            <p>
              We validate and sanitize every input on the server, enforce strict security headers and
              a content security policy, apply rate limiting to public endpoints, and protect forms
              against automated abuse.
            </p>
          ),
        },
        {
          heading: "File uploads",
          body: (
            <p>
              Uploads are restricted by type and size, stored outside the web root with
              non-guessable names, scanned for malware, and served only through short-lived signed
              links.
            </p>
          ),
        },
        {
          heading: "Responsible AI",
          body: (
            <p>
              AI features never act autonomously on client-facing output. Generation is triggered by
              a person, prompts and outputs are versioned and retained for audit, and AI assistance is
              disclosed to recipients. Provider abstraction means a vendor outage does not stop work.
            </p>
          ),
        },
        {
          heading: "Accessibility",
          body: (
            <p>
              We target WCAG 2.2 AA: semantic structure, keyboard operability, visible focus, contrast
              checks, and screen reader testing on interactive flows.
            </p>
          ),
        },
        {
          heading: "Reporting a vulnerability",
          body: (
            <p>
              Found something? Email{" "}
              <a className="text-primary underline underline-offset-2" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>{" "}
              with details and steps to reproduce. We acknowledge reports within two business days and
              will not pursue action against good-faith research.
            </p>
          ),
        },
      ]}
    />
  );
}
