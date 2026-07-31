import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { ArrowLeft, Check } from "lucide-react";

import { CtaBand } from "@/components/CtaBand";
import { Section } from "@/components/Section";
import { Badge } from "@/components/ui/badge";
import { getProject, portfolio, type PortfolioProject } from "@/content/portfolio";

export const Route = createFileRoute("/portfolio/$slug")({
  loader: ({ params }): { project: PortfolioProject } => {
    const project = getProject(params.slug);
    if (!project) throw notFound();
    return { project };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Case study not found — BLEXware" }, { name: "robots", content: "noindex" }],
      };
    }
    const t = `${loaderData.project.name} Case Study — BLEXware`;
    return {
      meta: [
        { title: t },
        { name: "description", content: loaderData.project.summary },
        { property: "og:title", content: t },
        { property: "og:description", content: loaderData.project.summary },
      ],
    };
  },
  component: ProjectPage,
});

function ProjectPage() {
  const { project } = Route.useLoaderData() as { project: PortfolioProject };
  const others = portfolio.filter((item) => item.slug !== project.slug);

  return (
    <>
      <section className="hero-gradient border-b border-border/70 bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <Link
            to="/portfolio"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate hover:text-headline"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            All work
          </Link>
          <Badge variant="secondary" className="mt-6 rounded-full">
            {project.category}
          </Badge>
          <h1 className="mt-4 max-w-3xl text-4xl sm:text-5xl">{project.name}</h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate">{project.summary}</p>
        </div>
      </section>

      <Section tone="surface">
        <img
          src={project.image}
          alt={project.imageAlt}
          width={1200}
          height={800}
          className="w-full rounded-2xl border border-border object-cover shadow-card"
        />

        <div className="mt-12 grid gap-10 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2 className="text-2xl">The engagement</h2>
            <p className="mt-4 text-base leading-relaxed text-slate">{project.description}</p>

            <h2 className="mt-10 text-2xl">What we built</h2>
            <ul className="mt-4 space-y-3">
              {project.features.map((feature) => (
                <li key={feature} className="flex gap-3 text-base text-slate">
                  <Check className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" />
                  {feature}
                </li>
              ))}
            </ul>

            <h2 className="mt-10 text-2xl">Key screens</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-3">
              {project.screenshots.map((shot) => (
                <li
                  key={shot.caption}
                  className="rounded-xl border border-dashed border-border bg-background p-5 text-sm text-slate"
                >
                  {shot.caption}
                </li>
              ))}
            </ul>
          </div>

          <aside className="h-fit rounded-xl border border-border bg-background p-6 shadow-card">
            <h2 className="text-base">Technology</h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {project.technologies.map((tech) => (
                <li
                  key={tech}
                  className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-primary"
                >
                  {tech}
                </li>
              ))}
            </ul>
            <h2 className="mt-8 text-base">More work</h2>
            <ul className="mt-3 space-y-2">
              {others.map((item) => (
                <li key={item.slug}>
                  <Link
                    to="/portfolio/$slug"
                    params={{ slug: item.slug }}
                    className="text-sm font-medium text-primary hover:text-primary-hover"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </Section>

      <CtaBand />
    </>
  );
}
