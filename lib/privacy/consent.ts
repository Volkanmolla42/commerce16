export const COOKIE_CONSENT_STORAGE_KEY = "commerce-cookie-consent-v1";
export const COOKIE_CONSENT_POLICY_VERSION = "2026-10-07";

function hasPrivacySignal() {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.globalPrivacyControl === true || nav.doNotTrack === "1";
}

export function hasMarketingConsent(): boolean {
  if (typeof window === "undefined" || hasPrivacySignal()) return false;
  try {
    const value: unknown = JSON.parse(localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY) || "null");
    return Boolean(
      value &&
        typeof value === "object" &&
        "marketing" in value &&
        value.marketing === true &&
        "policyVersion" in value &&
        value.policyVersion === COOKIE_CONSENT_POLICY_VERSION &&
        "updatedAt" in value &&
        typeof value.updatedAt === "number",
    );
  } catch {
    return false;
  }
}
