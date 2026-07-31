import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type Tone = "default" | "surface" | "mint" | "dark";

const tones: Record<Tone, string> = {
  default: "bg-background",
  surface: "bg-surface",
  mint: "surface-mint",
  dark: "bg-headline",
};

export function Section({
  children,
  tone = "default",
  className,
  id,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("scroll-mt-20 py-16 sm:py-20 lg:py-24", tones[tone], className)}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">{children}</div>
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  invert = false,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "center" | "left";
  invert?: boolean;
}) {
  return (
    <div className={cn("max-w-3xl", align === "center" && "mx-auto text-center")}>
      {eyebrow ? (
        <p
          className={cn(
            "text-xs font-semibold uppercase tracking-[0.18em]",
            invert ? "text-mint" : "text-primary",
          )}
        >
          {eyebrow}
        </p>
      ) : null}
      <h2
        className={cn(
          "mt-3 text-3xl sm:text-4xl",
          invert && "text-primary-foreground",
        )}
      >
        {title}
      </h2>
      {description ? (
        <p className={cn("mt-4 text-base leading-relaxed", invert ? "text-mint/90" : "text-slate")}>
          {description}
        </p>
      ) : null}
    </div>
  );
}
