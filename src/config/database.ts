import { readEnv, requireEnv } from "./env";

// Public project identifiers (safe to ship to the browser). Used when no
// environment injection is available, e.g. in published static bundles.
const FALLBACK_SUPABASE_URL = "https://ptvwcblnkumrhiohavvv.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0dndjYmxua3Vtcmhpb2hhdnZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0NjAzNjIsImV4cCI6MjEwMTAzNjM2Mn0.fMK3O07EJ-XKknnuVH_Guam2EUx23SU_VKuLqcxviNg";

/** Supabase project URL. Browser-safe. */
export function supabaseUrl(): string {
  return readEnv("VITE_SUPABASE_URL", "SUPABASE_URL") ?? FALLBACK_SUPABASE_URL;
}

/** Publishable / anon key. Browser-safe. */
export function supabaseAnonKey(): string {
  return (
    readEnv(
      "VITE_SUPABASE_PUBLISHABLE_KEY",
      "VITE_SUPABASE_ANON_KEY",
      "SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_ANON_KEY",
    ) ?? FALLBACK_SUPABASE_ANON_KEY
  );
}

export function supabaseProjectId(): string | undefined {
  return readEnv("VITE_SUPABASE_PROJECT_ID", "SUPABASE_PROJECT_ID");
}

/**
 * Service-role key. SERVER ONLY — never import this from browser code.
 * Read inside a handler, never at module scope.
 */
export function supabaseServiceRoleKey(): string {
  return requireEnv(
    ["SUPABASE_SERVICE_ROLE_KEY"],
    "Set it in your host's secret manager (never in Git).",
  );
}

export const database = {
  get supabaseUrl(): string {
    return supabaseUrl();
  },
  get supabaseAnonKey(): string {
    return supabaseAnonKey();
  },
  get supabaseProjectId(): string | undefined {
    return supabaseProjectId();
  },
};
