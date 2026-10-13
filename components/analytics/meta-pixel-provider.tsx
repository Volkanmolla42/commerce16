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

export function MetaPixelProvider() {
  const pathname = usePathname();
  const lastTrackedPath = useRef<string | null>(null);
  const pixelId = getMetaPixelId();

  const trackCurrentPath = (path: string | null) => {
    if (!pixelId || !path || isExcludedPath(path)) return;
    if (!hasMarketingConsent()) {
      lastTrackedPath.current = null;
      return;
    }
    if (lastTrackedPath.current === path) return;

    const initialized = initMetaPixel();
    if (!initialized) return;

    lastTrackedPath.current = path;
    trackPixelPageView();
  };

  useEffect(() => {
    trackCurrentPath(pathname);
  }, [pathname]);

  useEffect(() => {
    const onConsentChange = () => {
      if (hasMarketingConsent()) {
        lastTrackedPath.current = null;
        trackCurrentPath(pathname);
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
