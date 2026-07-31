import { Link, createFileRoute } from "@tanstack/react-router";
import { Clock, Mail, MessageSquare, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { PageHero } from "@/components/PageHero";
import { Section } from "@/components/Section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CONTACT_EMAIL } from "@/content/site";
import consultationImage from "@/assets/consultation.jpg";


const title = "Contact BLEXware — Start a Conversation";
const description =
  "Get in touch with BLEXware about a website, web application, mobile app, or AI automation project. We reply to every inquiry within one business day.";

const schema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(80),
  email: z.string().trim().email("Enter a valid email address").max(160),
  company: z.string().trim().max(120).optional(),
  message: z.string().trim().min(20, "Tell us a little more (20+ characters)").max(2000),
});

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const result = schema.safeParse(data);

    if (!result.success) {
      const next: Record<string, string> = {};
      for (const issue of result.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      toast.error("Please fix the highlighted fields.");
      return;
    }

    setErrors({});
    event.currentTarget.reset();
    toast.success("Thanks — we'll reply within one business day.");
  };

  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Tell us what's not working"
        description="Whether you have a spec or a vague frustration, we can help you turn it into a plan."
      />

      <Section tone="surface">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          <form
            onSubmit={onSubmit}
            noValidate
            className="rounded-2xl border border-border bg-background p-7 shadow-card sm:p-9"
          >
            <h2 className="text-xl">Send a message</h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <Field id="name" label="Full name" error={errors.name}>
                <Input id="name" name="name" autoComplete="name" required />
              </Field>
              <Field id="email" label="Email" error={errors.email}>
                <Input id="email" name="email" type="email" autoComplete="email" required />
              </Field>
              <div className="sm:col-span-2">
                <Field id="company" label="Company (optional)" error={errors.company}>
                  <Input id="company" name="company" autoComplete="organization" />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field id="message" label="What are you trying to build?" error={errors.message}>
                  <Textarea id="message" name="message" rows={6} required />
                </Field>
              </div>
            </div>
            <Button type="submit" size="lg" className="mt-6 shadow-cta">
              Send message
            </Button>
            <p className="mt-4 text-xs leading-relaxed text-slate">
              We use your details only to respond to this inquiry. See our{" "}
              <Link to="/privacy" className="text-primary underline underline-offset-2">
                Privacy Policy
              </Link>
              .
            </p>
          </form>

          <aside className="space-y-4">
            {[
              {
                icon: Mail,
                title: "Email us",
                body: CONTACT_EMAIL,
                href: `mailto:${CONTACT_EMAIL}`,
              },
              { icon: Clock, title: "Response time", body: "Within one business day, every time." },
              {
                icon: MessageSquare,
                title: "Prefer a scoped quote?",
                body: "The free quote form captures the details we need up front.",
              },
              {
                icon: ShieldCheck,
                title: "Your data",
                body: "Encrypted in transit, never sold, never used to train models.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-border bg-background p-6 shadow-card"
              >
                <span className="inline-flex size-10 items-center justify-center rounded-xl bg-accent text-primary">
                  <item.icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-base">{item.title}</h3>
                {item.href ? (
                  <a
                    href={item.href}
                    className="mt-1 block text-sm font-medium text-primary hover:text-primary-hover"
                  >
                    {item.body}
                  </a>
                ) : (
                  <p className="mt-1 text-sm leading-relaxed text-slate">{item.body}</p>
                )}
              </div>
            ))}
            <Button asChild variant="outline" className="w-full">
              <Link to="/free-quote">Start a free quote instead</Link>
            </Button>
          </aside>
        </div>
      </Section>
    </>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
