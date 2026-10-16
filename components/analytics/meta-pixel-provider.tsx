"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  getMetaPixelId,
  initMetaPixel,
  trackPixelPageView,
} from "@/lib/analytics/meta-pixel";
import { hasMarketingConsent } from "@/lib/privacy/consent";

function isExcludedPath(pathname: string) {
  return (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/account") ||
    pathname.startsWith("/api/")
  );
}

function trackCurrentPath(path: string | null, lastTrackedRef: { current: string | null }) {
  const pixelId = getMetaPixelId();
  if (!pixelId || !path || isExcludedPath(path)) return;
  if (!hasMarketingConsent()) {
    lastTrackedRef.current = null;
    return;
  }
  if (lastTrackedRef.current === path) return;

  const initialized = initMetaPixel();
  if (!initialized) return;

  lastTrackedRef.current = path;
  trackPixelPageView();
}

export function MetaPixelProvider() {
  const pathname = usePathname();
  const lastTrackedPath = useRef<string | null>(null);

  useEffect(() => {
    trackCurrentPath(pathname, lastTrackedPath);
  }, [pathname]);

  useEffect(() => {
    const onConsentChange = () => {
      if (hasMarketingConsent()) {
        lastTrackedPath.current = null;
        trackCurrentPath(pathname, lastTrackedPath);
      } else {
        lastTrackedPath.current = null;
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
