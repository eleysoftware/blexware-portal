import { createFileRoute } from "@tanstack/react-router";

import { LegalPage } from "@/components/LegalPage";
import { CONTACT_EMAIL } from "@/content/site";

const title = "Terms of Service — BLEXware";
const description =
  "The terms that govern use of the BLEXware website, quote requests, and the engagement of BLEXware for software development services.";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms of Service"
      intro="Plain terms covering use of this website and the quotes we produce from it."
      updated="July 31, 2026"
      sections={[
        {
          heading: "Using this site",
          body: (
            <p>
              You may browse and use this website for lawful purposes. You may not attempt to
              interfere with its operation, probe it for vulnerabilities without written permission,
              or submit content you do not have the right to share.
            </p>
          ),
        },
        {
          heading: "Quotes and proposals",
          body: (
            <p>
              Quotes generated from the free quote form are non-binding estimates based on the
              information provided. Final scope, price, and timeline are set out in a signed
              agreement. Proposal drafts may be AI-assisted and are reviewed by a person before
              delivery.
            </p>
          ),
        },
        {
          heading: "Intellectual property",
          body: (
            <p>
              Site content, branding, and code are owned by BLEXware. Work product created under a
              signed client agreement transfers according to that agreement, typically on full
              payment.
            </p>
          ),
        },
        {
          heading: "Content you submit",
          body: (
            <p>
              You retain ownership of everything you send us. You grant us permission to use it only
              to evaluate your request and deliver the services you engage us for.
            </p>
          ),
        },
        {
          heading: "Limitation of liability",
          body: (
            <p>
              This website is provided as is. To the extent permitted by law, BLEXware is not liable
              for indirect or consequential damages arising from its use. Liability for contracted
              services is governed by the applicable client agreement.
            </p>
          ),
        },
        {
          heading: "Contact",
          body: (
            <p>
              Questions about these terms:{" "}
              <a className="text-primary underline underline-offset-2" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          ),
        },
      ]}
    />
  );
}
