import { aiTargets } from "@/config/ai";
import type { AiModelPreference, AiProviderId, AiTarget } from "@/config/ai";

export type ChatOptions = AiModelPreference & { json?: boolean };

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ChatCompletion = {
  content: string;
  model: string;
  provider: AiProviderId;
};

const QUOTA_RE = /quota|billing|insufficient|credit|payment method|exceeded your current|resource.?exhausted/i;

function providerMessage(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return "";
  try {
    const parsed = JSON.parse(trimmed) as { error?: { message?: string } | string };
    if (typeof parsed.error === "string") return parsed.error;
    if (parsed.error && typeof parsed.error === "object" && parsed.error.message) {
      return parsed.error.message;
    }
  } catch {
    // not JSON — use the raw body
  }
  return trimmed;
}

/** Maps provider HTTP failures to a toast-safe Error. Never includes the API key. */
export function mapAiHttpError(status: number, body: string, provider?: AiProviderId): Error {
  const message = providerMessage(body);
  const snippet = message.replace(/\s+/g, " ").trim().slice(0, 240);
  const looksLikeQuota = status === 402 || (status === 429 && QUOTA_RE.test(message || body));
  const keyHint =
    provider === "groq" ? "GROQ_API_KEY" : provider === "gemini" ? "GEMINI_API_KEY" : "GEMINI_API_KEY";

  if (status === 401) {
    return new Error(`The AI key is invalid for this environment. Check ${keyHint}.`);
  }
  if (status === 403) return new Error("AI access is blocked for this workspace (policy or credit limit).");
  if (looksLikeQuota) {
    return new Error(
      "AI quota or rate capacity is exhausted. Check Gemini AI Studio usage, or wait and retry — Groq is used automatically when configured.",
    );
  }
  if (status === 429) return new Error("AI rate limit reached. Try again shortly.");
  return new Error(
    snippet ? `The AI request failed (${status}): ${snippet}` : `The AI request failed (${status}).`,
  );
}

/** Fail over to Groq on limits, outages, and auth — not on a malformed 400 prompt. */
export function shouldFailover(status: number): boolean {
  if (status === 400) return false;
  return status === 401 || status === 402 || status === 403 || status === 408 || status === 429 || status >= 500;
}

async function completeAgainst(
  target: AiTarget,
  messages: ChatMessage[],
  options?: ChatOptions,
): Promise<{ content: string } | { error: Error; failover: boolean }> {
  try {
    const response = await fetch(target.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${target.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: target.model,
        messages,
        ...(options?.json ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    const raw = await response.text();
    if (!response.ok) {
      console.error(`[completeChat:${target.id}]`, response.status, raw.slice(0, 500));
      return {
        error: mapAiHttpError(response.status, raw, target.id),
        failover: shouldFailover(response.status),
      };
    }

    let payload: { choices?: { message?: { content?: string } }[] };
    try {
      payload = JSON.parse(raw) as { choices?: { message?: { content?: string } }[] };
    } catch {
      return { error: new Error("The AI returned a response that could not be read."), failover: true };
    }

    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) return { error: new Error("The AI returned an empty response."), failover: true };
    return { content };
  } catch (error) {
    const message = error instanceof Error ? error.message : "network error";
    console.error(`[completeChat:${target.id}]`, message);
    return { error: new Error(`Could not reach ${target.label} (${message}).`), failover: true };
  }
}

/** Gemini first when configured; Groq if Gemini hits a limit or error. */
export async function completeChat(
  messages: ChatMessage[],
  options?: ChatOptions,
): Promise<ChatCompletion> {
  const targets = aiTargets(options);
  if (!targets.length) {
    throw new Error(
      "AI is not configured. Set GEMINI_API_KEY (and optionally GROQ_API_KEY) in .env.local.",
    );
  }

  let lastError: Error | undefined;
  for (let index = 0; index < targets.length; index += 1) {
    const target = targets[index]!;
    const result = await completeAgainst(target, messages, options);
    if ("content" in result) {
      if (index > 0) console.warn(`[completeChat] using backup provider ${target.id} (${target.model})`);
      return { content: result.content, model: target.model, provider: target.id };
    }
    lastError = result.error;
    const next = targets[index + 1];
    if (!result.failover || !next) throw result.error;
    console.warn(`[completeChat] ${target.id} failed; trying backup ${next.id}`);
  }

  throw lastError ?? new Error("The AI request failed.");
}
