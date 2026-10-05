import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CREDENTIAL_GROUPS, CREDENTIAL_NAMES } from "@/config/credential-catalog";

export type CredentialStatus = { name: string; source: "database" | "environment" | "missing"; preview: string | null };

/** Status of every managed key. Secret values are never returned. */
export const listCredentialStatusFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CredentialStatus[]> => {
    const { requireAdmin } = await import("@/lib/blex.server");
    await requireAdmin(context.supabase, context.userId);
    const { loadCredentialOverrides, storedCredentialNames } = await import("@/lib/credentials.server");
    const { hasEnvValue, readEnv } = await import("@/config/env");
    await loadCredentialOverrides(true);
    const stored = storedCredentialNames();
    return CREDENTIAL_GROUPS.flatMap((group) =>
      group.fields.map((field) => {
        const source = stored.has(field.name) ? "database" : hasEnvValue(field.name) ? "environment" : "missing";
        const value = readEnv(field.name);
        const preview = !value ? null : field.secret ? `••••${value.slice(-4)}` : value;
        return { name: field.name, source, preview } as CredentialStatus;
      }),
    );
  });

export const saveCredentialFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ name: z.string().refine((n) => CREDENTIAL_NAMES.has(n)), value: z.string().max(4000) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { requireAdmin, adminDb, writeAudit } = await import("@/lib/blex.server");
    await requireAdmin(context.supabase, context.userId);
    const value = data.value.trim();
    const db = adminDb();
    const { error } = value
      ? await db
          .from("provider_credentials")
          .upsert(
            { name: data.name, value, updated_at: new Date().toISOString(), updated_by: context.userId },
            { onConflict: "name" },
          )
      : await db.from("provider_credentials").delete().eq("name", data.name);
    if (error) {
      console.error("[credentials] write failed:", error.message);
      throw new Error(
        /does not exist|schema cache/i.test(error.message)
          ? "The credentials table isn't set up yet. Run database update 019 in Supabase first."
          : "Could not save this setting. Please try again.",
      );
    }
    await writeAudit({
      actorId: context.userId,
      actorLabel: "admin",
      action: value ? "settings.credential.saved" : "settings.credential.cleared",
      entity: "settings",
      entityId: data.name,
      metadata: {},
    });
    const { loadCredentialOverrides } = await import("@/lib/credentials.server");
    await loadCredentialOverrides(true);
    return { ok: true };
  });
