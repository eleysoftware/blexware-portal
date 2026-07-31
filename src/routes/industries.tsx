import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";

import { CtaBand } from "@/components/CtaBand";
import { PageHero } from "@/components/PageHero";
import { Section } from "@/components/Section";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { industriesByGroup, industryGroups } from "@/content/industries";
import { getProject } from "@/content/portfolio";

const title = "Industries We Serve — BLEXware";
const description =
  "Custom software for 25+ industries across business services, real estate, sports, entertainment, healthcare, education, nonprofit, and technology.";

export const Route = createFileRoute("/industries")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: IndustriesPage,
});

function IndustriesPage() {
  return (
    <>
      <PageHero
        eyebrow="Industries"
        title="Twenty-five specialties. Eight sectors. One engineering partner."
        description="We do not learn your business on your budget. Pick your sector to see the systems we build and the outcomes they produce."
      />

      <Section tone="surface">
        <Tabs defaultValue={industryGroups[0].id} className="gap-8">
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-accent/60 p-1.5">
            {industryGroups.map((group) => (
              <TabsTrigger key={group.id} value={group.id} className="px-4 py-2 text-sm">
                {group.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {industryGroups.map((group) => (
            <TabsContent key={group.id} value={group.id} id={group.id} className="scroll-mt-24">
              <div className="max-w-3xl">
                <h2 className="text-2xl sm:text-3xl">{group.headline}</h2>
                <p className="mt-3 text-base leading-relaxed text-slate">{group.intro}</p>
              </div>

              <div className="mt-10 grid gap-5 lg:grid-cols-2">
                {industriesByGroup(group.id).map((industry) => (
                  <article
                    key={industry.slug}
                    className="card-lift flex h-full flex-col rounded-xl border border-border bg-background p-6 shadow-card"
                  >
                    <h3 className="text-lg">{industry.name}</h3>
                    <p className="mt-1 text-sm font-medium text-primary">{industry.tagline}</p>
                    <p className="mt-3 text-sm leading-relaxed text-slate">{industry.copy}</p>
                    <ul className="mt-4 space-y-2">
                      {industry.benefits.map((benefit) => (
                        <li key={benefit} className="flex gap-2 text-sm text-slate">
                          <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                          {benefit}
                        </li>
                      ))}
                    </ul>
                    {industry.portfolio.length > 0 ? (
                      <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
                        {industry.portfolio.map((slug) => {
                          const project = getProject(slug);
                          if (!project) return null;
                          return (
                            <Link
                              key={slug}
                              to="/portfolio/$slug"
                              params={{ slug }}
                              className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-xs font-medium text-primary hover:bg-mint/40"
                            >
                              {project.name}
                              <ArrowRight className="size-3" aria-hidden="true" />
                            </Link>
                          );
                        })}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>

              <div className="mt-10">
                <Button asChild>
                  <Link to="/free-quote">Get a quote for {group.label.toLowerCase()}</Link>
                </Button>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </Section>

      <CtaBand />
    </>
  );
}
