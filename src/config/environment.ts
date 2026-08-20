import { readEnv } from "./env";

export type AppEnvironment = "local" | "test" | "development" | "staging" | "production";

function normalize(value: string | undefined): AppEnvironment | undefined {
  switch ((value ?? "").toLowerCase()) {
    case "local":
      return "local";
    case "test":
      return "test";
    case "dev":
    case "development":
      return "development";
    case "stage":
    case "staging":
      return "staging";
    case "prod":
    case "production":
      return "production";
    default:
      return undefined;
  }
}

/** local | test | development | staging | production */
export function appEnv(): AppEnvironment {
  return (
    normalize(readEnv("APP_ENV", "VITE_APP_ENV")) ??
    normalize(readEnv("MODE", "NODE_ENV")) ??
    "development"
  );
}

export function isProduction(): boolean {
  return appEnv() === "production";
}

export function isTest(): boolean {
  return appEnv() === "test";
}

/** Public origin of this deployment. Falls back to the browser origin. */
export function appUrl(): string {
  const configured = readEnv("VITE_APP_URL", "APP_URL");
  if (configured) return configured.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "https://blexware.com";
}

export const environment = {
  get name(): AppEnvironment {
    return appEnv();
  },
  get isProduction(): boolean {
    return isProduction();
  },
  get isTest(): boolean {
    return isTest();
  },
  get appUrl(): string {
    return appUrl();
  },
};
