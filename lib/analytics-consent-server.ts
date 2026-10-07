import { createHmac, timingSafeEqual } from "node:crypto";
import { COOKIE_CONSENT_POLICY_VERSION } from "@/lib/privacy/consent";

export const ANALYTICS_CONSENT_COOKIE = "commerce_analytics_consent";
export const ANALYTICS_CONSENT_MAX_AGE_SECONDS = 180 * 24 * 60 * 60;

function signature(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function createAnalyticsConsentToken(secret: string, now = Date.now()) {
  const expiresAt = now + ANALYTICS_CONSENT_MAX_AGE_SECONDS * 1000;
  const value = `v1.${COOKIE_CONSENT_POLICY_VERSION}.${expiresAt}`;
  return `${value}.${signature(value, secret)}`;
}

export function hasValidAnalyticsConsentToken(
  token: string | undefined,
  secret: string | undefined,
  now = Date.now(),
) {
  if (!token || !secret || secret.length < 32) return false;
  const [version, policyVersion, rawExpiresAt, suppliedSignature, extra] = token.split(".");
  if (version !== "v1" || policyVersion !== COOKIE_CONSENT_POLICY_VERSION || !rawExpiresAt || !suppliedSignature || extra !== undefined) return false;
  const expiresAt = Number(rawExpiresAt);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now) return false;
  if (expiresAt - now > ANALYTICS_CONSENT_MAX_AGE_SECONDS * 1000 + 60_000) return false;

  const expected = Buffer.from(signature(`v1.${policyVersion}.${rawExpiresAt}`, secret), "hex");
  const supplied = Buffer.from(suppliedSignature, "hex");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
