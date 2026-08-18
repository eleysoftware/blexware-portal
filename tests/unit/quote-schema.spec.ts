import { expect, test } from "@playwright/test";

import { quoteSchema } from "../../src/lib/quote-schema";

const valid = {
  projectType: "Web Application",
  industry: "Technology",
  services: ["Web Applications"],
  goals: "Build a portal that tracks quotes through invoice payment.",
  budget: "$5,000 - $10,000",
  timeline: "1-3 months",
  name: "Ada Lovelace",
  email: "ada@example.com",
  consent: true as const,
};

test("accepts a complete quote payload", () => {
  const result = quoteSchema.safeParse(valid);
  expect(result.success).toBe(true);
});

test("requires consent", () => {
  const result = quoteSchema.safeParse({ ...valid, consent: false });
  expect(result.success).toBe(false);
});

test("rejects a short goals field", () => {
  const result = quoteSchema.safeParse({ ...valid, goals: "Too short" });
  expect(result.success).toBe(false);
});

test("rejects an invalid email", () => {
  const result = quoteSchema.safeParse({ ...valid, email: "not-an-email" });
  expect(result.success).toBe(false);
});

test("requires at least one service", () => {
  const result = quoteSchema.safeParse({ ...valid, services: [] });
  expect(result.success).toBe(false);
});
