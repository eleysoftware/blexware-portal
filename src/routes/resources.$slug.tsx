import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { CtaBand } from "@/components/CtaBand";
import { getArticle, formatDate, type Article } from "@/content/articles";

export const Route = createFileRoute("/resources/$slug")({
  loader: ({ params }): { article: Article } => {
    const article = getArticle(params.slug);
    if (!article) throw notFound();
    return { article };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Article not found — BLEXware" }, { name: "robots", content: "noindex" }],
      };
    }
    const t = `${loaderData.article.title} | BLEXware`;
    return {
      meta: [
        { title: t },
        { name: "description", content: loaderData.article.summary },
        { property: "og:title", content: t },
        { property: "og:description", content: loaderData.article.summary },
        { property: "og:type", content: "article" },
      ],
    };
  },
  component: ArticlePage,
});

function ArticlePage() {
  const { article } = Route.useLoaderData();

  return (
    <>
      <article>
        <header className="hero-gradient border-b border-border/70 bg-surface">
          <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8">
            <Link
              to="/resources"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate hover:text-headline"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              All resources
            </Link>
            <h1 className="mt-6 text-3xl leading-tight sm:text-4xl">{article.title}</h1>
            <p className="mt-4 text-lg leading-relaxed text-slate">{article.summary}</p>
            <p className="mt-6 text-sm text-slate">
              {article.author} · {formatDate(article.publishedDate)} · {article.readTime}
            </p>
          </div>
        </header>

        <div className="bg-surface pb-16">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <img
              src={article.image}
              alt={article.imageAlt}
              width={1200}
              height={700}
              className="w-full rounded-2xl border border-border"
            />
            <div className="mt-10 space-y-8">
              {article.body.map((block, index) => (
                <section key={index}>
                  {block.heading ? <h2 className="text-xl">{block.heading}</h2> : null}
                  <div className="mt-3 space-y-4">
                    {block.paragraphs.map((paragraph, i) => (
                      <p key={i} className="text-base leading-relaxed text-slate">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <ul className="mt-10 flex flex-wrap gap-2 border-t border-border pt-6">
              {article.tags.map((tag) => (
                <li
                  key={tag}
                  className="rounded-full border border-border px-3 py-1 text-xs text-slate"
                >
                  {tag}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </article>

      <CtaBand />
    </>
  );
}
