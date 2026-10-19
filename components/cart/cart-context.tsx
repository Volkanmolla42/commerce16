"use client";

import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useMutation } from "convex/react";
import { cartStore, type CartItem, type CartStore } from "./cart-store";
import { getProductUnitPrice } from "@/lib/catalog/variants";
import { getCartRecoverySessionKey } from "./recovery-store";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useStockGuard } from "./use-stock-guard";

export type RemovedCartItem = { item: CartItem; index: number };

type CartContextType = Pick<CartStore, "removeItem" | "clearCart"> & {
  items: CartItem[];
  totalCount: number;
  totalAmount: number;
  addItem: CartStore["addItem"];
  replaceItem: CartStore["replaceItem"];
  updateQuantity: CartStore["updateQuantity"];
  getItemMaxStock: (productId: string, variantId?: string) => number;
  removedItem: RemovedCartItem | null;
  restoreLastRemoved: () => void;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

function findCartItem(items: CartItem[], productId: string, variantId?: string) {
  const index = items.findIndex((item) => item.product.id === productId && item.variantId === variantId);
  return index >= 0 ? { item: items[index], index } : null;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const store = cartStore;
  const items = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const lastSessionKey = useRef<string | null>(null);
  const syncActiveCart = useMutation(api.activeCarts.sync);
  const { getItemMaxStock, releaseStockKey, clearAllStockKeys, alert } = useStockGuard(items, store);
  const [removedItem, setRemovedItem] = useState<RemovedCartItem | null>(null);

  // Otomatik kaldırılan bir satır kullanıcı tarafından yeniden ekleniyorsa stok hafızasını serbest bırak.
  const addItem: CartStore["addItem"] = (product, quantity, variantId) => {
    releaseStockKey(product.id, variantId);
    store.addItem(product, quantity, variantId);
  };
  const replaceItem: CartStore["replaceItem"] = (sourceProductId, sourceVariantId, product, quantity, variantId) => {
    releaseStockKey(product.id, variantId);
    store.replaceItem(sourceProductId, sourceVariantId, product, quantity, variantId);
  };
  const removeItem: CartStore["removeItem"] = (productId, variantId) => {
    const removed = findCartItem(store.getSnapshot(), productId, variantId);
    releaseStockKey(productId, variantId);
    store.removeItem(productId, variantId);
    if (removed) setRemovedItem(removed);
  };
  const clearCart: CartStore["clearCart"] = () => {
    clearAllStockKeys();
    store.clearCart();
    setRemovedItem(null);
  };
  const updateQuantity: CartStore["updateQuantity"] = (productId, quantity, variantId) => {
    const removed = Number.isSafeInteger(quantity) && quantity <= 0
      ? findCartItem(store.getSnapshot(), productId, variantId)
      : null;
    store.updateQuantity(productId, Math.min(getItemMaxStock(productId, variantId), quantity), variantId);
    if (removed) setRemovedItem(removed);
  };

  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = items.reduce((sum, item) => sum + Math.round(Number(getProductUnitPrice(item.product, item.variantId)) * 100) * item.quantity, 0) / 100;

  useEffect(() => {
    let sessionKey: string | null;
    try {
      sessionKey = getCartRecoverySessionKey(items.length > 0) ?? lastSessionKey.current;
    } catch {
      return;
    }
    if (!sessionKey) return;
    if (items.length > 0) lastSessionKey.current = sessionKey;
    const timeout = window.setTimeout(() => {
      void syncActiveCart({
        sessionKey,
        items: items.map((item) => ({
          productId: item.product.id as Id<"products">,
          ...(item.variantId ? { variantId: item.variantId } : {}),
          quantity: item.quantity,
        })),
      }).then(() => {
        if (items.length === 0 && lastSessionKey.current === sessionKey) lastSessionKey.current = null;
      }).catch(() => undefined);
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [items, syncActiveCart]);

  useEffect(() => {
    if (!removedItem) return;
    const timeout = window.setTimeout(() => setRemovedItem(null), 6000);
    return () => window.clearTimeout(timeout);
  }, [removedItem]);

  const restoreLastRemoved = () => {
    if (!removedItem) return;
    store.restoreItem(removedItem.item, removedItem.index);
    setRemovedItem(null);
  };

  return (
    <CartContext.Provider value={{ ...store, addItem, replaceItem, removeItem, clearCart, updateQuantity, getItemMaxStock, items, totalCount, totalAmount, removedItem, restoreLastRemoved }}>
      {children}
      {alert}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within a CartProvider");
  return context;
}
