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
export function aiTargets(): AiTarget[] {
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
  if (targets.length) return targets;

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
  return targets;
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
