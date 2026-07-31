import type { ReactNode } from "react";

export function PageHero({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <section className="hero-gradient border-b border-border/70 bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="max-w-3xl">
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
          ) : null}
          <h1 className="mt-3 text-4xl leading-[1.1] sm:text-5xl">{title}</h1>
          {description ? (
            <p className="mt-5 text-lg leading-relaxed text-slate">{description}</p>
          ) : null}
          {children ? <div className="mt-8">{children}</div> : null}
        </div>
      </div>
    </section>
  );
}
