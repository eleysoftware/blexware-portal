import { readEnv } from "./env";

const DEFAULT_ZEPTOMAIL_ENDPOINT = "https://api.zeptomail.com/v1.1/email";

export function emailProvider(): string {
  return (readEnv("EMAIL_PROVIDER") ?? "zeptomail").toLowerCase();
}

/** Transport endpoint for the configured provider. */
export function emailApiUrl(): string {
  return readEnv("EMAIL_API_URL", "ZEPTOMAIL_ENDPOINT") ?? DEFAULT_ZEPTOMAIL_ENDPOINT;
}

/** SERVER ONLY. Undefined means "email is not configured" (callers degrade). */
export function emailApiKey(): string | undefined {
  return readEnv("EMAIL_API_KEY", "ZEPTOMAIL_TOKEN");
}

export function emailFrom(): string {
  return readEnv("EMAIL_FROM") ?? "quote@blexware.com";
}

export function emailFromName(): string {
  return readEnv("EMAIL_FROM_NAME") ?? "BLEXware";
}

export function emailReplyTo(): string {
  return readEnv("EMAIL_REPLY_TO") ?? "hello@blexware.com";
}

export function emailBounceAddress(): string | undefined {
  return readEnv("EMAIL_BOUNCE_ADDRESS", "ZEPTOMAIL_BOUNCE_ADDRESS");
}

export const email = {
  get provider(): string {
    return emailProvider();
  },
  get apiUrl(): string {
    return emailApiUrl();
  },
  get from(): string {
    return emailFrom();
  },
  get fromName(): string {
    return emailFromName();
  },
  get replyTo(): string {
    return emailReplyTo();
  },
};
