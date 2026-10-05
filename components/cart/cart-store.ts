import type { Product } from "../../lib/catalog/types";

export type CartItem = { product: Product; quantity: number; variantId?: string };
export const CART_STORAGE_KEY = "commerce_cart_v1";
const EMPTY_CART: CartItem[] = [];

function readItems(): CartItem[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || "[]");
    if (!Array.isArray(stored)) return [];
    return stored.filter((item): item is CartItem => {
      const product = item?.product;
      return product && typeof product.id === "string" && typeof product.slug === "string" &&
        typeof product.title === "string" && typeof product.price === "string" &&
        /^\d+(?:\.\d{1,2})?$/.test(product.price) && Number.isFinite(Number(product.price)) &&
        typeof product.availableForSale === "boolean" && Array.isArray(product.images) &&
        product.images.every((image: unknown) => typeof image === "string") &&
        Number.isSafeInteger(item.quantity) && item.quantity > 0 && item.quantity <= 999 &&
        (item.variantId === undefined || typeof item.variantId === "string");
    });
  } catch {
    return [];
  }
}

/** Owns persistence and product/variant identity; React only subscribes. */
export function createCartStore() {
  let items = EMPTY_CART;
  let loaded = false;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  const load = () => {
    if (!loaded) {
      items = readItems();
      loaded = true;
    }
  };
  const change = (update: (current: CartItem[]) => CartItem[]) => {
    load();
    items = update(items);
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch {
      // The in-memory cart still works when browser storage is unavailable.
    }
    notify();
  };
  const matches = (item: CartItem, productId: string, variantId?: string) =>
    item.product.id === productId && item.variantId === variantId;

  return {
    getSnapshot: () => items,
    getServerSnapshot: () => EMPTY_CART,
    subscribe(listener: () => void) {
      listeners.add(listener);
      load();
      const onStorage = (event: StorageEvent) => {
        if (event.key === CART_STORAGE_KEY || event.key === null) {
          items = readItems();
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
      change((current) => {
        const existing = current.some((item) => matches(item, product.id, variantId));
        return existing
          ? current.map((item) => matches(item, product.id, variantId)
            ? { product, variantId, quantity: Math.min(999, item.quantity + quantity) } : item)
          : [...current, { product, quantity: Math.min(999, quantity), variantId }];
      });
    },
    removeItem(productId: string, variantId?: string) {
      change((current) => current.filter((item) => !matches(item, productId, variantId)));
    },
    updateQuantity(productId: string, quantity: number, variantId?: string) {
      if (!Number.isSafeInteger(quantity)) return;
      change((current) => quantity <= 0
        ? current.filter((item) => !matches(item, productId, variantId))
        : current.map((item) => matches(item, productId, variantId)
          ? { ...item, quantity: Math.min(999, quantity) } : item));
    },
    clearCart() { change(() => []); },
  };
}
