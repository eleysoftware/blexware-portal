// Loads provider keys/settings from public.provider_credentials into the env
// overlay so every config accessor (readEnv) prefers database values.
// Falls back silently to environment variables if the table is missing.

import { setRuntimeOverrides } from "@/config/env";
import { CREDENTIAL_NAMES } from "@/config/credential-catalog";
import { adminDb } from "@/lib/blex.server";

const TTL_MS = 60_000;
let loadedAt = 0;
let inflight: Promise<void> | null = null;
let current: Record<string, string> = {};

export async function loadCredentialOverrides(force = false): Promise<void> {
  if (!force && Date.now() - loadedAt < TTL_MS) return;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const { data, error } = await adminDb().from("provider_credentials").select("name, value");
      if (error) {
        if (!/does not exist|schema cache/i.test(error.message)) {
          console.error("[credentials] read failed:", error.message);
        }
      } else {
        const next: Record<string, string> = {};
        for (const row of (data ?? []) as { name: string; value: string }[]) {
          if (CREDENTIAL_NAMES.has(row.name) && row.value) next[row.name] = row.value;
        }
        current = next;
        setRuntimeOverrides(next);
      }
    } catch (error) {
      console.error("[credentials] unavailable:", error);
    } finally {
      loadedAt = Date.now();
      inflight = null;
    }
  })();
  return inflight;
}

export function storedCredentialNames(): Set<string> {
  return new Set(Object.keys(current));
}
