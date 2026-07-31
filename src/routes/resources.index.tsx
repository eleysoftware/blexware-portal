import { Link, createFileRoute } from "@tanstack/react-router";

import { CtaBand } from "@/components/CtaBand";
import { PageHero } from "@/components/PageHero";
import { Section } from "@/components/Section";
import { articles, formatDate } from "@/content/articles";

const title = "Resources — Engineering & AI Notes | BLEXware";
const description =
  "Practical articles on AI governance, secure file handling, and shipping production MVPs, written by the BLEXware engineering team.";

export const Route = createFileRoute("/resources/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: ResourcesPage,
});

function ResourcesPage() {
  return (
    <>
      <PageHero
        eyebrow="Resources"
        title="What we've learned building this stuff"
        description="No listicles. Just the decisions and trade-offs behind the software we ship."
      />

      <Section tone="surface">
        <div className="grid gap-6 lg:grid-cols-3">
          {articles.map((article) => (
            <article key={article.slug} className="card-lift overflow-hidden rounded-xl border border-border bg-background shadow-card">
              <Link to="/resources/$slug" params={{ slug: article.slug }} className="block">
                <img
                  src={article.image}
                  alt={article.imageAlt}
                  loading="lazy"
                  width={1200}
                  height={700}
                  className="aspect-[12/7] w-full object-cover"
                />
                <div className="p-6">
                  <div className="flex flex-wrap gap-2">
                    {article.categories.map((category) => (
                      <span
                        key={category}
                        className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-primary"
                      >
                        {category}
                      </span>
                    ))}
                  </div>
                  <h2 className="mt-3 text-lg leading-snug">{article.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate">{article.summary}</p>
                  <p className="mt-4 text-xs text-slate">
                    {formatDate(article.publishedDate)} · {article.readTime}
                  </p>
                </div>
              </Link>
            </article>
          ))}
        </div>
      </Section>

      <CtaBand />
    </>
  );
}
