import { expect, test } from "@playwright/test";

import { mapAiHttpError, shouldFailover } from "../../src/lib/ai.server";

test("maps 401 to an invalid-key message", () => {
  expect(mapAiHttpError(401, "", "gemini").message).toMatch(/GEMINI_API_KEY/);
  expect(mapAiHttpError(401, "", "groq").message).toMatch(/GROQ_API_KEY/);
});

test("maps 403 to a blocked-access message", () => {
  expect(mapAiHttpError(403, "").message).toMatch(/blocked/);
});

test("maps 402 to a quota message", () => {
  expect(mapAiHttpError(402, "").message).toMatch(/quota/i);
});

test("maps 429 quota JSON to capacity, not a simple rate-limit retry", () => {
  const body = JSON.stringify({
    error: {
      message: "You exceeded your current quota, please check your plan and billing details.",
      type: "insufficient_quota",
    },
  });
  expect(mapAiHttpError(429, body).message).toMatch(/quota|capacity/i);
  expect(mapAiHttpError(429, body).message).not.toBe("AI rate limit reached. Try again shortly.");
});

test("maps Gemini RESOURCE_EXHAUSTED 429 to capacity", () => {
  const body = JSON.stringify({ error: { message: "Resource has been exhausted (e.g. check quota)." } });
  expect(mapAiHttpError(429, body).message).toMatch(/quota|capacity/i);
});

test("maps a true 429 rate limit to the retry message", () => {
  const body = JSON.stringify({
    error: { message: "Rate limit reached for gpt-4o-mini. Limit 3 RPM." },
  });
  expect(mapAiHttpError(429, body).message).toBe("AI rate limit reached. Try again shortly.");
});

test("includes a provider snippet on other failures", () => {
  const body = JSON.stringify({ error: { message: "model does not exist" } });
  expect(mapAiHttpError(404, body).message).toMatch(/404/);
  expect(mapAiHttpError(404, body).message).toMatch(/model does not exist/);
});

test("fail over to Groq on limits and outages, not on a 400 prompt error", () => {
  expect(shouldFailover(400)).toBe(false);
  expect(shouldFailover(401)).toBe(true);
  expect(shouldFailover(429)).toBe(true);
  expect(shouldFailover(500)).toBe(true);
  expect(shouldFailover(503)).toBe(true);
});
