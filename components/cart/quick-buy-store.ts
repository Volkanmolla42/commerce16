"use client";

import { useSyncExternalStore } from "react";
import type { CartItem } from "./cart-store";

export const QUICK_BUY_STORAGE_KEY = "commerce_quick_buy_v2";

let inMemoryItem: CartItem | null = null;
let initialized = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function readStorage(): CartItem | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(QUICK_BUY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.product && parsed.quantity > 0) {
      return parsed as CartItem;
    }
    return null;
  } catch {
    return null;
  }
}

function getItem(): CartItem | null {
  if (typeof window === "undefined") return null;
  if (!initialized) {
    initialized = true;
    inMemoryItem = readStorage();
  }
  return inMemoryItem;
}

export function setQuickBuyItem(item: CartItem) {
  initialized = true;
  inMemoryItem = item;
  try {
    sessionStorage.setItem(QUICK_BUY_STORAGE_KEY, JSON.stringify(item));
  } catch {
    // In-memory fallback
  }
  notify();
}

export function clearQuickBuyItem() {
  initialized = true;
  inMemoryItem = null;
  try {
    sessionStorage.removeItem(QUICK_BUY_STORAGE_KEY);
  } catch {
    // In-memory fallback
  }
  notify();
}

export function useQuickBuyItem(): CartItem | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getItem,
    () => null
  );
}

