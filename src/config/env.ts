/**
 * Environment reader. This is the ONLY place in `src/` that touches
 * `import.meta.env` / `process.env` directly — everything else goes through the
 * typed accessors in the sibling config modules (`config.database.supabaseUrl`,
 * `config.payments.apiKey`, …).
 *
 * Values are resolved lazily so a variable that is only needed on one code path
 * cannot break unrelated pages, and every lookup accepts a fallback chain so the
 * same code runs on Lovable, locally, in CI, on staging and in production.
 */

type EnvRecord = Record<string, string | undefined>;

function viteEnv(): EnvRecord {
  try {
    return (import.meta.env ?? {}) as unknown as EnvRecord;
  } catch {
    return {};
  }
}

function nodeEnv(): EnvRecord {
  try {
    return (typeof process !== "undefined" && process.env ? process.env : {}) as EnvRecord;
  } catch {
    return {};
  }
}

// Server-side overrides loaded from the database (provider_credentials).
// Populated per request by src/lib/credentials.server.ts; empty in the browser.
let runtimeOverrides: EnvRecord = {};

export function setRuntimeOverrides(values: EnvRecord): void {
  runtimeOverrides = { ...values };
}

/** First non-empty value among `names`: database overrides, then Vite env, then process env. */
export function readEnv(...names: string[]): string | undefined {
  const vite = viteEnv();
  const node = nodeEnv();
  for (const name of names) {
    const override = runtimeOverrides[name];
    if (typeof override === "string" && override.trim() !== "") return override.trim();
  }
  for (const name of names) {
    const value = vite[name] ?? node[name];
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return undefined;
}

/** True when a value comes from environment variables (ignores database overrides). */
export function hasEnvValue(name: string): boolean {
  const value = viteEnv()[name] ?? nodeEnv()[name];
  return typeof value === "string" && value.trim() !== "";
}

export function readBool(defaultValue: boolean, ...names: string[]): boolean {
  const value = readEnv(...names);
  if (value === undefined) return defaultValue;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

export class MissingEnvError extends Error {
  readonly missing: string[];
  constructor(missing: string[], hint?: string) {
    super(
      `Missing environment variable(s): ${missing.join(", ")}.` +
        (hint ? ` ${hint}` : " Add them to .env.local (see .env.example) or your host's secret manager."),
    );
    this.name = "MissingEnvError";
    this.missing = missing;
  }
}

/** Reads a required value, throwing a clear error naming the accepted variables. */
export function requireEnv(names: string[], hint?: string): string {
  const value = readEnv(...names);
  if (!value) throw new MissingEnvError([names[0] ?? "UNKNOWN"], hint);
  return value;
}

/** Memoises a lazy accessor so repeated reads do not re-scan the environment. */
export function lazy<T>(factory: () => T): () => T {
  let cached: { value: T } | undefined;
  return () => {
    if (!cached) cached = { value: factory() };
    return cached.value;
  };
}
