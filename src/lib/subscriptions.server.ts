// Yearly service subscriptions (web hosting). Every billing year produces a
// normal invoice linked by subscription_id. Clients may opt into PayPal
// auto-renew; others pay each renewal invoice manually.
import { adminDb, writeAudit } from "@/lib/blex.server";
import { formatMoney } from "@/lib/documents/types";
import { UserFacingError } from "@/lib/errors";
import {
  addYears,
  coerceSubscriptionSettings,
  DEFAULT_SUBSCRIPTION_SETTINGS,
  type SubscriptionSettings,
} from "@/lib/subscription-dates";

export { addYears, coerceSubscriptionSettings, DEFAULT_SUBSCRIPTION_SETTINGS, noticeDateFor, type SubscriptionSettings } from "@/lib/subscription-dates";
import type { PayPalSubscription as PayPalSub } from "@/lib/payments/paypal.provider.server";

const SETTINGS_KEY = "hosting_subscriptions";

export async function getSubscriptionSettings(): Promise<SubscriptionSettings> {
  try {
    const { data } = await adminDb().from("app_settings").select("value").eq("key", SETTINGS_KEY).maybeSingle();
    return coerceSubscriptionSettings(data?.["value"]);
  } catch {
    return DEFAULT_SUBSCRIPTION_SETTINGS;
  }
}

export async function saveSubscriptionSettings(next: SubscriptionSettings, actorId: string) {
  const value = coerceSubscriptionSettings(next);
  const { error } = await adminDb()
    .from("app_settings")
    .upsert({ key: SETTINGS_KEY, value, updated_at: new Date().toISOString(), updated_by: actorId }, { onConflict: "key" });
  if (error) throw new Error("Could not save the subscription settings.");
  await writeAudit({ actorId, action: "settings.subscriptions.updated", entity: "settings", entityId: SETTINGS_KEY, metadata: value });
  return value;
}

async function nextSequence(quoteId: string): Promise<number> {
  const { data } = await adminDb()
    .from("invoices")
    .select("sequence")
    .eq("quote_id", quoteId)
    .order("sequence", { ascending: false })
    .limit(1)
    .maybeSingle();
  return Number(data?.sequence ?? 0) + 1;
}

async function insertPeriodInvoice(input: {
  subscriptionId: string;
  quoteId: string;
  serviceName: string;
  amountCents: number;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  status: "draft" | "sent";
}) {
  const description = `${input.serviceName} — ${input.periodStart} to ${input.periodEnd}`;
  const row = {
    quote_id: input.quoteId,
    agreement_id: null,
    sequence: await nextSequence(input.quoteId),
    amount_cents: input.amountCents,
    description,
    due_date: input.dueDate,
    issue_date: new Date().toISOString().slice(0, 10),
    status: input.status,
    ...(input.status === "sent" ? { sent_at: new Date().toISOString() } : {}),
    line_items: [{ label: `${input.serviceName} (1 year)`, amountCents: input.amountCents }],
    subtotal_cents: input.amountCents,
    discount_cents: 0,
    subscription_id: input.subscriptionId,
    subscription_period_end: input.periodEnd,
  };
  const { data, error } = await adminDb().from("invoices").insert(row as never).select("id, invoice_number").single();
  if (error || !data) throw new Error(error?.message ?? "Could not create the subscription invoice.");
  return { id: data.id as string, invoiceNumber: data.invoice_number as string };
}

export type CreateSubscriptionInput = {
  quoteId?: string;
  contactName: string;
  contactEmail: string;
  company?: string;
  phone?: string;
  smsOptIn?: boolean;
  startDate?: string;
  sendNow: boolean;
};

export async function createHostingSubscription(input: CreateSubscriptionInput, actorId: string) {
  const settings = await getSubscriptionSettings();
  if (!settings.enabled) throw new UserFacingError("Hosting subscriptions are turned off in settings.");
  const db = adminDb();
  const email = input.contactEmail.trim().toLowerCase();

  let quoteId = input.quoteId;
  if (quoteId) {
    const { data: existing } = await db.from("quotes").select("id, contact_email").eq("id", quoteId).maybeSingle();
    if (!existing) throw new UserFacingError("That project could not be found");
    if (String(existing.contact_email ?? "").toLowerCase() !== email)
      throw new UserFacingError("That project belongs to a different client");
  } else {
    const phone = input.phone?.trim() || null;
    const { data: quote, error } = await db
      .from("quotes")
      .insert({
        status: "invoicing",
        project_type: settings.serviceName,
        industry: "Not stated",
        services: [settings.serviceName],
        goals: `${settings.serviceName} — yearly subscription`,
        budget: "Not stated",
        timeline: "Yearly",
        contact_name: input.contactName.trim(),
        contact_email: email,
        company: input.company?.trim() || null,
        phone,
        sms_opt_in: input.smsOptIn === true && !!phone,
        sms_opt_in_at: input.smsOptIn === true && phone ? new Date().toISOString() : null,
        consent: true,
        internal_notes: "Yearly hosting subscription.",
      })
      .select("id")
      .single();
    if (error || !quote) throw new Error(error?.message ?? "Could not create the client record");
    quoteId = quote.id as string;
  }

  const start = input.startDate && /^\d{4}-\d{2}-\d{2}$/.test(input.startDate)
    ? input.startDate
    : new Date().toISOString().slice(0, 10);
  const periodEnd = addYears(start, 1);

  const { data: sub, error: subError } = await db
    .from("subscriptions")
    .insert({
      quote_id: quoteId,
      service_name: settings.serviceName,
      amount_cents: settings.amountCents,
      status: "pending",
      start_date: start,
      renewal_date: periodEnd,
    } as never)
    .select("id")
    .single();
  if (subError || !sub) {
    throw new Error(subError?.message.includes("subscriptions")
      ? "The subscriptions table is missing — run migration 021 in Supabase first."
      : (subError?.message ?? "Could not create the subscription"));
  }

  const dueDate = new Date(`${start}T00:00:00Z`);
  dueDate.setUTCDate(dueDate.getUTCDate() + 7);
  const invoice = await insertPeriodInvoice({
    subscriptionId: sub.id as string,
    quoteId,
    serviceName: settings.serviceName,
    amountCents: settings.amountCents,
    periodStart: start,
    periodEnd,
    dueDate: dueDate.toISOString().slice(0, 10),
    status: "draft",
  });

  let sent = false;
  let deliveryError: string | null = null;
  if (input.sendNow) {
    const { dispatchInvoice } = await import("@/lib/invoicing.server");
    const result = await dispatchInvoice(invoice.id);
    sent = result.emailed;
    deliveryError = result.emailed ? null : (result.reason ?? "unknown error");
  }

  await writeAudit({
    actorId,
    action: "subscription.created",
    entity: "quote",
    entityId: quoteId,
    metadata: { subscription_id: sub.id, amount_cents: settings.amountCents, invoice: invoice.invoiceNumber, sent },
  });
  return { subscriptionId: sub.id as string, quoteId, invoiceNumber: invoice.invoiceNumber, sent, deliveryError };
}

export async function listSubscriptions() {
  const { data, error } = await adminDb()
    .from("subscriptions")
    .select("id, quote_id, service_name, amount_cents, status, auto_renew, provider_subscription_id, start_date, renewal_date, last_notice_for, quotes(contact_name, contact_email, company)")
    .order("renewal_date", { ascending: true })
    .limit(500);
  if (error) return { subscriptions: [], error: "Run migration 021 in Supabase to enable subscriptions." };
  return {
    subscriptions: ((data ?? []) as Record<string, unknown>[]).map((row) => {
      const q = (row["quotes"] ?? {}) as Record<string, unknown>;
      return {
        id: String(row["id"]),
        quoteId: String(row["quote_id"]),
        serviceName: String(row["service_name"]),
        amountCents: Number(row["amount_cents"]),
        status: String(row["status"]),
        autoRenew: row["auto_renew"] === true && !!row["provider_subscription_id"],
        startDate: String(row["start_date"]),
        renewalDate: String(row["renewal_date"]),
        clientName: String(q["contact_name"] ?? ""),
        clientEmail: String(q["contact_email"] ?? ""),
        company: (q["company"] as string | null) ?? null,
      };
    }),
    error: null as string | null,
  };
}

// --------------------------------------------------------------------------
// Auto-renew (PayPal Subscriptions)

async function paypalEnv() {
  const { getActiveEnvironment, getActiveProviderName } = await import("@/lib/payments/service.server");
  const provider = await getActiveProviderName();
  const env = await getActiveEnvironment();
  return { provider, env: (env === "live" ? "live" : "sandbox") as "live" | "sandbox" };
}

async function ensurePlan(env: "live" | "sandbox", serviceName: string, amountCents: number): Promise<string> {
  const db = adminDb();
  const key = `paypal_plan:${env}:${serviceName}:${amountCents}`;
  const { data } = await db.from("app_settings").select("value").eq("key", key).maybeSingle();
  const cached = (data?.["value"] as { planId?: string } | null)?.planId;
  if (cached) return cached;
  const { paypalSubscriptions } = await import("@/lib/payments/paypal.provider.server");
  const productId = await paypalSubscriptions.createProduct(env, `BLEXware ${serviceName}`);
  const planId = await paypalSubscriptions.createYearlyPlan(env, {
    productId,
    name: `${serviceName} — ${formatMoney(amountCents)} / year`,
    amountCents,
    currency: "USD",
  });
  await db.from("app_settings").upsert({ key, value: { planId, productId }, updated_at: new Date().toISOString() }, { onConflict: "key" });
  return planId;
}

async function loadInvoiceSubscription(payToken: string) {
  const db = adminDb();
  const { data: invoice } = await db
    .from("invoices")
    .select("id, quote_id, status, amount_cents, amount_paid_cents, subscription_id")
    .eq("pay_token", payToken)
    .maybeSingle();
  if (!invoice || !invoice.subscription_id) return null;
  const { data: sub } = await db
    .from("subscriptions")
    .select("*")
    .eq("id", invoice.subscription_id)
    .maybeSingle();
  if (!sub) return null;
  return { invoice, sub: sub as Record<string, unknown> };
}

/** Public info for the pay page. Only safe, non-PII fields. */
export async function getSubscriptionOffer(payToken: string) {
  const found = await loadInvoiceSubscription(payToken);
  if (!found) return null;
  const settings = await getSubscriptionSettings();
  const { provider } = await paypalEnv();
  const { sub, invoice } = found;
  const balance = Number(invoice.amount_cents) - Number(invoice.amount_paid_cents ?? 0);
  const autoRenewOn = sub["auto_renew"] === true && !!sub["provider_subscription_id"];
  return {
    serviceName: String(sub["service_name"]),
    amountCents: Number(sub["amount_cents"]),
    renewalDate: String(sub["renewal_date"]),
    status: String(sub["status"]),
    autoRenewOn,
    canEnableAutoRenew:
      settings.autoRenewEnabled && provider === "paypal" && !autoRenewOn && balance > 0 &&
      String(sub["status"]) !== "cancelled" && invoice.status !== "void",
    noticeDays: settings.noticeDays,
  };
}

export async function beginAutoRenew(payToken: string, origin: string) {
  const found = await loadInvoiceSubscription(payToken);
  if (!found) throw new UserFacingError("This invoice is not part of a subscription.");
  const offer = await getSubscriptionOffer(payToken);
  if (!offer?.canEnableAutoRenew) throw new UserFacingError("Automatic renewal isn't available for this invoice.");
  const { sub, invoice } = found;
  const { env } = await paypalEnv();
  const balance = Number(invoice.amount_cents) - Number(invoice.amount_paid_cents ?? 0);
  if (balance !== Number(sub["amount_cents"])) {
    throw new UserFacingError("Auto-renew can only start on a full, unpaid subscription invoice.");
  }
  const planId = await ensurePlan(env, String(sub["service_name"]), Number(sub["amount_cents"]));
  const { data: quote } = await adminDb().from("quotes").select("contact_email").eq("id", invoice.quote_id).maybeSingle();
  const { paypalSubscriptions } = await import("@/lib/payments/paypal.provider.server");
  const base = `${origin}/invoice/${payToken}`;
  const created = await paypalSubscriptions.create(env, {
    planId,
    customId: String(sub["id"]),
    email: (quote?.contact_email as string | undefined) ?? null,
    returnUrl: `${base}?autorenew=return`,
    cancelUrl: `${base}?autorenew=cancel`,
  });
  return { approveUrl: created.approveUrl, providerSubscriptionId: created.id };
}

/** Credits one subscription invoice with a PayPal recurring payment (idempotent). */
async function creditSubscriptionInvoice(invoiceId: string, providerPaymentId: string, amountCents: number, env: string) {
  const db = adminDb();
  const { data: existing } = await db
    .from("invoice_payments")
    .select("id")
    .eq("provider_payment_id", providerPaymentId)
    .maybeSingle();
  if (existing) return false;
  const { error } = await db.from("invoice_payments").insert({
    invoice_id: invoiceId,
    amount_cents: amountCents,
    status: "created",
    payment_method: "paypal_subscription",
    provider: "paypal",
    environment: env,
    provider_payment_id: providerPaymentId,
    hyperswitch_payment_id: providerPaymentId,
    metadata: { source: "paypal_subscription" },
  } as never);
  if (error) {
    console.error("[subscriptions] credit insert failed", error.message);
    return false;
  }
  const { applyPaymentStatus } = await import("@/lib/invoicing.server");
  await applyPaymentStatus({ providerPaymentId, status: "succeeded", amountCents, paymentMethod: "paypal_subscription" });
  return true;
}

/** Client returned from PayPal approval: verify and activate. */
export async function confirmAutoRenew(payToken: string, providerSubscriptionId: string) {
  const found = await loadInvoiceSubscription(payToken);
  if (!found) throw new UserFacingError("This invoice is not part of a subscription.");
  const { env } = await paypalEnv();
  const { paypalSubscriptions } = await import("@/lib/payments/paypal.provider.server");
  const remote = (await paypalSubscriptions.get(env, providerSubscriptionId)) as PayPalSub & { custom_id?: string };
  const { sub, invoice } = found;
  const status = remote.status.toUpperCase();
  if (status !== "ACTIVE" && status !== "APPROVED") {
    return { active: false, status };
  }
  // Ensure this PayPal subscription was created for this BLEXware subscription.
  if (remote.custom_id !== String(sub["id"])) {
    throw new UserFacingError("This PayPal subscription doesn't match the invoice.");
  }

  await adminDb()
    .from("subscriptions")
    .update({
      auto_renew: true,
      provider: "paypal",
      provider_environment: env,
      provider_subscription_id: providerSubscriptionId,
      activation_invoice_id: invoice.id,
      status: "active",
    } as never)
    .eq("id", sub["id"]);

  // PayPal bills the first year at activation; credit the open invoice.
  if (status === "ACTIVE") {
    await creditSubscriptionInvoice(
      invoice.id as string,
      `paypalsub_${providerSubscriptionId}_${invoice.id as string}`,
      Number(invoice.amount_cents) - Number(invoice.amount_paid_cents ?? 0),
      env,
    );
  }
  await writeAudit({
    actorLabel: "client",
    action: "subscription.auto_renew_enabled",
    entity: "quote",
    entityId: invoice.quote_id as string,
    metadata: { subscription_id: sub["id"], provider_subscription_id: providerSubscriptionId },
  });
  return { active: true, status };
}

export async function cancelAutoRenew(subscriptionId: string, actor: { id?: string | null; label: string }) {
  const db = adminDb();
  const { data: sub } = await db.from("subscriptions").select("*").eq("id", subscriptionId).maybeSingle();
  if (!sub) throw new UserFacingError("Subscription not found");
  const providerId = sub["provider_subscription_id"] as string | null;
  if (providerId) {
    const { paypalSubscriptions } = await import("@/lib/payments/paypal.provider.server");
    const env = (sub["provider_environment"] === "live" ? "live" : "sandbox") as "live" | "sandbox";
    try {
      await paypalSubscriptions.cancel(env, providerId, "Automatic renewal turned off");
    } catch (error) {
      console.error("[subscriptions] PayPal cancel failed", error);
    }
  }
  await db.from("subscriptions").update({ auto_renew: false, provider_subscription_id: null } as never).eq("id", subscriptionId);
  await writeAudit({
    actorId: actor.id ?? null,
    actorLabel: actor.label,
    action: "subscription.auto_renew_disabled",
    entity: "quote",
    entityId: sub["quote_id"] as string,
    metadata: { subscription_id: subscriptionId },
  });
}

export async function cancelAutoRenewByToken(payToken: string) {
  const found = await loadInvoiceSubscription(payToken);
  if (!found) throw new UserFacingError("This invoice is not part of a subscription.");
  await cancelAutoRenew(String(found.sub["id"]), { label: "client" });
}

export async function cancelSubscription(subscriptionId: string, actorId: string) {
  await cancelAutoRenew(subscriptionId, { id: actorId, label: "admin" });
  await adminDb()
    .from("subscriptions")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() } as never)
    .eq("id", subscriptionId);
}

/** Called whenever an invoice becomes fully paid. Advances the paid-through date. */
export async function onSubscriptionInvoicePaid(invoiceId: string) {
  const db = adminDb();
  const { data: invoice } = await db
    .from("invoices")
    .select("subscription_id, subscription_period_end")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!invoice?.subscription_id || !invoice.subscription_period_end) return;
  const { data: sub } = await db.from("subscriptions").select("renewal_date, status").eq("id", invoice.subscription_id).maybeSingle();
  if (!sub) return;
  const periodEnd = String(invoice.subscription_period_end);
  const renewal = String(sub.renewal_date) > periodEnd ? String(sub.renewal_date) : periodEnd;
  await db
    .from("subscriptions")
    .update({ renewal_date: renewal, ...(sub.status === "cancelled" ? {} : { status: "active" }) } as never)
    .eq("id", invoice.subscription_id);
}

/** PayPal webhook: recurring payment collected. */
export async function applySubscriptionPayment(input: { subscriptionId: string; saleId: string; amountCents: number }) {
  const db = adminDb();
  const { data: sub } = await db
    .from("subscriptions")
    .select("id, activation_invoice_id, provider_environment")
    .eq("provider_subscription_id", input.subscriptionId)
    .maybeSingle();
  if (!sub) return { applied: false };
  const { data: open } = await db
    .from("invoices")
    .select("id, amount_cents, amount_paid_cents")
    .eq("subscription_id", sub.id)
    .in("status", ["draft", "scheduled", "sent", "viewed", "partially_paid", "overdue"])
    .order("due_date", { ascending: true })
    .limit(5);
  // The activation payment is credited on return; skip the activation invoice.
  const target = (open ?? []).find(
    (row) => row.id !== sub.activation_invoice_id && Number(row.amount_cents) > Number(row.amount_paid_cents ?? 0),
  );
  if (!target) return { applied: false };
  const balance = Number(target.amount_cents) - Number(target.amount_paid_cents ?? 0);
  const applied = await creditSubscriptionInvoice(
    target.id as string,
    `paypalsale_${input.saleId}`,
    Math.min(balance, input.amountCents || balance),
    String(sub.provider_environment ?? "sandbox"),
  );
  return { applied };
}

export async function applySubscriptionStatus(input: { subscriptionId: string; status: string }) {
  if (!["CANCELLED", "EXPIRED", "SUSPENDED"].includes(input.status)) return;
  await adminDb()
    .from("subscriptions")
    .update({ auto_renew: false } as never)
    .eq("provider_subscription_id", input.subscriptionId);
}

/** Cron: issue renewal invoices / advance notices `noticeDays` before renewal. */
export async function runSubscriptionRenewals() {
  const db = adminDb();
  const settings = await getSubscriptionSettings();
  const today = new Date().toISOString().slice(0, 10);
  const horizon = new Date();
  horizon.setUTCDate(horizon.getUTCDate() + settings.noticeDays);
  const { data: due, error } = await db
    .from("subscriptions")
    .select("id, quote_id, service_name, amount_cents, auto_renew, provider_subscription_id, renewal_date, last_notice_for")
    .in("status", ["active", "past_due"])
    .lte("renewal_date", horizon.toISOString().slice(0, 10))
    .limit(200);
  if (error) {
    console.error("[cron:subscriptions]", error.message);
    return { renewalsIssued: 0 };
  }
  const { siteUrl } = await import("@/lib/engagement-email.server");
  const { dispatchInvoice } = await import("@/lib/invoicing.server");
  const { renderEmail, sendEmail } = await import("@/lib/email.server");
  const { sendSms } = await import("@/lib/sms.server");
  let renewalsIssued = 0;

  for (const sub of due ?? []) {
    const renewal = String(sub.renewal_date);
    if (sub.last_notice_for && String(sub.last_notice_for) >= renewal) continue;
    const auto = sub.auto_renew === true && !!sub.provider_subscription_id;
    try {
      const invoice = await insertPeriodInvoice({
        subscriptionId: sub.id as string,
        quoteId: sub.quote_id as string,
        serviceName: String(sub.service_name),
        amountCents: Number(sub.amount_cents),
        periodStart: renewal,
        periodEnd: addYears(renewal, 1),
        dueDate: renewal,
        status: auto ? "sent" : "draft",
      });
      await db.from("subscriptions").update({ last_notice_for: renewal } as never).eq("id", sub.id);
      renewalsIssued += 1;

      if (!auto) {
        await dispatchInvoice(invoice.id);
        continue;
      }
      const { data: quote } = await db
        .from("quotes")
        .select("contact_name, contact_email, phone, sms_opt_in")
        .eq("id", sub.quote_id)
        .maybeSingle();
      const { data: inv } = await db.from("invoices").select("pay_token").eq("id", invoice.id).maybeSingle();
      if (!quote?.contact_email) continue;
      const url = `${siteUrl()}/invoice/${inv?.pay_token as string}`;
      const when = new Date(`${renewal}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
      const amount = formatMoney(Number(sub.amount_cents));
      const mail = renderEmail({
        heading: `Your ${String(sub.service_name)} renews on ${when}`,
        paragraphs: [
          `Hi ${quote.contact_name as string},`,
          `Your ${String(sub.service_name)} subscription (${amount}/year) will renew automatically on ${when}. PayPal will charge your saved payment method on that date — no action needed.`,
          `Invoice ${invoice.invoiceNumber} has the details. To turn off automatic renewal, open the invoice before the renewal date.`,
        ],
        cta: { label: "View invoice", url },
      });
      await sendEmail({
        to: quote.contact_email as string,
        toName: quote.contact_name as string,
        subject: `Upcoming renewal — ${String(sub.service_name)} ${amount} on ${when}`,
        ...mail,
      });
      if (quote.sms_opt_in && quote.phone) {
        await sendSms({
          to: quote.phone as string,
          message: `BLEXware: your ${String(sub.service_name)} (${amount}/yr) auto-renews ${when}. Details: ${url}. Reply STOP to opt out.`,
        });
      }
      await writeAudit({
        actorLabel: "system",
        action: "subscription.renewal_notice",
        entity: "quote",
        entityId: sub.quote_id as string,
        metadata: { subscription_id: sub.id, invoice: invoice.invoiceNumber, renewal_date: renewal, auto_renew: true },
      });
    } catch (err) {
      console.error("[cron:subscriptions] renewal failed", sub.id, err);
    }
  }

  // Manual renewals that passed their renewal date unpaid become past due.
  await db
    .from("subscriptions")
    .update({ status: "past_due" } as never)
    .eq("status", "active")
    .eq("auto_renew", false)
    .lt("renewal_date", today);

  return { renewalsIssued };
}
