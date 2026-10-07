import { COOKIE_CONSENT_POLICY_VERSION, COOKIE_CONSENT_STORAGE_KEY } from "@/lib/privacy/consent";

type AnalyticsEventType =
  | "page_view"
  | "product_view"
  | "add_to_cart"
  | "begin_checkout";

type Attribution = {
  source: string;
  medium: string;
  campaign?: string;
};

type AnalyticsContext = Attribution & {
  visitorId: string;
  sessionId: string;
};

const VISITOR_KEY = "commerce_analytics_visitor_v1";
const SESSION_KEY = "commerce_analytics_session_v1";
const FIRST_TOUCH_KEY = "commerce_analytics_first_touch_v1";
const SESSION_IDLE_MS = 30 * 60 * 1000;

let consentCookieReady = false;
let consentCookieSync: Promise<boolean> | null = null;

function hasPrivacySignal() {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.globalPrivacyControl === true || nav.doNotTrack === "1";
}

export function hasAnalyticsConsent() {
  if (typeof window === "undefined" || hasPrivacySignal()) return false;
  try {
    const value: unknown = JSON.parse(localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY) || "null");
    return Boolean(
      value && typeof value === "object" &&
      "analytics" in value && value.analytics === true &&
      "policyVersion" in value && value.policyVersion === COOKIE_CONSENT_POLICY_VERSION &&
      "updatedAt" in value && typeof value.updatedAt === "number",
    );
  } catch {
    return false;
  }
}

function createId() {
  return crypto.randomUUID();
}

function cleanAttributionValue(value: string | null, maxLength = 100) {
  const cleaned = (value ?? "").trim().replace(/[^\p{L}\p{N}._ -]/gu, "").slice(0, maxLength);
  return cleaned || undefined;
}

function readFirstTouch(): Attribution {
  try {
    const stored = localStorage.getItem(FIRST_TOUCH_KEY);
    if (stored) {
      const value: unknown = JSON.parse(stored);
      if (
        value && typeof value === "object" &&
        "source" in value && typeof value.source === "string" &&
        "medium" in value && typeof value.medium === "string"
      ) {
        const campaign = "campaign" in value && typeof value.campaign === "string"
          ? value.campaign.slice(0, 120)
          : undefined;
        return {
          source: value.source.slice(0, 100),
          medium: value.medium.slice(0, 100),
          ...(campaign ? { campaign } : {}),
        };
      }
    }

    const params = new URLSearchParams(window.location.search);
    let source = cleanAttributionValue(params.get("utm_source"));
    let medium = cleanAttributionValue(params.get("utm_medium"));
    const campaign = cleanAttributionValue(params.get("utm_campaign"), 120);
    if (!source && document.referrer) {
      try {
        const referrer = new URL(document.referrer);
        if (referrer.origin !== window.location.origin) {
          source = cleanAttributionValue(referrer.hostname);
          medium = "referral";
        }
      } catch {
        // Ignore malformed referrers.
      }
    }
    const attribution = { source: source ?? "direct", medium: medium ?? "none", ...(campaign ? { campaign } : {}) };
    localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(attribution));
    return attribution;
  } catch {
    return { source: "direct", medium: "none" };
  }
}

function getContext(): AnalyticsContext | null {
  if (!hasAnalyticsConsent()) return null;

  try {
    const visitorId = localStorage.getItem(VISITOR_KEY) || createId();
    localStorage.setItem(VISITOR_KEY, visitorId);

    const now = Date.now();
    let sessionId = "";
    try {
      const value: unknown = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
      if (
        value && typeof value === "object" &&
        "id" in value && typeof value.id === "string" &&
        "lastSeenAt" in value && typeof value.lastSeenAt === "number" &&
        now - value.lastSeenAt <= SESSION_IDLE_MS
      ) sessionId = value.id;
    } catch {
      sessionId = "";
    }
    if (!sessionId) sessionId = createId();
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id: sessionId, lastSeenAt: now }));

    return { visitorId, sessionId, ...readFirstTouch() };
  } catch {
    return null;
  }
}

export function getAnalyticsSessionIdForOrder() {
  return getContext()?.sessionId;
}

export async function ensureAnalyticsConsentCookie() {
  if (!hasAnalyticsConsent()) {
    consentCookieReady = false;
    consentCookieSync = null;
    return false;
  }
  if (consentCookieReady) return true;
  if (consentCookieSync) return consentCookieSync;

  consentCookieSync = fetch("/api/analytics/consent", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ analytics: true }),
  }).then((response) => {
    consentCookieReady = response.ok;
    return response.ok;
  }).catch(() => false).finally(() => {
    consentCookieSync = null;
  });

  return consentCookieSync;
}

export async function trackAnalyticsEvent(
  eventType: AnalyticsEventType,
  details: { route?: string } = {},
) {
  const context = getContext();
  if (!context || !(await ensureAnalyticsConsentCookie()) || !hasAnalyticsConsent()) return false;

  try {
    const response = await fetch("/api/analytics/collect", {
      method: "POST",
      credentials: "same-origin",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...context, ...details, eventType }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function revokeAnalyticsConsent() {
  consentCookieReady = false;
  consentCookieSync = null;
  let visitorId: string | null = null;
  try {
    visitorId = localStorage.getItem(VISITOR_KEY);
  } catch {
    // The server cookie is still cleared when browser storage is unavailable.
  }

  try {
    await fetch("/api/analytics/consent", {
      method: "DELETE",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId }),
    });
  } catch {
    // The browser stops tracking even if the data-erasure request is unavailable.
  }

  try {
    localStorage.removeItem(VISITOR_KEY);
    localStorage.removeItem(FIRST_TOUCH_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // No further tracking occurs without consent.
  }
}
