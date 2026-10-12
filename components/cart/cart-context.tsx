"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { useMutation } from "convex/react";
import { cartStore, type CartItem, type CartStore } from "./cart-store";
import { getProductUnitPrice } from "@/lib/catalog/variants";
import { getCartRecoverySessionKey } from "./recovery-store";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useStockGuard } from "./use-stock-guard";
export type { CartItem } from "./cart-store";

type CartContextType = Pick<CartStore, "removeItem" | "clearCart"> & {
  items: CartItem[];
  totalCount: number;
  totalAmount: number;
  addItem: CartStore["addItem"];
  replaceItem: CartStore["replaceItem"];
  updateQuantity: CartStore["updateQuantity"];
  getItemMaxStock: (productId: string, variantId?: string) => number;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const store = cartStore;
  const items = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const lastSessionKey = useRef<string | null>(null);
  const syncActiveCart = useMutation(api.activeCarts.sync);
  const { getItemMaxStock, releaseStockKey, clearAllStockKeys, alert } = useStockGuard(items, store);

  // Otomatik kaldırılan bir satır kullanıcı tarafından yeniden ekleniyorsa stok hafızasını serbest bırak.
  const addItem = useCallback<CartStore["addItem"]>((product, quantity, variantId) => {
    releaseStockKey(product.id, variantId);
    store.addItem(product, quantity, variantId);
  }, [releaseStockKey, store]);
  const replaceItem = useCallback<CartStore["replaceItem"]>((sourceProductId, sourceVariantId, product, quantity, variantId) => {
    releaseStockKey(product.id, variantId);
    store.replaceItem(sourceProductId, sourceVariantId, product, quantity, variantId);
  }, [releaseStockKey, store]);
  const removeItem = useCallback<CartStore["removeItem"]>((productId, variantId) => {
    releaseStockKey(productId, variantId);
    store.removeItem(productId, variantId);
  }, [releaseStockKey, store]);
  const clearCart = useCallback<CartStore["clearCart"]>(() => {
    clearAllStockKeys();
    store.clearCart();
  }, [clearAllStockKeys, store]);
  const updateQuantity = useCallback<CartStore["updateQuantity"]>((productId, quantity, variantId) => {
    store.updateQuantity(productId, Math.min(getItemMaxStock(productId, variantId), quantity), variantId);
  }, [getItemMaxStock, store]);

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

  return (
    <CartContext.Provider value={{ ...store, addItem, replaceItem, removeItem, clearCart, updateQuantity, getItemMaxStock, items, totalCount, totalAmount }}>
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
