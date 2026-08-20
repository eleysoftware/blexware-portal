# Portable environment configuration

Goal: stop reading `process.env` / `import.meta.env` all over the app, and make the same codebase run identically on Lovable, locally, in CI, staging and production.

## Two constraints worth knowing up front

1. This app is **TanStack Start + Vite**, not Next.js. Browser-visible variables must be prefixed `VITE_`, not `NEXT_PUBLIC_` — `NEXT_PUBLIC_*` values are simply never injected into the bundle here. The `.env.example` will use `VITE_*` for the public ones and keep the plain names for server-only ones.
2. Lovable/Cloud injects `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` automatically. The config module will **read those as fallbacks** so the app keeps working on Lovable while also accepting your own names elsewhere. Nothing becomes Lovable-only, and nothing breaks today.

## Config module

New `src/config/` (imported as `@/config/...`; a root `/config` folder would sit outside the Vite alias and the server/client import guards):

```text
src/config/
  env.ts          reader + validation helpers (no secrets, no side effects)
  environment.ts  appEnv (local|test|development|staging|production), appUrl, isProd
  database.ts     supabaseUrl, anonKey, serviceRoleKey (server-only), projectId
  payments.ts     hyperswitch apiUrl, apiKey, publishableKey, profileId, webhookSecret, environment
  ai.ts           provider, apiKey, gatewayUrl, model defaults
  email.ts        provider, apiKey/token, endpoint, from/bounce addresses
  storage.ts      quoteBucket, documentsBucket
  index.ts        `export const config = { environment, database, payments, ai, email, storage }`
```

Rules the module enforces:

- **Client-safe vs server-only split.** `config/index.ts` exposes only browser-safe values (app URL, supabase URL + anon key, hyperswitch publishable key, bucket names). Secrets live in `*.server.ts` accessors (`config/payments.server.ts` etc.) that are read **inside handlers**, never at module scope — module-scope reads are undefined in this runtime and would leak server modules into client bundles.
- **Lazy + memoised.** Each accessor is a function evaluated on first use, so a missing staging secret fails on the code path that needs it, with a clear message, instead of blanking the whole site.
- **Explicit missing-variable errors** listing the exact names, reusing the existing "Missing … variable(s)" wording.
- **Name fallback chain**, e.g. supabase URL: `VITE_SUPABASE_URL` → `SUPABASE_URL` → existing publishable fallback constant.

## Files migrated to `config.*`

- `src/integrations/supabase/client.ts`, `client.server.ts`, `auth-middleware.ts` → `config.database`
- `src/lib/payments/hyperswitch.server.ts` → `config.payments` (adds `HYPERSWITCH_API_URL` as the preferred name, keeping `HYPERSWITCH_BASE_URL` as a fallback)
- `src/routes/api/public/hyperswitch/webhook.ts` → `config.payments.webhookSecret`
- `src/lib/email.server.ts` → `config.email` (`EMAIL_PROVIDER` defaulting to `zeptomail`, `EMAIL_API_KEY` falling back to `ZEPTOMAIL_TOKEN`)
- `src/lib/admin.functions.ts`, `src/lib/engagement.functions.ts` → `config.ai` (`AI_PROVIDER`, `AI_API_KEY` falling back to `LOVABLE_API_KEY`)
- `src/lib/blex.server.ts`, document/storage helpers → `config.storage`
- `src/routes/api/public/cron/engagement.ts`, `auth-hooks/password-check.ts` → `config.environment` secrets accessors

Tests and `playwright.config.ts` keep reading `process.env` directly — that's test harness wiring, not app code.

## Env files

- Add `.env.example` — every required variable, grouped by config module, with comments, **no values**.
- Add `.env.local`, `.env.test`, `.env.development`, `.env.*.local` to `.gitignore` (`.env` already ignored). Vite loads `.env.local` and `.env.<mode>` automatically; staging/production continue to come from the hosting platform's secret manager (Lovable secrets today, any other host later).
- Add a short "Environment configuration" section to `README.md` describing which file each environment uses and how to add a new variable (add to `.env.example` → add to the right config module → use `config.x.y`).

`.env.example` contents (public ones prefixed `VITE_`):

```text
VITE_APP_URL=
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
HYPERSWITCH_API_URL=
HYPERSWITCH_API_KEY=
VITE_HYPERSWITCH_PUBLISHABLE_KEY=
HYPERSWITCH_PROFILE_ID=
HYPERSWITCH_WEBHOOK_SECRET=
HYPERSWITCH_ENVIRONMENT=
AI_PROVIDER=
AI_API_KEY=
EMAIL_PROVIDER=
EMAIL_API_KEY=
EMAIL_FROM=
STORAGE_BUCKET_DOCUMENTS=
STORAGE_BUCKET_QUOTES=
CRON_SECRET=
AUTH_HOOK_SECRET=
```

## Verification

- `rg "process\.env" src` returns only `src/config/**` afterwards.
- Typecheck + build pass; `/auth`, `/free-quote`, `/admin` and the invoice pay page still load, and the pay page still shows the graceful "arrange payment directly" state while Hyperswitch secrets are unset.

No behaviour changes, no secrets committed, no new dependencies.
