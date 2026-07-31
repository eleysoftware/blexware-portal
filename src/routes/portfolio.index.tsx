import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { CtaBand } from "@/components/CtaBand";
import { PageHero } from "@/components/PageHero";
import { Section } from "@/components/Section";
import { Badge } from "@/components/ui/badge";
import { portfolio } from "@/content/portfolio";

const title = "Portfolio — Software We've Shipped | BLEXware";
const description =
  "Case studies from BLEXware: Build Financial Wellness, KYC Investments, and SportE Golf — production platforms in finance, investment, and sports technology.";

export const Route = createFileRoute("/portfolio/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: PortfolioPage,
});

function PortfolioPage() {
  return (
    <>
      <PageHero
        eyebrow="Portfolio"
        title="Work that went live and stayed live"
        description="Three platforms across financial consulting, private investment, and sports operations — each solving a specific, expensive problem."
      />

      <Section tone="surface">
        <div className="space-y-8">
          {portfolio.map((project, index) => (
            <article
              key={project.slug}
              className="overflow-hidden rounded-2xl border border-border bg-background shadow-card"
            >
              <div className={`grid lg:grid-cols-2 ${index % 2 === 1 ? "lg:[&>figure]:order-last" : ""}`}>
                <figure className="m-0">
                  <img
                    src={project.image}
                    alt={project.imageAlt}
                    loading="lazy"
                    width={1200}
                    height={800}
                    className="h-full min-h-64 w-full object-cover"
                  />
                </figure>
                <div className="p-7 sm:p-10">
                  <Badge variant="secondary" className="rounded-full">
                    {project.category}
                  </Badge>
                  <h2 className="mt-4 text-2xl">{project.name}</h2>
                  <p className="mt-3 text-sm leading-relaxed text-slate">{project.description}</p>
                  <ul className="mt-5 flex flex-wrap gap-2">
                    {project.technologies.map((tech) => (
                      <li
                        key={tech}
                        className="rounded-full border border-border px-3 py-1 text-xs text-slate"
                      >
                        {tech}
                      </li>
                    ))}
                  </ul>
                  <Link
                    to="/portfolio/$slug"
                    params={{ slug: project.slug }}
                    className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary-hover"
                  >
                    Read the case study
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </Section>

      <CtaBand title="Your project could be the next one here." />
    </>
  );
}
