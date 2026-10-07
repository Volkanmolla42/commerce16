"use client";

import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from "react";
import { createCartStore, type CartItem } from "./cart-store";
import { getProductUnitPrice } from "@/lib/catalog/variants";
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
  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = items.reduce((sum, item) => sum + Math.round(Number(getProductUnitPrice(item.product, item.variantId)) * 100) * item.quantity, 0) / 100;

  return <CartContext.Provider value={{ ...store, items, totalCount, totalAmount }}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within a CartProvider");
  return context;
}
