import { readEnv } from "./env";

/** Private bucket holding client quote attachments. */
export function quoteBucket(): string {
  return readEnv("STORAGE_BUCKET_QUOTES", "STORAGE_BUCKET") ?? "quote-uploads";
}

/** Private bucket holding generated proposals, SOWs and invoices. */
export function documentsBucket(): string {
  return readEnv("STORAGE_BUCKET_DOCUMENTS", "STORAGE_BUCKET") ?? "documents";
}

export const storage = {
  get quoteBucket(): string {
    return quoteBucket();
  },
  get documentsBucket(): string {
    return documentsBucket();
  },
};
