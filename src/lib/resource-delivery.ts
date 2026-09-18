const encoder = new TextEncoder();

export type ResourceDeliveryMode = "view" | "download";

export type ResourceDeliveryClaims = {
  resourceId: string;
  path: string;
  mode: ResourceDeliveryMode;
  expiresAt: number;
};

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function hmac(secret: string, value: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}

/** Creates a short-lived, tamper-resistant grant for exactly one resource file. */
export async function createResourceDeliveryToken(
  claims: ResourceDeliveryClaims,
  secret: string,
): Promise<string> {
  const payload = base64Url(encoder.encode(JSON.stringify(claims)));
  const signature = base64Url(await hmac(secret, payload));
  return `${payload}.${signature}`;
}

/** Returns verified claims, or null for malformed, changed, or expired grants. */
export async function verifyResourceDeliveryToken(
  token: string,
  secret: string,
  now = Date.now(),
): Promise<ResourceDeliveryClaims | null> {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;

  let provided: Uint8Array;
  try {
    provided = fromBase64Url(signature);
  } catch {
    return null;
  }
  const expected = await hmac(secret, payload);
  if (!equalBytes(provided, expected)) return null;

  try {
    const parsed = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as Partial<ResourceDeliveryClaims>;
    if (
      typeof parsed.resourceId !== "string" ||
      !parsed.resourceId ||
      typeof parsed.path !== "string" ||
      !parsed.path ||
      (parsed.mode !== "view" && parsed.mode !== "download") ||
      typeof parsed.expiresAt !== "number" ||
      !Number.isFinite(parsed.expiresAt) ||
      parsed.expiresAt <= now
    ) {
      return null;
    }
    return parsed as ResourceDeliveryClaims;
  } catch {
    return null;
  }
}

export function safeAttachmentName(name: string): string {
  const cleaned = name.replace(/[\r\n"\\/]/g, "_").trim();
  return cleaned || "attachment";
}

export function resourceDeliveryPath(token: string): string {
  return `/api/resources/file?token=${encodeURIComponent(token)}`;
}