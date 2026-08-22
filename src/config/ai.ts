import { readEnv, requireEnv } from "./env";

const LOVABLE_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";
const DEFAULT_LOVABLE_MODEL = "google/gemini-2.5-flash";

export type AiProviderId = "gemini" | "groq" | "legacy";

export type AiTarget = {
  id: AiProviderId;
  label: string;
  url: string;
  key: string;
  model: string;
};

export function aiProvider(): string {
  return (readEnv("AI_PROVIDER") ?? "gemini").toLowerCase();
}

/** Chat-completions endpoint for the legacy single-provider path. */
export function aiApiUrl(): string {
  return readEnv("AI_API_URL", "AI_GATEWAY_URL") ?? LOVABLE_GATEWAY_URL;
}

export function aiModel(): string {
  return readEnv("AI_MODEL") ?? DEFAULT_LOVABLE_MODEL;
}

/** SERVER ONLY. Legacy single key (Lovable / explicit AI_API_KEY). */
export function aiApiKey(): string {
  return requireEnv(
    ["GEMINI_API_KEY", "GROQ_API_KEY", "AI_API_KEY", "LOVABLE_API_KEY"],
    "Set GEMINI_API_KEY (and optionally GROQ_API_KEY) in .env.local — see .env.example and the README.",
  );
}

export function isAiConfigured(): boolean {
  return Boolean(readEnv("GEMINI_API_KEY", "GROQ_API_KEY", "AI_API_KEY", "LOVABLE_API_KEY"));
}

/** Gemini first, Groq as backup; Lovable/legacy only when those keys are absent. */
export function aiTargets(preference?: AiModelPreference): AiTarget[] {
  const targets: AiTarget[] = [];
  const geminiKey = readEnv("GEMINI_API_KEY");
  const groqKey = readEnv("GROQ_API_KEY");

  if (geminiKey) {
    targets.push({
      id: "gemini",
      label: "Gemini",
      url: readEnv("GEMINI_API_URL") ?? GEMINI_URL,
      key: geminiKey,
      model: readEnv("GEMINI_MODEL") ?? DEFAULT_GEMINI_MODEL,
    });
  }
  if (groqKey) {
    targets.push({
      id: "groq",
      label: "Groq",
      url: readEnv("GROQ_API_URL") ?? GROQ_URL,
      key: groqKey,
      model: readEnv("GROQ_MODEL") ?? DEFAULT_GROQ_MODEL,
    });
  }
  if (targets.length) return preferTargets(targets, preference);

  const legacyKey = readEnv("AI_API_KEY", "LOVABLE_API_KEY");
  if (legacyKey) {
    targets.push({
      id: "legacy",
      label: aiProvider(),
      url: aiApiUrl(),
      key: legacyKey,
      model: aiModel(),
    });
  }
  return preferTargets(targets, preference);
}

export const ai = {
  get provider(): string {
    return aiProvider();
  },
  get apiUrl(): string {
    return aiApiUrl();
  },
  get model(): string {
    return aiModel();
  },
  get isConfigured(): boolean {
    return isAiConfigured();
  },
};

/* -------------------------------------------------------------------------- */
/* Model catalogs                                                              */
/* -------------------------------------------------------------------------- */

/** Curated fallback versions per platform, newest first. */
export const AI_MODEL_CATALOG: Record<AiProviderId, string[]> = {
  gemini: [
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-2.5-pro",
    DEFAULT_GEMINI_MODEL,
    "gemini-2.5-flash-lite",
  ],
  groq: [
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    DEFAULT_GROQ_MODEL,
    "llama-3.1-8b-instant",
    "deepseek-r1-distill-llama-70b",
    "meta-llama/llama-4-maverick-17b-128e-instruct",
  ],
  legacy: [
    "google/gemini-3.7-flash",
    "google/gemini-3.1-pro-preview",
    "google/gemini-3.1-flash-lite",
    DEFAULT_LOVABLE_MODEL,
    "openai/gpt-5.4",
    "openai/gpt-5.4-mini",
    "openai/gpt-5.4-nano",
  ],
};

const EXCLUDE_MODEL = /embedding|embed|aqa|imagen|veo|whisper|tts|guard|prompt-guard|distil-whisper|vision-preview|image/i;

function modelsEndpoint(target: AiTarget): string | null {
  if (target.id === "gemini") {
    // OpenAI-compat base for Gemini: .../v1beta/openai/chat/completions -> .../models
    return target.url.replace(/\/chat\/completions$/, "/models");
  }
  if (target.id === "groq") return target.url.replace(/\/chat\/completions$/, "/models");
  return null;
}

const listCache = new Map<string, { at: number; models: string[] }>();
const LIST_TTL_MS = 60 * 60 * 1000;

/**
 * SERVER ONLY. Live model versions for a configured platform, falling back to
 * the curated catalog when the provider has no listing endpoint or the call fails.
 */
export async function listAiModels(target: AiTarget): Promise<string[]> {
  const fallback = AI_MODEL_CATALOG[target.id] ?? [];
  const endpoint = modelsEndpoint(target);
  if (!endpoint) return dedupe([target.model, ...fallback]);

  const cached = listCache.get(target.id);
  if (cached && Date.now() - cached.at < LIST_TTL_MS) return cached.models;

  try {
    const response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${target.key}` },
    });
    if (!response.ok) throw new Error(String(response.status));
    const payload = (await response.json()) as {
      data?: { id?: string }[];
      models?: { name?: string; supportedGenerationMethods?: string[] }[];
    };

    const ids = (payload.data ?? [])
      .map((entry) => entry.id)
      .concat(
        (payload.models ?? [])
          .filter((entry) => !entry.supportedGenerationMethods || entry.supportedGenerationMethods.includes("generateContent"))
          .map((entry) => entry.name?.replace(/^models\//, "")),
      )
      .filter((id): id is string => Boolean(id))
      .filter((id) => !EXCLUDE_MODEL.test(id))
      .filter((id) => (target.id === "gemini" ? id.startsWith("gemini-") : true))
      .sort((a, b) => b.localeCompare(a, "en", { numeric: true }));

    if (!ids.length) throw new Error("empty listing");
    const models = dedupe([target.model, ...ids]);
    listCache.set(target.id, { at: Date.now(), models });
    return models;
  } catch (error) {
    console.warn(`[listAiModels:${target.id}] falling back to catalog`, (error as Error).message);
    return dedupe([target.model, ...fallback]);
  }
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

export type AiModelPreference = { provider?: string | null; model?: string | null };

/** Reorders configured targets so the admin's chosen platform/version runs first. */
export function preferTargets(targets: AiTarget[], preference?: AiModelPreference): AiTarget[] {
  if (!preference?.provider && !preference?.model) return targets;
  const chosen = targets.find((target) => target.id === preference.provider);
  if (!chosen) return targets;
  const rest = targets.filter((target) => target !== chosen);
  const model = preference.model?.trim();
  return [model ? { ...chosen, model } : chosen, ...rest];
}
