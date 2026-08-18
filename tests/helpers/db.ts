import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { requiredEnv, testEmail } from "./env";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    if (isNewSupabaseApiKey(supabaseKey) && headers.get("Authorization") === `Bearer ${supabaseKey}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

let cached: SupabaseClient | undefined;

export function testDb(): SupabaseClient {
  if (cached) return cached;
  const url = requiredEnv("SUPABASE_URL");
  const key = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  cached = createClient(url, key, {
    global: { fetch: createSupabaseFetch(key) },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export function newRunId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

const QUOTE_DEFAULTS = {
  project_type: "Web Application",
  industry: "Technology",
  services: ["Web Applications"],
  goals: "Playwright seeded engagement used only for automated tests.",
  budget: "$5,000 - $10,000",
  timeline: "1-3 months",
  contact_name: "Playwright Client",
  consent: true,
};

async function withTransientRetry<T>(run: () => Promise<T>, attempts = 4): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      last = error;
      const message = error instanceof Error ? error.message : String(error);
      if (!/JWT issued at future|clock/i.test(message) || attempt === attempts - 1) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }
  throw last;
}

export async function insertQuote(email: string, extras: Record<string, unknown> = {}) {
  return withTransientRetry(async () => {
    const db = testDb();
    const { data, error } = await db
      .from("quotes")
      .insert({
        ...QUOTE_DEFAULTS,
        contact_email: email,
        company: "Playwright Test Co",
        ...extras,
      })
      .select("id, quote_number, contact_email")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Could not insert quote");
    return data as { id: string; quote_number: string; contact_email: string };
  });
}

export async function insertDraftProposal(quoteId: string, content: string) {
  const db = testDb();
  const { data, error } = await db
    .from("proposals")
    .insert({
      quote_id: quoteId,
      content,
      status: "draft",
      model: "playwright",
      prompt: "Playwright fixture proposal",
    })
    .select("id, review_token")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not insert proposal");
  await db.from("quotes").update({ status: "proposal_draft" }).eq("id", quoteId);
  return data as { id: string; review_token: string };
}

export async function seedPayableInvoice(input: {
  email: string;
  status?: string;
  amountCents?: number;
  payToken?: string;
}) {
  const db = testDb();
  const quote = await insertQuote(input.email, { status: "invoicing" });
  const { data: agreement, error: agreementError } = await db
    .from("agreements")
    .insert({
      quote_id: quote.id,
      status: "signed",
      total_cents: input.amountCents ?? 64000,
      doc: {},
    })
    .select("id")
    .single();
  if (agreementError || !agreement) {
    throw new Error(agreementError?.message ?? "Could not insert agreement");
  }

  const payToken = input.payToken ?? crypto.randomUUID().replaceAll("-", "").slice(0, 32);
  const { data: invoice, error: invoiceError } = await db
    .from("invoices")
    .insert({
      quote_id: quote.id,
      agreement_id: agreement.id,
      sequence: 1,
      amount_cents: input.amountCents ?? 64000,
      amount_paid_cents: 0,
      currency: "usd",
      status: input.status ?? "sent",
      pay_token: payToken,
      issue_date: new Date().toISOString().slice(0, 10),
    })
    .select("id, pay_token, amount_cents, invoice_number")
    .single();
  if (invoiceError || !invoice) {
    throw new Error(invoiceError?.message ?? "Could not insert invoice");
  }

  return { quote, agreementId: agreement.id as string, invoice };
}

export async function seedPaymentAttempt(input: {
  invoiceId: string;
  providerPaymentId: string;
  amountCents: number;
  status?: string;
}) {
  const db = testDb();
  const { data, error } = await db
    .from("invoice_payments")
    .insert({
      invoice_id: input.invoiceId,
      amount_cents: input.amountCents,
      currency: "usd",
      status: input.status ?? "created",
      hyperswitch_payment_id: input.providerPaymentId,
    })
    .select("id, payment_reference, hyperswitch_payment_id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not insert payment attempt");
  return data as { id: string; payment_reference: string; hyperswitch_payment_id: string };
}

export async function getQuoteByEmail(email: string) {
  const db = testDb();
  const { data, error } = await db
    .from("quotes")
    .select("id, quote_number, status, contact_email")
    .eq("contact_email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as { id: string; quote_number: string; status: string; contact_email: string } | null;
}

export async function getInvoiceByQuoteId(quoteId: string) {
  const db = testDb();
  const { data, error } = await db
    .from("invoices")
    .select("id, pay_token, status, amount_cents, amount_paid_cents, invoice_number, sequence")
    .eq("quote_id", quoteId)
    .order("sequence", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function cleanupByEmail(email: string) {
  const db = testDb();
  await db.from("quotes").delete().eq("contact_email", email);
  const { data: users } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
  for (const user of users?.users ?? []) {
    if (user.email?.toLowerCase() === email.toLowerCase()) {
      await db.auth.admin.deleteUser(user.id);
    }
  }
}

export async function createConfirmedClient(email: string, password: string) {
  const db = testDb();
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(error?.message ?? "Could not create client user");
  const { error: roleError } = await db
    .from("user_roles")
    .insert({ user_id: data.user.id, role: "user" });
  if (roleError && !/duplicate|unique/i.test(roleError.message)) {
    throw new Error(roleError.message);
  }

  const anonKey = process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (anonKey) {
    const anon = createClient(requiredEnv("SUPABASE_URL"), anonKey, {
      global: { fetch: createSupabaseFetch(anonKey) },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: signInError } = await anon.auth.signInWithPassword({ email, password });
    if (signInError) throw new Error(`Test client cannot sign in: ${signInError.message}`);
  }

  return data.user;
}

export function playwrightEmail(runId: string, suffix = "client") {
  return testEmail(runId, suffix);
}

export async function ensureTestAdmin() {
  const email = (process.env["TEST_ADMIN_EMAIL"] ?? "playwright+admin@blexware.test").toLowerCase();
  const password = process.env["TEST_ADMIN_PASSWORD"] ?? "Playwright-Admin1!";
  const db = testDb();

  let userId: string | undefined;
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const found = data.users.find((user) => user.email?.toLowerCase() === email);
    if (found) {
      userId = found.id;
      break;
    }
    if (data.users.length < 200) break;
  }

  if (!userId) {
    const { data, error } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data.user) throw new Error(error?.message ?? "Could not create test admin");
    userId = data.user.id;
  } else {
    const { error } = await db.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
  }

  const { data: roles, error: roleError } = await db
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (roleError) throw new Error(roleError.message);
  if (!roles?.some((row) => row.role === "admin")) {
    const { error } = await db.from("user_roles").insert({ user_id: userId, role: "admin" });
    if (error) throw new Error(error.message);
  }

  return { email, password };
}
