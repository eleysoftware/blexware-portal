import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { PageHero } from "@/components/PageHero";
import { Section } from "@/components/Section";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { industries } from "@/content/industries";
import { featuredServices } from "@/content/services";
import { budgetRanges, projectTypes } from "@/content/site";

const title = "Get a Free Quote — BLEXware";
const description =
  "Answer eight short steps and get a realistic scope, timeline, and budget for your website, web app, mobile app, or AI automation project.";

const timelines = ["ASAP", "1-3 months", "3-6 months", "6+ months", "Just exploring"];

const schema = z.object({
  projectType: z.string().min(1, "Choose a project type"),
  industry: z.string().min(1, "Choose your industry"),
  services: z.array(z.string()).min(1, "Select at least one service"),
  goals: z.string().trim().min(20, "Give us at least a sentence or two").max(2000),
  features: z.string().trim().max(2000).optional(),
  budget: z.string().min(1, "Choose a budget range"),
  timeline: z.string().min(1, "Choose a timeline"),
  name: z.string().trim().min(2, "Enter your name").max(80),
  email: z.string().trim().email("Enter a valid email address").max(160),
  company: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  consent: z.literal(true, { message: "Please accept the privacy notice" }),
});

type QuoteForm = {
  projectType: string;
  industry: string;
  services: string[];
  goals: string;
  features: string;
  budget: string;
  timeline: string;
  name: string;
  email: string;
  company: string;
  phone: string;
  consent: boolean;
};

const initial: QuoteForm = {
  projectType: "",
  industry: "",
  services: [],
  goals: "",
  features: "",
  budget: "",
  timeline: "",
  name: "",
  email: "",
  company: "",
  phone: "",
  consent: false,
};

const stepFields: (keyof QuoteForm)[][] = [
  ["projectType"],
  ["industry"],
  ["services"],
  ["goals"],
  ["features"],
  ["budget"],
  ["timeline"],
  ["name", "email", "company", "phone", "consent"],
];

const stepTitles = [
  "What are you building?",
  "What industry are you in?",
  "Which services do you need?",
  "What are you trying to achieve?",
  "Any specific features in mind?",
  "What budget range fits?",
  "When do you need it?",
  "Where should we send it?",
];

export const Route = createFileRoute("/free-quote")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: FreeQuotePage,
});

function FreeQuotePage() {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<QuoteForm>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const total = stepTitles.length;
  const progress = useMemo(() => Math.round(((step + 1) / total) * 100), [step, total]);

  const set = <K extends keyof QuoteForm>(key: K, value: QuoteForm[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const validateStep = () => {
    const result = schema.safeParse(values);
    if (result.success) return true;
    const fields = stepFields[step];
    const next: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = String(issue.path[0]) as keyof QuoteForm;
      if (fields.includes(key)) next[key] = issue.message;
    }
    if (Object.keys(next).length === 0) return true;
    setErrors(next);
    return false;
  };

  const next = () => {
    if (!validateStep()) return;
    setStep((s) => Math.min(s + 1, total - 1));
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const result = schema.safeParse(values);
    if (!result.success) {
      const next: Record<string, string> = {};
      for (const issue of result.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      toast.error("Some answers still need attention.");
      return;
    }
    setSubmitted(true);
    toast.success("Quote request received.");
  };

  if (submitted) {
    return (
      <Section tone="surface" className="min-h-[60vh]">
        <div className="mx-auto max-w-xl rounded-2xl border border-border bg-background p-10 text-center shadow-card">
          <span className="mx-auto inline-flex size-14 items-center justify-center rounded-full bg-accent text-primary">
            <Check className="size-7" aria-hidden="true" />
          </span>
          <h1 className="mt-6 text-2xl">Request received</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate">
            Thanks, {values.name.split(" ")[0]}. We review every request by hand and will send a
            scoped proposal to {values.email} within one business day.
          </p>
        </div>
      </Section>
    );
  }

  return (
    <>
      <PageHero
        eyebrow="Free quote"
        title="Eight short steps to a real proposal"
        description="No sales call required. Answer what you know, skip what you don't, and we'll come back with scope, timeline, and price."
      />

      <Section tone="surface">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center justify-between text-sm text-slate">
            <span>
              Step {step + 1} of {total}
            </span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="mt-3" />

          <form
            onSubmit={submit}
            noValidate
            className="mt-8 rounded-2xl border border-border bg-background p-7 shadow-card sm:p-9"
          >
            <h2 className="text-xl">{stepTitles[step]}</h2>

            <div className="mt-6 space-y-5">
              {step === 0 ? (
                <Choices
                  name="projectType"
                  options={[...projectTypes]}
                  value={values.projectType}
                  onChange={(v) => set("projectType", v)}
                  error={errors.projectType}
                />
              ) : null}

              {step === 1 ? (
                <div className="space-y-2">
                  <Label htmlFor="industry">Industry</Label>
                  <select
                    id="industry"
                    value={values.industry}
                    onChange={(e) => set("industry", e.target.value)}
                    className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-headline focus-visible:outline-none"
                  >
                    <option value="">Select an industry…</option>
                    {industries.map((industry) => (
                      <option key={industry.slug} value={industry.name}>
                        {industry.name}
                      </option>
                    ))}
                    <option value="Other">Other</option>
                  </select>
                  <FieldError message={errors.industry} />
                </div>
              ) : null}

              {step === 2 ? (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {featuredServices.map((service) => {
                      const checked = values.services.includes(service);
                      return (
                        <label
                          key={service}
                          className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 text-sm text-headline transition-colors hover:border-mint"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(state) =>
                              set(
                                "services",
                                state
                                  ? [...values.services, service]
                                  : values.services.filter((item) => item !== service),
                              )
                            }
                          />
                          {service}
                        </label>
                      );
                    })}
                  </div>
                  <FieldError message={errors.services} />
                </div>
              ) : null}

              {step === 3 ? (
                <div className="space-y-2">
                  <Label htmlFor="goals">Project goals</Label>
                  <Textarea
                    id="goals"
                    rows={6}
                    value={values.goals}
                    onChange={(e) => set("goals", e.target.value)}
                    placeholder="What should this software make easier, faster, or possible?"
                  />
                  <FieldError message={errors.goals} />
                </div>
              ) : null}

              {step === 4 ? (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="features">Desired features (optional)</Label>
                    <Textarea
                      id="features"
                      rows={6}
                      value={values.features}
                      onChange={(e) => set("features", e.target.value)}
                      placeholder="Logins, dashboards, payments, integrations, AI assistance…"
                    />
                    <FieldError message={errors.features} />
                  </div>
                  <div className="border-t border-border pt-6">
                    <QuoteAttachments files={files} onChange={setFiles} />
                  </div>
                </div>
              ) : null}


              {step === 5 ? (
                <Choices
                  name="budget"
                  options={[...budgetRanges]}
                  value={values.budget}
                  onChange={(v) => set("budget", v)}
                  error={errors.budget}
                />
              ) : null}

              {step === 6 ? (
                <Choices
                  name="timeline"
                  options={timelines}
                  value={values.timeline}
                  onChange={(v) => set("timeline", v)}
                  error={errors.timeline}
                />
              ) : null}

              {step === 7 ? (
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full name</Label>
                    <Input
                      id="name"
                      autoComplete="name"
                      value={values.name}
                      onChange={(e) => set("name", e.target.value)}
                    />
                    <FieldError message={errors.name} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={values.email}
                      onChange={(e) => set("email", e.target.value)}
                    />
                    <FieldError message={errors.email} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company">Company (optional)</Label>
                    <Input
                      id="company"
                      autoComplete="organization"
                      value={values.company}
                      onChange={(e) => set("company", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone (optional)</Label>
                    <Input
                      id="phone"
                      type="tel"
                      autoComplete="tel"
                      value={values.phone}
                      onChange={(e) => set("phone", e.target.value)}
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-2">
                    <label className="flex cursor-pointer items-start gap-3 text-sm text-slate">
                      <Checkbox
                        checked={values.consent}
                        onCheckedChange={(state) => set("consent", state === true)}
                        className="mt-0.5"
                      />
                      I agree that BLEXware may use these details to prepare and send my quote.
                    </label>
                    <FieldError message={errors.consent} />
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-8 flex items-center justify-between gap-3 border-t border-border pt-6">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                Back
              </Button>

              {step < total - 1 ? (
                <Button type="button" onClick={next}>
                  Continue
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Button>
              ) : (
                <Button type="submit" className="shadow-cta">
                  Submit request
                </Button>
              )}
            </div>
          </form>
        </div>
      </Section>
    </>
  );
}

function Choices({
  name,
  options,
  value,
  onChange,
  error,
}: {
  name: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <div className="space-y-3">
      <RadioGroup value={value} onValueChange={onChange} className="grid gap-3 sm:grid-cols-2">
        {options.map((option) => (
          <Label
            key={option}
            htmlFor={`${name}-${option}`}
            className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-4 text-sm font-medium text-headline transition-colors hover:border-mint has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent"
          >
            <RadioGroupItem id={`${name}-${option}`} value={option} />
            {option}
          </Label>
        ))}
      </RadioGroup>
      <FieldError message={error} />
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-xs font-medium text-destructive">
      {message}
    </p>
  );
}
