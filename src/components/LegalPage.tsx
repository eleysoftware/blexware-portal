import type { ReactNode } from "react";

import { PageHero } from "@/components/PageHero";
import { Section } from "@/components/Section";

export function LegalPage({
  eyebrow,
  title,
  intro,
  updated,
  sections,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  updated: string;
  sections: { heading: string; body: ReactNode }[];
}) {
  return (
    <>
      <PageHero eyebrow={eyebrow} title={title} description={intro} />
      <Section tone="surface">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm text-slate">Last updated: {updated}</p>
          <div className="mt-8 space-y-10">
            {sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-xl">{section.heading}</h2>
                <div className="mt-3 space-y-4 text-base leading-relaxed text-slate">
                  {section.body}
                </div>
              </section>
            ))}
          </div>
        </div>
      </Section>
    </>
  );
}
