"use client";

import { routes } from "@/lib/storefront-routes";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  ensureAnalyticsConsentCookie,
  revokeAnalyticsConsent,
  trackAnalyticsEvent,
} from "@/lib/analytics-client";
import { hasAnalyticsConsent } from "@/lib/privacy/consent";

const productPathPrefix = routes.product("");

function isExcludedPath(pathname: string) {
  return (
    pathname.startsWith("/admin") ||
    pathname.startsWith(routes.account) ||
    pathname.startsWith(routes.checkoutSuccess("")) ||
    pathname.startsWith("/api/")
  );
}

function isProductPath(pathname: string) {
  return pathname.startsWith(productPathPrefix) && !pathname.slice(productPathPrefix.length).includes("/");
}

export function AnalyticsProvider() {
  const pathname = usePathname();
  const lastTrackedPath = useRef<string | null>(null);

  const trackPath = async (path: string | null) => {
    if (!path || isExcludedPath(path)) return;
    if (!hasAnalyticsConsent()) {
      lastTrackedPath.current = null;
      return;
    }
    if (lastTrackedPath.current === path) return;

    const ready = await ensureAnalyticsConsentCookie();
    if (!ready || !hasAnalyticsConsent()) return;
    lastTrackedPath.current = path;
    void trackAnalyticsEvent("page_view");

    if (isProductPath(path)) void trackAnalyticsEvent("product_view");
  };

  useEffect(() => {
    void trackPath(pathname);
  }, [pathname]);

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
  }, [pathname]);

  return null;
}
