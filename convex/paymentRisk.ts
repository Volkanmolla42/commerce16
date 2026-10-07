import { v } from "convex/values";

export const signedRiskContextValidator = v.object({
  ipAddress: v.string(),
  issuedAt: v.number(),
  signature: v.string(),
});

export type SignedRiskContext = {
  ipAddress: string;
  issuedAt: number;
  signature: string;
};

export async function hashRiskIdentifier(value: string, secret?: string) {
  const encoded = new TextEncoder().encode(value);
  const digest = secret && secret.length >= 32
    ? await crypto.subtle.sign(
        "HMAC",
        await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]),
        encoded,
      )
    : await crypto.subtle.digest("SHA-256", encoded);
  return toHex(new Uint8Array(digest));
}

function validIpAddress(value: string) {
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(value)) {
    return value.split(".").every((part) => Number(part) <= 255);
  }
  if (!/^[0-9a-fA-F:]+$/.test(value) || !value.includes(":")) return false;
  try {
    return new URL(`http://[${value}]/`).hostname.length > 0;
  } catch {
    return false;
  }
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function verifyCheckoutRiskContext(context: SignedRiskContext | undefined, secret: string | undefined) {
  if (!context || !secret || secret.length < 32 || !validIpAddress(context.ipAddress)) return null;
  if (!Number.isSafeInteger(context.issuedAt) || context.issuedAt > Date.now() + 60_000 || Date.now() - context.issuedAt > 30 * 60_000) return null;
  if (!/^[a-f0-9]{64}$/i.test(context.signature)) return null;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = toHex(new Uint8Array(await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${context.ipAddress}\n${context.issuedAt}`),
  )));
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= expected.charCodeAt(index) ^ context.signature.toLowerCase().charCodeAt(index);
  }
  return mismatch === 0 ? context.ipAddress : null;
}
