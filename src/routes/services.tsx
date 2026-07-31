import { createFileRoute } from "@tanstack/react-router";
import {
  Check,
  Cloud,
  LayoutDashboard,
  Monitor,
  Plug,
  Smartphone,
  Sparkles,
  Users,
  Workflow,
  Wrench,
} from "lucide-react";

import { CtaBand } from "@/components/CtaBand";
import { PageHero } from "@/components/PageHero";
import { Section, SectionHeading } from "@/components/Section";
import { processSteps, services } from "@/content/services";

const icons = {
  monitor: Monitor,
  "layout-dashboard": LayoutDashboard,
  smartphone: Smartphone,
  sparkles: Sparkles,
  workflow: Workflow,
  users: Users,
  wrench: Wrench,
  cloud: Cloud,
  plug: Plug,
} as const;

const title = "Services — Web, Mobile, AI & Custom Software | BLEXware";
const description =
  "Websites, web applications, mobile apps, AI solutions, automation, consulting, maintenance, cloud migration, and custom APIs — delivered by one team.";

export const Route = createFileRoute("/services")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: ServicesPage,
});

function ServicesPage() {
  return (
    <>
      <PageHero
        eyebrow="Services"
        title="Everything required to ship and keep software running"
        description="Nine service lines, one accountable team. No hand-offs to a subcontractor you never met."
      />

      <Section tone="surface">
        <div className="grid gap-6 lg:grid-cols-2">
          {services.map((service) => {
            const Icon = icons[service.icon];
            return (
              <article
                key={service.slug}
                id={service.slug}
                className="card-lift scroll-mt-24 rounded-xl border border-border bg-background p-7 shadow-card"
              >
                <span className="inline-flex size-12 items-center justify-center rounded-xl bg-accent text-primary">
                  <Icon className="size-6" aria-hidden="true" />
                </span>
                <h2 className="mt-5 text-xl">{service.name}</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate">{service.summary}</p>
                <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                  {service.details.map((detail) => (
                    <li key={detail} className="flex gap-2 text-sm text-slate">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                      {detail}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </Section>

      <Section tone="mint">
        <SectionHeading
          eyebrow="How we work"
          title="Seven steps, written down before we start"
          description="Each phase has a deliverable you can review. Nothing moves forward on a verbal maybe."
        />
        <ol className="mt-12 space-y-4">
          {processSteps.map((step, index) => (
            <li
              key={step.name}
              className="flex gap-5 rounded-xl border border-border bg-surface p-6 shadow-card"
            >
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
                {index + 1}
              </span>
              <div>
                <h3 className="text-base">{step.name}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <CtaBand title="Not sure which service you need?" description="Describe the problem — we will tell you what it actually takes to solve it." />
    </>
  );
}
