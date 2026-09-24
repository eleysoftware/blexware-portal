// Server-only SMS delivery via Textbee.dev (https://textbee.dev).
// Textbee sends through an Android phone registered as a gateway device, so
// texts go out only while that phone is on, charged and online.

const TEXTBEE_API_BASE = "https://api.textbee.dev/api/v1/gateway/devices";

export type SendSmsResult = { sent: boolean; reason?: string };

/**
 * Normalises a phone number to E.164. Accepts US 10-digit numbers (assumes
 * +1) and numbers already carrying a country code. Returns null when the
 * number cannot be made valid.
 */
export function normalizePhoneToE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const digits = trimmed.replace(/[^\d+]/g, "");
  const withoutPlus = digits.replace(/^\+/, "");
  if (!/^\d+$/.test(withoutPlus)) return null;
  if (digits.startsWith("+")) {
    return withoutPlus.length >= 8 && withoutPlus.length <= 15 ? `+${withoutPlus}` : null;
  }
  if (withoutPlus.length === 10) return `+1${withoutPlus}`;
  if (withoutPlus.length === 11 && withoutPlus.startsWith("1")) return `+${withoutPlus}`;
  return null;
}

export async function sendSms(input: { to: string; message: string }): Promise<SendSmsResult> {
  const apiKey = process.env["TEXTBEE_API_KEY"];
  const deviceId = process.env["TEXTBEE_DEVICE_ID"];
  if (!apiKey || !deviceId) {
    console.error("[sms] TEXTBEE_API_KEY or TEXTBEE_DEVICE_ID is not configured");
    return { sent: false, reason: "not_configured" };
  }

  const recipient = normalizePhoneToE164(input.to);
  if (!recipient) return { sent: false, reason: "invalid_number" };

  try {
    const response = await fetch(`${TEXTBEE_API_BASE}/${deviceId}/send-sms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({ recipients: [recipient], message: input.message }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("[sms] send failed", response.status, detail);
      return { sent: false, reason: `textbee_${response.status}` };
    }
    return { sent: true };
  } catch (error) {
    console.error("[sms] send threw", error);
    return { sent: false, reason: "network_error" };
  }
}
