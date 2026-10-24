export const COOKIE_CONSENT_STORAGE_KEY = "commerce-cookie-consent-v1";
export const COOKIE_CONSENT_POLICY_VERSION = "2026-10-24.1";
export const COOKIE_CONSENT_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;

export type CookieConsent = {
  necessary: true;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
  policyVersion: string;
  updatedAt: number;
};

type ConsentCategory = "functional" | "analytics" | "marketing";

let memoryConsent: CookieConsent | null = null;

export function setConsentMemory(consent: CookieConsent | null) {
  memoryConsent = consent;
}

function isFresh(consent: CookieConsent) {
  const age = Date.now() - consent.updatedAt;
  return age >= 0 && age <= COOKIE_CONSENT_MAX_AGE_MS;
}

function hasPrivacySignal() {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.globalPrivacyControl === true || nav.doNotTrack === "1";
}

export function parseConsent(rawValue: string | null): CookieConsent | null {
  try {
    const value: unknown = JSON.parse(rawValue || "null");
    if (!value || typeof value !== "object") return null;
    const consent = value as Partial<CookieConsent>;
    if (consent.policyVersion !== COOKIE_CONSENT_POLICY_VERSION || typeof consent.updatedAt !== "number") return null;
    if ([consent.functional, consent.analytics, consent.marketing].some((item) => typeof item !== "boolean")) return null;
    const parsed: CookieConsent = {
      necessary: true,
      functional: consent.functional!,
      analytics: consent.analytics!,
      marketing: consent.marketing!,
      policyVersion: COOKIE_CONSENT_POLICY_VERSION,
      updatedAt: consent.updatedAt,
    };
    return isFresh(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function readConsentRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
  } catch {
    return null;
  }
}

function readConsent(): CookieConsent | null {
  const stored = parseConsent(readConsentRaw());
  if (stored) return stored;
  return memoryConsent && isFresh(memoryConsent) ? memoryConsent : null;
}

function hasConsent(category: ConsentCategory): boolean {
  if (typeof window === "undefined" || hasPrivacySignal()) return false;
  return readConsent()?.[category] === true;
}

export function hasFunctionalConsent(): boolean {
  return hasConsent("functional");
}

export function hasAnalyticsConsent(): boolean {
  return hasConsent("analytics");
}

export function hasMarketingConsent(): boolean {
  return hasConsent("marketing");
}
