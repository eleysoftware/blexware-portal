import { createServerFn } from "@tanstack/react-start";
import { guarded } from "@/lib/errors";
import { getRequest } from "@tanstack/react-start/server";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { signUpSchema } from "@/lib/password";

type SignUpPayload = { email: string; password: string; role?: "user" | "staff" | "admin" };

/**
 * Breach-checked account creation. The password is validated, screened against
 * Have I Been Pwned, and only then handed to the service-role admin client.
 * Self-service sign-ups always land on the `user` role; elevated roles require
 * an authenticated admin caller (see createTeamMember).
 */
export const signUpUser = createServerFn({ method: "POST" })
  .validator((data: SignUpPayload) => {
    const parsed = signUpSchema.parse({ email: data.email, password: data.password });
    return { ...parsed, role: "user" as const };
  })
  .handler(
    guarded("signUpUser", "creating your account", async ({ data }) => {
      const { isPasswordBreached, rateLimit, hashedEmailLabel } = await import("@/lib/auth.server");
      const { adminDb, writeAudit } = await import("@/lib/blex.server");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const request = getRequest();
      const ip =
        request?.headers.get("cf-connecting-ip") ??
        request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        "unknown";
      rateLimit(`signup:${ip}`);
      rateLimit(`signup:${data.email.toLowerCase()}`);

      const { breached } = await isPasswordBreached(data.password);
      const label = await hashedEmailLabel(data.email);

      if (breached) {
        await writeAudit({
          actorLabel: `visitor:${label}`,
          action: "signup.rejected_breached_password",
          entity: "auth",
        });
        throw new Error(
          "This password has been found in a known data breach. Please choose a safer password.",
        );
      }

      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: false,
      });

      if (error) {
        // Never confirm or deny that an address is already registered.
        await writeAudit({
          actorLabel: `visitor:${label}`,
          action: "signup.failed",
          entity: "auth",
          metadata: { reason: error.message },
        });
        return { ok: true as const, needsConfirmation: true as const };
      }

      if (created.user) {
        await adminDb()
          .from("user_roles")
          .insert({ user_id: created.user.id, role: data.role });
        await writeAudit({
          actorId: created.user.id,
          actorLabel: `visitor:${label}`,
          action: "signup.created",
          entity: "auth",
          entityId: created.user.id,
          metadata: { role: data.role },
        });
      }

      return { ok: true as const, needsConfirmation: true as const };
    }),
  );

/** Admin-only creation of BLEXware team accounts. Same breach screening. */
export const createTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: SignUpPayload) => {
    const parsed = signUpSchema.parse({ email: data.email, password: data.password });
    const role = data.role === "admin" ? "admin" : "staff";
    return { ...parsed, role } as const;
  })
  .handler(
    guarded("createTeamMember", "creating the team member", async ({ data, context }) => {
      const { requireAdmin, adminDb, writeAudit } = await import("@/lib/blex.server");
      await requireAdmin(context.supabase, context.userId);

      const { isPasswordBreached } = await import("@/lib/auth.server");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const { breached } = await isPasswordBreached(data.password);
      if (breached) {
        throw new Error(
          "This password has been found in a known data breach. Please choose a safer password.",
        );
      }

      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
      });
      if (error) throw new Error(error.message);
      if (!created.user) throw new Error("Account could not be created");

      await adminDb().from("user_roles").insert({ user_id: created.user.id, role: data.role });
      await writeAudit({
        actorId: context.userId,
        action: "team.member_created",
        entity: "auth",
        entityId: created.user.id,
        metadata: { role: data.role },
      });

      return { ok: true as const, role: data.role };
    }),
  );

/** Which surface the signed-in account belongs to. */
export const getViewerRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: Record<string, never>) => data ?? {})
  .handler(
    guarded("getViewerRole", "checking your access", async ({ context }) => {
      const { adminDb } = await import("@/lib/blex.server");
      const { data: rows } = await adminDb()
        .from("user_roles")
        .select("role")
        .eq("user_id", context.userId);

      const roles = ((rows ?? []) as { role: string }[]).map((r) => r.role);
      return {
        email: String(context.claims["email"] ?? ""),
        roles,
        isAdmin: roles.includes("admin"),
        isStaff: roles.includes("admin") || roles.includes("staff"),
        isClient: roles.includes("user"),
      };
    }),
  );
