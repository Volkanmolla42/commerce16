"use client";

import { useEffect, useRef, useState, startTransition } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { UNLIMITED_STOCK, getVariantStock } from "@/lib/catalog/variants";
import { CartStockAlertModal, type RemovedCartItem } from "./cart-stock-alert-modal";
import { cartLineKey, type CartItem, type CartStore } from "./cart-store";

/**
 * Sepetteki her satırı canlı stokla doğrular: tükenenleri kaldırır, aşan adetleri kırpıp
 * kullanıcıyı modal ile uyarır.getItemMaxStock; buton ve sepet adet kontrollerinin ortak kaynağıdır.
 */
export function useStockGuard(items: CartItem[], store: CartStore) {
  const [alertItems, setAlertItems] = useState<RemovedCartItem[]>([]);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const autoRemovedKeys = useRef<Set<string>>(new Set());

  const validationArgs = items.length > 0
    ? {
        items: items.map((item) => ({
          productId: item.product.id as Id<"products">,
          ...(item.variantId ? { variantId: item.variantId } : {}),
        })),
      }
    : "skip";
  const liveValidation = useQuery(api.products.validateCart, validationArgs);

  const stockMap = new Map<string, number>();
  for (const entry of liveValidation ?? []) {
    stockMap.set(cartLineKey(entry.productId, entry.variantId), Math.max(0, entry.stockQuantity));
  }

  function getItemMaxStock(productId: string, variantId?: string) {
    const liveStock = stockMap.get(cartLineKey(productId, variantId));
    if (liveStock !== undefined) return liveStock;
    const matching = items.find((item) => item.product.id === productId && item.variantId === variantId);
    return matching ? getVariantStock(matching.product, variantId) : UNLIMITED_STOCK;
  }

  // Kullanıcı ürünü yeniden sepete eklediyse veya sepeti temizlediyse otomatik kaldırma hafızasını bırak.
  function releaseStockKey(productId: string, variantId?: string) {
    autoRemovedKeys.current.delete(cartLineKey(productId, variantId));
  }

  function clearAllStockKeys() {
    autoRemovedKeys.current.clear();
  }

  useEffect(() => {
    if (!liveValidation) return;
    const toAlert: RemovedCartItem[] = [];
    for (const entry of liveValidation) {
      const matching = items.find((item) =>
        item.product.id === entry.productId && item.variantId === entry.variantId,
      );
      if (!matching) continue;

      const key = cartLineKey(entry.productId, entry.variantId);
      const variant = matching.variantId
        ? matching.product.variants?.find((candidate) => candidate.id === matching.variantId)
        : undefined;
      const baseItem = {
        id: entry.productId,
        variantId: entry.variantId,
        title: entry.title || matching.product.title,
        image: matching.product.images?.[0]?.url,
        variantTitle: variant?.selectedOptions?.map((option) => option.value).join(", ") || variant?.title,
      };

      if (!entry.available || entry.stockQuantity <= 0) {
        if (autoRemovedKeys.current.has(key)) continue;
        autoRemovedKeys.current.add(key);
        toAlert.push({ ...baseItem, reason: "out_of_stock" });
        store.removeItem(matching.product.id, matching.variantId);
      } else if (matching.quantity > entry.stockQuantity) {
        toAlert.push({ ...baseItem, reason: "quantity_adjusted", adjustedQuantity: entry.stockQuantity });
        store.updateQuantity(matching.product.id, entry.stockQuantity, matching.variantId);
      }
    }
    if (toAlert.length > 0) {
      startTransition(() => {
        setAlertItems((prev) => [...prev, ...toAlert]);
        setIsAlertOpen(true);
      });
    }
  }, [liveValidation, items, store]);

  function dismissAlert() {
    setIsAlertOpen(false);
    setAlertItems([]);
  }

  const alert = (
    <CartStockAlertModal open={isAlertOpen} onClose={dismissAlert} items={alertItems} />
  );

  return { getItemMaxStock, releaseStockKey, clearAllStockKeys, alert };
}
