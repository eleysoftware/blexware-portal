import { readEnv, requireEnv } from "./env";

const DEFAULT_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-2.5-flash";

export function aiProvider(): string {
  return (readEnv("AI_PROVIDER") ?? "lovable").toLowerCase();
}

/** Chat-completions endpoint (OpenAI-compatible). */
export function aiApiUrl(): string {
  return readEnv("AI_API_URL", "AI_GATEWAY_URL") ?? DEFAULT_GATEWAY_URL;
}

export function aiModel(): string {
  return readEnv("AI_MODEL") ?? DEFAULT_MODEL;
}

/** SERVER ONLY. */
export function aiApiKey(): string {
  return requireEnv(["AI_API_KEY", "LOVABLE_API_KEY"], "AI is not configured for this project yet.");
}

export function isAiConfigured(): boolean {
  return Boolean(readEnv("AI_API_KEY", "LOVABLE_API_KEY"));
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
