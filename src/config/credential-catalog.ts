// Browser-safe list of provider settings that admins can store in the database.
// Database values override environment variables of the same name.

export type CredentialField = { name: string; label: string; secret: boolean };
export type CredentialGroup = { id: string; title: string; fields: CredentialField[] };

export const CREDENTIAL_GROUPS: CredentialGroup[] = [
  {
    id: "paypal",
    title: "PayPal",
    fields: [
      { name: "PAYPAL_SANDBOX_CLIENT_ID", label: "Sandbox client ID", secret: false },
      { name: "PAYPAL_SANDBOX_CLIENT_SECRET", label: "Sandbox client secret", secret: true },
      { name: "PAYPAL_SANDBOX_WEBHOOK_ID", label: "Sandbox webhook ID", secret: false },
      { name: "PAYPAL_LIVE_CLIENT_ID", label: "Live client ID", secret: false },
      { name: "PAYPAL_LIVE_CLIENT_SECRET", label: "Live client secret", secret: true },
      { name: "PAYPAL_LIVE_WEBHOOK_ID", label: "Live webhook ID", secret: false },
    ],
  },
  {
    id: "hyperswitch",
    title: "Hyperswitch",
    fields: [
      { name: "HYPERSWITCH_API_URL", label: "API URL", secret: false },
      { name: "HYPERSWITCH_API_KEY", label: "API key", secret: true },
      { name: "HYPERSWITCH_PUBLISHABLE_KEY", label: "Publishable key", secret: false },
      { name: "HYPERSWITCH_PROFILE_ID", label: "Profile ID", secret: false },
      { name: "HYPERSWITCH_WEBHOOK_SECRET", label: "Webhook secret", secret: true },
    ],
  },
  {
    id: "email",
    title: "Email (ZeptoMail)",
    fields: [
      { name: "ZEPTOMAIL_TOKEN", label: "ZeptoMail token", secret: true },
      { name: "EMAIL_FROM", label: "From address", secret: false },
      { name: "EMAIL_FROM_NAME", label: "From name", secret: false },
      { name: "EMAIL_REPLY_TO", label: "Reply-to address", secret: false },
      { name: "EMAIL_BOUNCE_ADDRESS", label: "Bounce address", secret: false },
    ],
  },
  {
    id: "sms",
    title: "Text messages (Textbee)",
    fields: [
      { name: "TEXTBEE_API_KEY", label: "API key", secret: true },
      { name: "TEXTBEE_DEVICE_ID", label: "Device ID", secret: false },
    ],
  },
  {
    id: "ai",
    title: "AI",
    fields: [
      { name: "GEMINI_API_KEY", label: "Gemini API key", secret: true },
      { name: "GEMINI_MODEL", label: "Gemini model", secret: false },
      { name: "GROQ_API_KEY", label: "Groq API key", secret: true },
      { name: "GROQ_MODEL", label: "Groq model", secret: false },
    ],
  },
  {
    id: "system",
    title: "Scheduled jobs & sign-up hooks",
    fields: [
      { name: "AUTH_HOOK_SECRET", label: "Sign-up email hook secret", secret: true },
      { name: "CRON_SECRET", label: "Scheduled jobs secret", secret: true },
    ],
  },
];

export const CREDENTIAL_NAMES = new Set(
  CREDENTIAL_GROUPS.flatMap((group) => group.fields.map((field) => field.name)),
);
