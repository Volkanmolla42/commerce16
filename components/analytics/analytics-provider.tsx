"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { ADMIN_BASE_PATH } from "@/lib/admin/routes";
import {
  ensureAnalyticsConsentCookie,
  hasAnalyticsConsent,
  revokeAnalyticsConsent,
  trackAnalyticsEvent,
} from "@/lib/analytics-client";

function isExcludedPath(pathname: string) {
  return pathname.startsWith("/admin") || pathname === ADMIN_BASE_PATH || pathname.startsWith(`${ADMIN_BASE_PATH}/`) || pathname.startsWith("/account") || pathname.startsWith("/api/");
}

export function AnalyticsProvider() {
  const pathname = usePathname();
  const lastTrackedPath = useRef<string | null>(null);

  const trackPath = useCallback(async (path: string | null) => {
    if (!path || isExcludedPath(path)) return;
    if (!hasAnalyticsConsent()) {
      lastTrackedPath.current = null;
      return;
    }
    if (lastTrackedPath.current === path) return;

    const ready = await ensureAnalyticsConsentCookie();
    if (!ready || !hasAnalyticsConsent()) return;
    lastTrackedPath.current = path;
    void trackAnalyticsEvent("page_view", { route: path });

    if (/^\/product\/[^/]+$/.test(path)) void trackAnalyticsEvent("product_view", { route: path });
  }, []);

  useEffect(() => {
    void trackPath(pathname);
  }, [pathname, trackPath]);

  useEffect(() => {
    const onConsentChange = () => {
      if (hasAnalyticsConsent()) {
        lastTrackedPath.current = null;
        void trackPath(pathname);
      } else {
        lastTrackedPath.current = null;
        void revokeAnalyticsConsent();
      }
    };

    window.addEventListener("commerce-cookie-consent-change", onConsentChange);
    window.addEventListener("storage", onConsentChange);
    return () => {
      window.removeEventListener("commerce-cookie-consent-change", onConsentChange);
      window.removeEventListener("storage", onConsentChange);
    };
  }, [pathname, trackPath]);

  return null;
}
