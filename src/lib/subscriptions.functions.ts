import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { guarded } from "@/lib/errors";
import type { SubscriptionSettings } from "@/lib/subscription-dates";
import type { CreateSubscriptionInput } from "@/lib/subscriptions.server";

const TOKEN = /^[a-f0-9]{16,96}$/i;
const UUID = /^[0-9a-f-]{36}$/i;

async function admin(context: { supabase: unknown; userId: string }) {
  const { requireAdmin } = await import("@/lib/blex.server");
  await requireAdmin(context.supabase as never, context.userId);
}

export const getSubscriptionSettingsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(
    guarded("getSubscriptionSettings", "loading subscription settings", async ({ context }) => {
      await admin(context);
      const { getSubscriptionSettings } = await import("@/lib/subscriptions.server");
      const { getActiveProviderName } = await import("@/lib/payments/service.server");
      return { settings: await getSubscriptionSettings(), provider: await getActiveProviderName() };
    }),
  );

export const saveSubscriptionSettingsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: SubscriptionSettings) => data)
  .handler(
    guarded("saveSubscriptionSettings", "saving subscription settings", async ({ data, context }) => {
      await admin(context);
      const { saveSubscriptionSettings } = await import("@/lib/subscriptions.server");
      return saveSubscriptionSettings(data, context.userId);
    }),
  );

export const listSubscriptionsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(
    guarded("listSubscriptions", "loading subscriptions", async ({ context }) => {
      await admin(context);
      const { listSubscriptions } = await import("@/lib/subscriptions.server");
      return listSubscriptions();
    }),
  );

export const createSubscriptionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: CreateSubscriptionInput) => {
    if (!data.contactName?.trim()) throw new Error("Enter the client contact name");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.contactEmail ?? "")) throw new Error("Enter a valid client email address");
    if (data.quoteId && !UUID.test(data.quoteId)) throw new Error("Invalid project");
    return data;
  })
  .handler(
    guarded("createSubscription", "creating the subscription", async ({ data, context }) => {
      await admin(context);
      const { createHostingSubscription } = await import("@/lib/subscriptions.server");
      return createHostingSubscription(data, context.userId);
    }),
  );

export const adminSubscriptionActionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string; action: "stop_auto_renew" | "cancel" }) => {
    if (!UUID.test(data.id)) throw new Error("Invalid subscription");
    if (data.action !== "stop_auto_renew" && data.action !== "cancel") throw new Error("Invalid action");
    return data;
  })
  .handler(
    guarded("adminSubscriptionAction", "updating the subscription", async ({ data, context }) => {
      await admin(context);
      const mod = await import("@/lib/subscriptions.server");
      if (data.action === "cancel") await mod.cancelSubscription(data.id, context.userId);
      else await mod.cancelAutoRenew(data.id, { id: context.userId, label: "admin" });
      return { ok: true };
    }),
  );

// ---- Public (pay-link token) ------------------------------------------------

export const getSubscriptionOfferFn = createServerFn({ method: "POST" })
  .validator((data: { token: string }) => {
    if (!TOKEN.test(data.token)) throw new Error("Invalid link");
    return data;
  })
  .handler(
    guarded("getSubscriptionOffer", "loading the subscription", async ({ data }) => {
      const { getSubscriptionOffer } = await import("@/lib/subscriptions.server");
      return { offer: await getSubscriptionOffer(data.token) };
    }),
  );

export const beginAutoRenewFn = createServerFn({ method: "POST" })
  .validator((data: { token: string }) => {
    if (!TOKEN.test(data.token)) throw new Error("Invalid link");
    return data;
  })
  .handler(
    guarded("beginAutoRenew", "starting automatic renewal", async ({ data }) => {
      const { siteUrl } = await import("@/lib/engagement-email.server");
      const { beginAutoRenew } = await import("@/lib/subscriptions.server");
      const result = await beginAutoRenew(data.token, siteUrl());
      return { approveUrl: result.approveUrl };
    }),
  );

export const confirmAutoRenewFn = createServerFn({ method: "POST" })
  .validator((data: { token: string; subscriptionId: string }) => {
    if (!TOKEN.test(data.token)) throw new Error("Invalid link");
    if (!/^I-[A-Z0-9]{6,40}$/.test(data.subscriptionId)) throw new Error("Invalid PayPal subscription");
    return data;
  })
  .handler(
    guarded("confirmAutoRenew", "confirming automatic renewal", async ({ data }) => {
      const { confirmAutoRenew } = await import("@/lib/subscriptions.server");
      return confirmAutoRenew(data.token, data.subscriptionId);
    }),
  );

export const stopAutoRenewFn = createServerFn({ method: "POST" })
  .validator((data: { token: string }) => {
    if (!TOKEN.test(data.token)) throw new Error("Invalid link");
    return data;
  })
  .handler(
    guarded("stopAutoRenew", "turning off automatic renewal", async ({ data }) => {
      const { cancelAutoRenewByToken } = await import("@/lib/subscriptions.server");
      await cancelAutoRenewByToken(data.token);
      return { ok: true };
    }),
  );
