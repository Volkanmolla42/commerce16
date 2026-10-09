"use client";

import { useSyncExternalStore } from "react";
import type { CartItem } from "./cart-store";
import type { ProductImage } from "@/lib/catalog/types";

const QUICK_BUY_STORAGE_KEY = "commerce_quick_buy_v2";

type QuickBuySnapshot = { ready: boolean; item: CartItem | null };
const SERVER_SNAPSHOT: QuickBuySnapshot = { ready: false, item: null };
let snapshot = SERVER_SNAPSHOT;
let initialized = false;
const listeners = new Set<() => void>();

function isProductImage(value: unknown): value is ProductImage {
  if (!value || typeof value !== "object") return false;
  const image = value as Partial<ProductImage>;
  return typeof image.url === "string" &&
    (image.selectedOptions === undefined || (Array.isArray(image.selectedOptions) && image.selectedOptions.every((option) =>
      typeof option.name === "string" && typeof option.value === "string")));
}

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<CartItem>;
  const product = item.product;
  return Boolean(
    product &&
    typeof product.id === "string" &&
    typeof product.slug === "string" &&
    typeof product.title === "string" &&
    typeof product.price === "string" &&
    /^\d+(?:\.\d{1,2})?$/.test(product.price) &&
    typeof product.availableForSale === "boolean" &&
    Array.isArray(product.images) &&
    product.images.every(isProductImage) &&
    item.quantity === 1 &&
    (item.variantId === undefined || typeof item.variantId === "string")
  );
}

function readItem(): CartItem | null {
  try {
    const stored: unknown = JSON.parse(sessionStorage.getItem(QUICK_BUY_STORAGE_KEY) || "null");
    return isCartItem(stored) ? stored : null;
  } catch {
    return null;
  }
}

function load() {
  if (initialized) return;
  initialized = true;
  snapshot = { ready: true, item: readItem() };
}

function notify() {
  listeners.forEach((listener) => listener());
}

export function setQuickBuyItem(item: CartItem) {
  load();
  snapshot = { ready: true, item };
  try {
    sessionStorage.setItem(QUICK_BUY_STORAGE_KEY, JSON.stringify(item));
  } catch {
    // The in-memory draft still works during client-side navigation.
  }
  notify();
}

export function clearQuickBuyItem() {
  load();
  snapshot = { ready: true, item: null };
  try {
    sessionStorage.removeItem(QUICK_BUY_STORAGE_KEY);
  } catch {
    // The in-memory draft is cleared even when browser storage is unavailable.
  }
  notify();
}

export function useQuickBuyDraft() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      load();
      return () => listeners.delete(listener);
    },
    () => snapshot,
    () => SERVER_SNAPSHOT,
  );
}
