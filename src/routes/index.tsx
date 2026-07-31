import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  Cloud,
  LayoutDashboard,
  Monitor,
  Plug,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  Users,
  Workflow,
  Wrench,
} from "lucide-react";

import { CtaBand } from "@/components/CtaBand";
import { Section, SectionHeading } from "@/components/Section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import heroImage from "@/assets/hero-collage.jpg";
import teamCollab from "@/assets/team-collab.jpg";

import { articles, formatDate } from "@/content/articles";
import { industryGroups } from "@/content/industries";
import { portfolio } from "@/content/portfolio";
import { processSteps, services } from "@/content/services";
import { testimonials } from "@/content/testimonials";

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

const title = "BLEXware — Custom Software, Web Apps & AI Automation";
const description =
  "BLEXware designs and builds custom websites, web applications, mobile apps, and AI automation for businesses across 25+ industries. Get a free quote.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <>
      <section className="hero-gradient relative overflow-hidden bg-surface">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-2 lg:px-8 lg:py-28">
          <div>
            <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-semibold">
              Websites · Web Apps · Mobile · AI
            </Badge>
            <h1 className="mt-5 text-4xl leading-[1.08] sm:text-5xl lg:text-6xl">
              Custom software for businesses that outgrew the template.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate">
              We build the websites, portals, and automations that replace the spreadsheets, manual
              hand-offs, and off-the-shelf tools holding your business together.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="shadow-cta">
                <Link to="/free-quote">
                  Get a Free Quote
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/portfolio">See our work</Link>
              </Button>
            </div>
            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-6 border-t border-border pt-6">
              {[
                { value: "25+", label: "Industries served" },
                { value: "9", label: "Service lines" },
                { value: "7-step", label: "Delivery process" },
              ].map((stat) => (
                <div key={stat.label}>
                  <dt className="sr-only">{stat.label}</dt>
                  <dd>
                    <span className="block text-2xl font-bold text-headline">{stat.value}</span>
                    <span className="mt-1 block text-xs text-slate">{stat.label}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative">
            <img
              src={heroImage}
              alt="Laptop and phone showing a custom analytics dashboard built by BLEXware"
              width={1408}
              height={1008}
              className="w-full rounded-2xl"
            />
          </div>
        </div>
      </section>

      <Section tone="surface">
        <SectionHeading
          eyebrow="Services"
          title="One partner from first sketch to ongoing support"
          description="Nine service lines that cover the entire life of a product — not just the launch."
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => {
            const Icon = icons[service.icon];
            return (
              <Card key={service.slug} className="card-lift border-border/80 shadow-card">
                <CardContent className="p-6">
                  <span className="inline-flex size-11 items-center justify-center rounded-xl bg-accent text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 text-lg">{service.name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate">{service.summary}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <div className="mt-10 text-center">
          <Button asChild variant="outline">
            <Link to="/services">
              Explore all services
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </Section>

      <Section tone="mint">
        <SectionHeading
          eyebrow="Industries"
          title="We speak your industry before the first meeting"
          description="Eight sectors, twenty-five specialties. Each one gets software shaped around how that business actually runs."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {industryGroups.map((group) => (
            <Link
              key={group.id}
              to="/industries"
              hash={group.id}
              className="card-lift rounded-xl border border-border bg-surface p-6 shadow-card"
            >
              <h3 className="text-base">{group.label}</h3>
              <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate">{group.headline}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                View <ArrowRight className="size-3.5" aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      </Section>

      <Section tone="surface">
        <SectionHeading
          eyebrow="Selected work"
          title="Products in production, not concept slides"
        />
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {portfolio.map((project) => (
            <Link
              key={project.slug}
              to="/portfolio/$slug"
              params={{ slug: project.slug }}
              className="card-lift group overflow-hidden rounded-xl border border-border bg-surface shadow-card"
            >
              <img
                src={project.image}
                alt={project.imageAlt}
                loading="lazy"
                width={1200}
                height={800}
                className="aspect-[3/2] w-full object-cover"
              />
              <div className="p-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                  {project.category}
                </p>
                <h3 className="mt-2 text-lg">{project.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate">{project.summary}</p>
              </div>
            </Link>
          ))}
        </div>
      </Section>

      <Section>
        <SectionHeading
          eyebrow="Process"
          title="A seven-step process with no mystery phases"
          description="You always know what is happening now, what is next, and what it costs."
        />
        <ol className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {processSteps.map((step, index) => (
            <li
              key={step.name}
              className="rounded-xl border border-border bg-surface p-6 shadow-card"
            >
              <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
                {index + 1}
              </span>
              <h3 className="mt-4 text-base">{step.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate">{step.description}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section tone="surface">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <img
            src={teamCollab}
            alt="Two BLEXware engineers reviewing code together at a shared workstation"
            loading="lazy"
            width={1200}
            height={800}
            className="w-full rounded-2xl object-cover shadow-card"
          />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Who we are
            </p>
            <h2 className="mt-3 text-3xl leading-tight">
              BLEX stands for Black Excellence — and excellence here means people, not just code.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-slate">
              We are a Black-led team of engineers and consultants who build software the way it
              should be built: audited, accessible, and documented. Just as importantly, we build
              the relationship behind it — plain-language explanations, honest pushback, and the
              same people on the call a year after launch.
            </p>
            <Button asChild variant="outline" className="mt-7">
              <Link to="/about">
                Meet the team behind the name
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </Section>



      <Section tone="surface">
        <SectionHeading eyebrow="Clients" title="What working with us is like" />
        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {testimonials.map((item) => (
            <figure
              key={item.id}
              className="flex h-full flex-col rounded-xl border border-border bg-background p-6 shadow-card"
            >
              <div className="flex gap-0.5" aria-label={`${item.rating} out of 5 stars`}>
                {Array.from({ length: item.rating }).map((_, i) => (
                  <Star key={i} className="size-4 fill-mint text-mint" aria-hidden="true" />
                ))}
              </div>
              <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-slate">
                “{item.review}”
              </blockquote>
              <figcaption className="mt-5 flex items-center gap-3 border-t border-border pt-4">
                <span className="inline-flex size-9 items-center justify-center rounded-full bg-accent text-xs font-bold text-primary">
                  {item.initials}
                </span>
                <span className="text-sm">
                  <span className="block font-semibold text-headline">{item.clientName}</span>
                  <span className="block text-xs text-slate">{item.company}</span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </Section>

      <Section tone="mint">
        <div className="grid items-start gap-10 lg:grid-cols-2">
          <div>
            <SectionHeading
              align="left"
              eyebrow="Trust"
              title="Security and accessibility are part of the build, not an add-on"
              description="Every project ships with hardened headers, validated inputs, least-privilege data access, and WCAG 2.2 AA checks."
            />
            <Button asChild variant="outline" className="mt-6 bg-surface">
              <Link to="/security">Read our security practices</Link>
            </Button>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: ShieldCheck, text: "Encrypted in transit and at rest" },
              { icon: BadgeCheck, text: "WCAG 2.2 AA accessibility target" },
              { icon: ShieldCheck, text: "Malware-scanned, size-limited uploads" },
              { icon: BadgeCheck, text: "Human review on every AI output" },
            ].map((item) => (
              <li
                key={item.text}
                className="flex gap-3 rounded-xl border border-border bg-surface p-5 text-sm text-slate shadow-card"
              >
                <item.icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                {item.text}
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section tone="surface">
        <SectionHeading eyebrow="Resources" title="Notes from the build" />
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {articles.slice(0, 3).map((article) => (
            <Link
              key={article.slug}
              to="/resources/$slug"
              params={{ slug: article.slug }}
              className="card-lift overflow-hidden rounded-xl border border-border bg-background shadow-card"
            >
              <img
                src={article.image}
                alt={article.imageAlt}
                loading="lazy"
                width={1200}
                height={700}
                className="aspect-[12/7] w-full object-cover"
              />
              <div className="p-6">
                <p className="text-xs text-slate">
                  {formatDate(article.publishedDate)} · {article.readTime}
                </p>
                <h3 className="mt-2 text-base leading-snug">{article.title}</h3>
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate">
                  {article.summary}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </Section>

      <CtaBand />
    </>
  );
}
