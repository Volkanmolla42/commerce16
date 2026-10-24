import { hasMarketingConsent } from "@/lib/privacy/consent";

type FbqFunction = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[];
  loaded?: boolean;
  version?: string;
  push?: (...args: unknown[]) => void;
};

declare global {
  interface Window {
    fbq?: FbqFunction;
    _fbq?: unknown;
  }
}

export function getMetaPixelId(): string | null {
  const id = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim();
  return id ? id : null;
}

let isInitialized = false;

export function initMetaPixel(): boolean {
  if (typeof window === "undefined") return false;
  const pixelId = getMetaPixelId();
  if (!pixelId) return false;
  if (!hasMarketingConsent()) return false;
  if (isInitialized) return true;
  // Initialize the standard fbq snippet if not already loaded
  if (!window.fbq) {
    const fbq: FbqFunction = function (...args: unknown[]) {
      if (fbq.callMethod) {
        fbq.callMethod(...args);
      } else {
        fbq.queue = fbq.queue || [];
        fbq.queue.push(args);
      }
    };
    fbq.queue = [];
    fbq.loaded = true;
    fbq.version = "2.0";
    window.fbq = fbq;
    window._fbq = fbq;

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    const firstScript = document.getElementsByTagName("script")[0];
    if (firstScript?.parentNode) {
      firstScript.parentNode.insertBefore(script, firstScript);
    } else {
      document.head.appendChild(script);
    }
  }

  window.fbq("init", pixelId);
  isInitialized = true;
  return true;
}

function stripSensitiveQueryParams(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  let changed = false;
  for (const key of ["token", "recover"]) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }
  if (changed) {
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }
}

function trackPixelEvent(eventName: string, data?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  const pixelId = getMetaPixelId();
  if (!pixelId) return;
  if (!hasMarketingConsent()) return;

  if (!isInitialized) {
    const initialized = initMetaPixel();
    if (!initialized) return;
  }

  stripSensitiveQueryParams();

  if (window.fbq) {
    if (data) {
      window.fbq("track", eventName, data);
    } else {
      window.fbq("track", eventName);
    }
  }
}

export function trackPixelPageView(): void {
  trackPixelEvent("PageView");
}

export function trackPixelViewContent(params: {
  content_id: string;
  content_name: string;
  value?: number;
  currency?: string;
}): void {
  trackPixelEvent("ViewContent", {
    content_ids: [params.content_id],
    content_name: params.content_name,
    content_type: "product",
    ...(params.value !== undefined ? { value: params.value } : {}),
    currency: params.currency || "TRY",
  });
}

export function trackPixelAddToCart(params: {
  content_id: string;
  content_name: string;
  value?: number;
  currency?: string;
  quantity?: number;
}): void {
  trackPixelEvent("AddToCart", {
    content_ids: [params.content_id],
    content_name: params.content_name,
    content_type: "product",
    ...(params.value !== undefined ? { value: params.value } : {}),
    ...(params.quantity !== undefined ? { num_items: params.quantity } : {}),
    currency: params.currency || "TRY",
  });
}

export function trackPixelInitiateCheckout(params: {
  value?: number;
  currency?: string;
  num_items?: number;
  content_ids?: string[];
}): void {
  trackPixelEvent("InitiateCheckout", {
    ...(params.content_ids ? { content_ids: params.content_ids } : {}),
    ...(params.content_ids ? { content_type: "product" } : {}),
    ...(params.value !== undefined ? { value: params.value } : {}),
    ...(params.num_items !== undefined ? { num_items: params.num_items } : {}),
    currency: params.currency || "TRY",
  });
}

export function trackPixelPurchase(params: {
  order_id: string;
  value: number;
  currency?: string;
  num_items?: number;
  content_ids?: string[];
}): void {
  trackPixelEvent("Purchase", {
    order_id: params.order_id,
    value: params.value,
    currency: params.currency || "TRY",
    ...(params.num_items !== undefined ? { num_items: params.num_items } : {}),
    ...(params.content_ids ? { content_ids: params.content_ids, content_type: "product" } : {}),
  });
}

export function revokeMarketingConsent(): void {
  isInitialized = false;
  if (typeof document === "undefined") return;
  for (const name of ["_fbp", "_fbc"]) {
    document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
  }
  if (window.fbq) {
    window.fbq.queue = [];
  }
}
