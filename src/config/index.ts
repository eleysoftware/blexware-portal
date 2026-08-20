/**
 * Centralised, browser-safe application configuration.
 *
 * Use `config.database.supabaseUrl`, `config.payments.apiUrl`, … instead of
 * reading `process.env` anywhere in the app. Secrets are NOT exposed here —
 * import them from the individual modules inside a server handler:
 *
 *   const { supabaseServiceRoleKey } = await import("@/config/database");
 *   const { hyperswitchApiKey } = await import("@/config/payments");
 */
import { environment } from "./environment";
import { database } from "./database";
import { payments } from "./payments";
import { ai } from "./ai";
import { email } from "./email";
import { storage } from "./storage";

export const config = { environment, database, payments, ai, email, storage };

export { environment, database, payments, ai, email, storage };
export type { AppEnvironment } from "./environment";
export type { PaymentEnvironment } from "./payments";
