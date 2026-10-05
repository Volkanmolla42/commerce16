import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { CART_STORAGE_KEY, createCartStore } from "./cart-store";
import type { Product } from "../../lib/catalog/types";

const product: Product = { id: "product", slug: "product", title: "Ürün", price: "0.10", images: [], availableForSale: true, updatedAt: "2026-10-05" };
let saved = new Map<string, string>();
const storageEvents = new EventTarget();
beforeEach(() => {
  saved = new Map();
  vi.stubGlobal("localStorage", { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => saved.set(key, value) });
  vi.stubGlobal("window", storageEvents);
});
afterEach(() => vi.unstubAllGlobals());

test("restores valid legacy entries while discarding malformed data", () => {
  saved.set(CART_STORAGE_KEY, JSON.stringify([{ product, quantity: 2 }, null, { product, quantity: -1 }, { product: { ...product, price: "oops" }, quantity: 1 }]));
  const store = createCartStore();
  const unsubscribe = store.subscribe(() => {});
  expect(store.getSnapshot()).toEqual([{ product, quantity: 2 }]);
  expect(store.getServerSnapshot()).toEqual([]);
  unsubscribe();
});

test("keeps variant quantities independent and persists every operation", () => {
  const store = createCartStore();
  store.addItem(product, 1, "small");
  store.addItem(product, 2, "large");
  store.addItem(product, 2, "small");
  expect(store.getSnapshot().map((item) => item.quantity)).toEqual([3, 2]);
  store.updateQuantity(product.id, 4, "large");
  store.removeItem(product.id, "small");
  expect(JSON.parse(saved.get(CART_STORAGE_KEY)!)).toMatchObject([{ variantId: "large", quantity: 4 }]);
  store.clearCart();
  expect(store.getSnapshot()).toEqual([]);
});

test("rejects fractional quantities and sold-out products; zero removes only its variant", () => {
  const store = createCartStore();
  store.addItem(product, 1.2);
  store.addItem({ ...product, availableForSale: false });
  expect(store.getSnapshot()).toEqual([]);
  store.addItem(product, 1, "small");
  store.addItem(product, 1, "large");
  store.updateQuantity(product.id, 0, "small");
  expect(store.getSnapshot()).toMatchObject([{ variantId: "large" }]);
});

test("tracks cross-tab updates and keeps working when storage is blocked", () => {
  const store = createCartStore();
  const notify = vi.fn();
  const unsubscribe = store.subscribe(notify);
  saved.set(CART_STORAGE_KEY, JSON.stringify([{ product, quantity: 5 }]));
  const event = new Event("storage");
  Object.defineProperty(event, "key", { value: CART_STORAGE_KEY });
  storageEvents.dispatchEvent(event);
  expect(store.getSnapshot()[0]?.quantity).toBe(5);
  expect(notify).toHaveBeenCalledOnce();
  vi.stubGlobal("localStorage", { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } });
  store.addItem(product);
  expect(store.getSnapshot()[0]?.quantity).toBe(6);
  unsubscribe();
});
