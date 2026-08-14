// Server-only email delivery via the Zoho ZeptoMail HTTPS API.
// SMTP is unavailable in the Worker runtime, so all mail goes over HTTPS.

const ZEPTOMAIL_ENDPOINT = "https://api.zeptomail.com/v1.1/email";

export const FROM_ADDRESS = "quote@blexware.com";
export const FROM_NAME = "BLEXware";
export const REPLY_TO_ADDRESS = "hello@blexware.com";

export type SendEmailInput = {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

export type SendEmailResult = { sent: boolean; reason?: string };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Minimal branded wrapper so every message looks like BLEXware. */
export function renderEmail(options: {
  heading: string;
  paragraphs: string[];
  cta?: { label: string; url: string };
  footnote?: string;
}): { html: string; text: string } {
  const body = options.paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3F3F46;">${escapeHtml(p)}</p>`,
    )
    .join("");

  const cta = options.cta
    ? `<p style="margin:24px 0;"><a href="${options.cta.url}" style="display:inline-block;background:#3A8F73;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;font-size:15px;">${escapeHtml(options.cta.label)}</a></p>
       <p style="margin:0 0 16px;font-size:13px;color:#5E6470;word-break:break-all;">Or paste this link into your browser: ${options.cta.url}</p>`
    : "";

  const footnote = options.footnote
    ? `<p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#5E6470;">${escapeHtml(options.footnote)}</p>`
    : "";

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
    <p style="margin:0 0 24px;font-size:20px;font-weight:700;letter-spacing:-0.01em;"><span style="color:#A8D8C2;">BLEX</span><span style="color:#3F3F46;">ware</span></p>
    <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#23272F;">${escapeHtml(options.heading)}</h1>
    ${body}
    ${cta}
    ${footnote}
    <hr style="border:none;border-top:1px solid #E6E8EB;margin:32px 0 16px;" />
    <p style="margin:0;font-size:12px;color:#5E6470;">BLEXware — AI and custom software. Reply to this email to reach a human.</p>
  </div>
</body></html>`;

  const text = [
    options.heading,
    "",
    ...options.paragraphs,
    options.cta ? `\n${options.cta.label}: ${options.cta.url}` : "",
    options.footnote ?? "",
    "",
    "BLEXware — AI and custom software.",
  ]
    .filter(Boolean)
    .join("\n");

  return { html, text };
}

/**
 * Sends through ZeptoMail. Never throws into a caller's critical path — email
 * is a side effect of quote/proposal workflows, not a precondition.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const token = process.env["ZEPTOMAIL_TOKEN"];
  if (!token) {
    console.error("[email] ZEPTOMAIL_TOKEN is not configured");
    return { sent: false, reason: "not_configured" };
  }

  try {
    const response = await fetch(ZEPTOMAIL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token.startsWith("Zoho-enczapikey")
          ? token
          : `Zoho-enczapikey ${token}`,
      },
      body: JSON.stringify({
        from: { address: FROM_ADDRESS, name: FROM_NAME },
        to: [{ email_address: { address: input.to, name: input.toName ?? input.to } }],
        reply_to: [{ address: input.replyTo ?? REPLY_TO_ADDRESS, name: FROM_NAME }],
        subject: input.subject,
        htmlbody: input.html,
        textbody: input.text ?? "",
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("[email] send failed", response.status, detail);
      return { sent: false, reason: `provider_${response.status}` };
    }
    return { sent: true };
  } catch (error) {
    console.error("[email] send threw", error);
    return { sent: false, reason: "network_error" };
  }
}
