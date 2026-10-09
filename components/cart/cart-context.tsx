"use client";

import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useMutation } from "convex/react";
import { createCartStore, type CartItem } from "./cart-store";
import { getProductUnitPrice } from "@/lib/catalog/variants";
import { getCartRecoverySessionKey } from "./recovery-store";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
export type { CartItem } from "./cart-store";

type CartContextType = Pick<ReturnType<typeof createCartStore>, "addItem" | "replaceItem" | "removeItem" | "updateQuantity" | "clearCart"> & {
  items: CartItem[];
  totalCount: number;
  totalAmount: number;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createCartStore);
  const items = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const ready = useRef(false);
  const lastSessionKey = useRef<string | null>(null);
  const syncActiveCart = useMutation(api.activeCarts.sync);
  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = items.reduce((sum, item) => sum + Math.round(Number(getProductUnitPrice(item.product, item.variantId)) * 100) * item.quantity, 0) / 100;

  useEffect(() => { ready.current = true; }, []);
  useEffect(() => {
    if (!ready.current) return;
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

  return <CartContext.Provider value={{ ...store, items, totalCount, totalAmount }}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within a CartProvider");
  return context;
}
