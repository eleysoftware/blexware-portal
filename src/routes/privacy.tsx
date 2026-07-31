import { createFileRoute } from "@tanstack/react-router";

import { LegalPage } from "@/components/LegalPage";
import { CONTACT_EMAIL } from "@/content/site";

const title = "Privacy Policy — BLEXware";
const description =
  "How BLEXware collects, uses, stores, and protects personal data submitted through our website, contact form, and quote requests.";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { name: "robots", content: "index,follow" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy Policy"
      intro="We collect the minimum information needed to answer your inquiry and deliver your project — nothing else."
      updated="July 31, 2026"
      sections={[
        {
          heading: "Information we collect",
          body: (
            <>
              <p>
                We collect the details you submit through our contact and quote forms: name, email
                address, optional company and phone number, and the description of your project. We
                also collect basic technical data such as IP address and browser type for security
                and abuse prevention.
              </p>
              <p>
                Files you upload as part of a quote request are stored securely and are limited by
                type and size.
              </p>
            </>
          ),
        },
        {
          heading: "How we use it",
          body: (
            <p>
              Your information is used to respond to your inquiry, prepare a proposal, deliver
              contracted work, and meet legal obligations. We do not sell personal data, and we do
              not use client content to train machine-learning models.
            </p>
          ),
        },
        {
          heading: "AI-assisted drafting",
          body: (
            <p>
              Proposal drafts may be generated with AI assistance and are always reviewed by a person
              before you receive them. Where a third-party model provider is used, only the project
              details required to produce the draft are shared.
            </p>
          ),
        },
        {
          heading: "Retention",
          body: (
            <p>
              Inquiry records are retained for as long as needed to serve you and to satisfy legal,
              tax, and accounting requirements, then deleted or anonymized.
            </p>
          ),
        },
        {
          heading: "Your rights",
          body: (
            <p>
              You may request access to, correction of, or deletion of your personal data, and you
              may object to certain processing. Email{" "}
              <a className="text-primary underline underline-offset-2" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>{" "}
              and we will respond within 30 days.
            </p>
          ),
        },
        {
          heading: "Cookies",
          body: (
            <p>
              We use only the cookies required for the site to function and for aggregate analytics.
              No advertising or cross-site tracking cookies are set.
            </p>
          ),
        },
      ]}
    />
  );
}
