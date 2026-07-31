import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

export function CtaBand({
  title = "Tell us what you're trying to build.",
  description = "Answer a few questions and we'll come back with a realistic scope, timeline, and budget — no obligation.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <section className="bg-headline py-16 sm:py-20">
      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="text-3xl text-primary-foreground sm:text-4xl">{title}</h2>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-mint/85">{description}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" className="shadow-cta">
            <Link to="/free-quote">
              Get a Free Quote
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-mint/40 bg-transparent text-mint hover:bg-mint/10 hover:text-mint"
          >
            <Link to="/contact">Talk to us first</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
