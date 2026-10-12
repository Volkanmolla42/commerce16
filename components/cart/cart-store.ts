import type { Product } from "../../lib/catalog/types";
import { MAX_CART_QUANTITY, getVariantStock } from "@/lib/catalog/variants";
import { trackAnalyticsEvent } from "@/lib/analytics-client";
import type { ProductImage } from "@/lib/catalog/types";

export type CartItem = { product: Product; quantity: number; variantId?: string };
export const CART_STORAGE_KEY = "commerce_cart_v2";
const EMPTY_CART: CartItem[] = [];

export function cartLineKey(productId: string, variantId?: string) {
  return `${productId}:${variantId ?? ""}`;
}

function isProductImage(value: unknown): value is ProductImage {
  if (!value || typeof value !== "object") return false;
  const image = value as Partial<ProductImage>;
  return typeof image.url === "string" &&
    (image.selectedOptions === undefined || (Array.isArray(image.selectedOptions) && image.selectedOptions.every((option) =>
      typeof option.name === "string" && typeof option.value === "string")));
}

function readItems(): CartItem[] {
  if (typeof window === "undefined") return EMPTY_CART;
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || "[]");
    if (!Array.isArray(stored)) return [];
    const items = stored.filter((item): item is CartItem => {
      const product = item?.product;
      return product && typeof product.id === "string" && typeof product.slug === "string" &&
        typeof product.title === "string" && typeof product.price === "string" &&
        /^\d+(?:\.\d{1,2})?$/.test(product.price) && Number.isFinite(Number(product.price)) &&
        typeof product.availableForSale === "boolean" && Array.isArray(product.images) &&
        product.images.every(isProductImage) &&
        Number.isSafeInteger(item.quantity) && item.quantity > 0 && item.quantity <= MAX_CART_QUANTITY &&
        (item.variantId === undefined || typeof item.variantId === "string");
    });
    return items.map((item) => item.variantId || item.product.variants?.length !== 1
      ? item
      : { ...item, variantId: item.product.variants[0].id });
  } catch {
    return [];
  }
}

let inMemoryItems: CartItem[] | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function getLiveItems(): CartItem[] {
  if (typeof window === "undefined") return EMPTY_CART;
  if (inMemoryItems === null) {
    inMemoryItems = readItems();
  }
  return inMemoryItems;
}

function change(update: (current: CartItem[]) => CartItem[]) {
  const current = getLiveItems();
  inMemoryItems = update(current);
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(inMemoryItems));
  } catch {
    // In-memory cart works even when browser storage is unavailable.
  }
  notify();
}

const matches = (item: CartItem, productId: string, variantId?: string) =>
  item.product.id === productId && item.variantId === variantId;

export const cartStore = {
  getSnapshot: () => getLiveItems(),
  getServerSnapshot: () => EMPTY_CART,
  subscribe(listener: () => void) {
    listeners.add(listener);
    if (inMemoryItems === null && typeof window !== "undefined") {
      inMemoryItems = readItems();
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key === CART_STORAGE_KEY || event.key === null) {
        inMemoryItems = readItems();
        notify();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  },
  addItem(product: Product, quantity = 1, variantId?: string) {
    if (!product.availableForSale || !Number.isSafeInteger(quantity) || quantity <= 0) return;
    const maxStock = getVariantStock(product, variantId);
    if (maxStock <= 0) return;
    change((current) => {
      const existing = current.some((item) => matches(item, product.id, variantId));
      return existing
        ? current.map((item) => matches(item, product.id, variantId)
          ? { product, variantId, quantity: Math.min(maxStock, item.quantity + quantity) } : item)
        : [...current, { product, quantity: Math.min(maxStock, quantity), variantId }];
    });
    void trackAnalyticsEvent("add_to_cart");
  },
  replaceItem(sourceProductId: string, sourceVariantId: string | undefined, product: Product, quantity: number, variantId?: string) {
    if (!product.availableForSale || !Number.isSafeInteger(quantity) || quantity <= 0) return;
    const maxStock = getVariantStock(product, variantId);
    if (maxStock <= 0) return;
    change((current) => {
      if (!current.some((item) => matches(item, sourceProductId, sourceVariantId))) return current;
      const withoutSource = current.filter((item) => !matches(item, sourceProductId, sourceVariantId));
      const existingIndex = withoutSource.findIndex((item) => matches(item, product.id, variantId));
      if (existingIndex >= 0) {
        return withoutSource.map((item, index) => index === existingIndex
          ? { ...item, quantity: Math.min(maxStock, item.quantity + quantity) }
          : item);
      }
      return [...withoutSource, { product, quantity: Math.min(maxStock, quantity), variantId }];
    });
  },
  removeItem(productId: string, variantId?: string) {
    change((current) => current.filter((item) => !matches(item, productId, variantId)));
  },
  updateQuantity(productId: string, quantity: number, variantId?: string) {
    if (!Number.isSafeInteger(quantity)) return;
    change((current) => {
      if (quantity <= 0) return current.filter((item) => !matches(item, productId, variantId));
      return current.map((item) => {
        if (!matches(item, productId, variantId)) return item;
        const maxStock = getVariantStock(item.product, variantId);
        return { ...item, quantity: Math.min(maxStock, quantity) };
      });
    });
  },
  clearCart() {
    change(() => []);
  },
};

export type CartStore = typeof cartStore;
