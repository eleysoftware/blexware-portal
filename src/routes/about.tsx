import { createFileRoute } from "@tanstack/react-router";
import { Compass, HeartHandshake, ShieldCheck, Sparkles, Target } from "lucide-react";

import { CtaBand } from "@/components/CtaBand";
import { PageHero } from "@/components/PageHero";
import { Section, SectionHeading } from "@/components/Section";
import { processSteps } from "@/content/services";
import teamCollab from "@/assets/team-collab.jpg";
import workshopImage from "@/assets/workshop.jpg";
import engineerPortrait from "@/assets/engineer-portrait.jpg";

const title = "About BLEXware — Black Excellence in Custom Software";
const description =
  "BLEX stands for Black Excellence. BLEXware is a software studio building custom websites, applications, and AI automation — and long-term relationships with the people we build for.";

const values = [
  {
    icon: Target,
    name: "Outcomes over output",
    copy: "We measure a project by what it changed in the business, not how many screens it shipped with.",
  },
  {
    icon: ShieldCheck,
    name: "Secure by default",
    copy: "Validation, least-privilege access, encryption, and audit trails are part of the estimate — never an upsell.",
  },
  {
    icon: HeartHandshake,
    name: "Straight answers",
    copy: "If a feature is a bad idea or a cheaper tool already solves it, we say so before you spend money.",
  },
  {
    icon: Compass,
    name: "Built to be maintained",
    copy: "Boring, documented architecture that another engineer can pick up two years from now.",
  },
  {
    icon: Sparkles,
    name: "Relationships outlast releases",
    copy: "Clients stay with us for years because we treat the partnership — not the ticket queue — as the product.",
  },
];


export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About"
        title="A software studio that stays after launch"
        description="BLEXware exists because too many businesses were sold a website, handed a login, and left alone. We build systems and then keep them healthy."
      />

      <Section tone="surface">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <div>
            <h2 className="text-3xl sm:text-4xl">Our mission</h2>
            <p className="mt-5 text-base leading-relaxed text-slate">
              Make custom software a realistic option for organizations that were told they had to
              settle for templates and duct-taped subscriptions. That means honest scoping, a fixed
              process, and technology chosen for the client's next five years rather than our resume.
            </p>
            <p className="mt-4 text-base leading-relaxed text-slate">
              We work across twenty-five industries, from financial consulting to golf tournament
              operations. What connects them is the same pattern: a manual process that stopped
              scaling, and a team ready to replace it with something they own.
            </p>
          </div>
          <img
            src={teamCollab}
            alt="Two BLEXware engineers reviewing code together at a shared workstation"
            loading="lazy"
            width={1200}
            height={800}
            className="w-full rounded-2xl object-cover shadow-card"
          />
        </div>
      </Section>

      <Section>
        <SectionHeading eyebrow="Process" title="How engagements run" />
        <ol className="mx-auto mt-12 grid max-w-4xl gap-x-8 gap-y-4 sm:grid-cols-2">
          {processSteps.map((step, index) => (
            <li key={step.name} className="flex gap-4 text-sm">
              <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent text-xs font-bold text-primary">
                {index + 1}
              </span>
              <span>
                <span className="font-semibold text-headline">{step.name}</span>
                <span className="mt-0.5 block leading-relaxed text-slate">{step.description}</span>
              </span>
            </li>
          ))}
        </ol>
      </Section>

      <Section tone="mint">
        <SectionHeading eyebrow="Values" title="Five commitments we hold to on every project" />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {values.map((value) => (
            <div
              key={value.name}
              className="card-lift rounded-xl border border-border bg-surface p-6 shadow-card"
            >
              <span className="inline-flex size-11 items-center justify-center rounded-xl bg-accent text-primary">
                <value.icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-lg">{value.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate">{value.copy}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section tone="surface">
        <SectionHeading
          eyebrow="The people"
          title="You will know the engineers building your product"
          description="No account-manager relay. The people in discovery are the people writing the code and answering your questions after launch."
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          <img
            src={workshopImage}
            alt="A BLEXware tech lead facilitating a discovery workshop at a whiteboard with clients"
            loading="lazy"
            width={1200}
            height={800}
            className="h-full w-full rounded-2xl object-cover shadow-card"
          />
          <img
            src={engineerPortrait}
            alt="A BLEXware engineer building an analytics dashboard at a standing desk"
            loading="lazy"
            width={1000}
            height={1000}
            className="h-full w-full rounded-2xl object-cover shadow-card"
          />
        </div>
      </Section>

      <CtaBand />

    </>
  );
}
