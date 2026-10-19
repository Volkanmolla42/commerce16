"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConvex } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCart } from "@/components/cart/cart-context";
import {
  UNLIMITED_STOCK,
  getVariantProduct,
} from "@/lib/catalog/variants";
import type { Product } from "@/lib/catalog/types";

export type ReorderItem = {
  productId: string;
  variantId?: string;
  title: string;
  quantity: number;
  price: string;
  sku?: string;
  image?: string;
};

type SkippedItem = {
  title: string;
  reason: string;
};

export function OrderReorderButton({
  items,
  size = "default",
  variant = "default",
  className,
}: {
  items: ReorderItem[];
  size?: "default" | "sm" | "lg";
  variant?: "default" | "outline" | "secondary";
  className?: string;
}) {
  const convex = useConvex();
  const { addItem } = useCart();
  const router = useRouter();

  const [isPending, setIsPending] = useState(false);
  const [resultModal, setResultModal] = useState<{
    open: boolean;
    addedCount: number;
    skipped: SkippedItem[];
  }>({
    open: false,
    addedCount: 0,
    skipped: [],
  });

  async function handleReorder() {
    if (isPending || items.length === 0) return;
    setIsPending(true);

    try {
      const productIds = items.map((i) => i.productId);
      const freshProducts = await convex.query(api.products.getByIds, {
        ids: productIds,
      });
      const productMap = new Map<string, Product>(freshProducts.map((product) => [product.id, product]));

      let addedCount = 0;
      const skipped: SkippedItem[] = [];

      for (const item of items) {
        const product = productMap.get(item.productId);
        if (!product || !product.availableForSale) {
          skipped.push({
            title: item.title,
            reason: "Satışta değil",
          });
          continue;
        }

        const variants = product.variants ?? [];
        const resolvedVariantId =
          item.variantId ??
          (variants.length === 1 ? variants[0].id : undefined);

        if (variants.length > 0 && !resolvedVariantId) {
          skipped.push({
            title: item.title,
            reason: "Varyant bulunamadı",
          });
          continue;
        }

        const matchedVariant = resolvedVariantId
          ? variants.find((v) => v.id === resolvedVariantId)
          : undefined;

        if (
          resolvedVariantId &&
          (!matchedVariant ||
            !matchedVariant.availableForSale ||
            (matchedVariant.stockQuantity ?? 0) <= 0)
        ) {
          skipped.push({
            title: item.title,
            reason: "Tükendi",
          });
          continue;
        }

        const stock = matchedVariant?.stockQuantity ?? UNLIMITED_STOCK;
        if (stock <= 0) {
          skipped.push({
            title: item.title,
            reason: "Tükendi",
          });
          continue;
        }

        const cartProduct: Product = matchedVariant ? getVariantProduct(product, matchedVariant) : product;

        const quantityToAdd = Math.min(item.quantity, stock);
        addItem(cartProduct, quantityToAdd, resolvedVariantId);
        addedCount++;
      }

      if (skipped.length === 0 && addedCount > 0) {
        router.push("/cart");
      } else {
        setResultModal({
          open: true,
          addedCount,
          skipped,
        });
      }
    } catch (err) {
      console.error("Tekrar sipariş işleminde hata:", err);
    } finally {
      setIsPending(false);
    }
  }

  function closeModal() {
    setResultModal((prev) => ({ ...prev, open: false }));
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={isPending}
        onClick={handleReorder}
        className={className ?? (size === "sm" ? "rounded-xl font-medium" : "rounded-2xl font-semibold shadow-xs")}
      >
        <ArrowPathIcon className={`h-4 w-4 ${size === "sm" ? "mr-1" : "mr-1.5"} ${isPending ? "animate-spin" : ""}`} />
        <span>{isPending ? "Ekleniyor..." : "Tekrar Sipariş Ver"}</span>
      </Button>

      <Dialog open={resultModal.open} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6">
          <DialogHeader className="text-left space-y-1.5">
            <DialogTitle className="text-lg font-bold text-foreground">
              {resultModal.addedCount > 0 ? "Tekrar Sipariş Özeti" : "Ürünler Eklenemedi"}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {resultModal.addedCount > 0
                ? `${resultModal.addedCount} ürün sepetinize aktarıldı. ${resultModal.skipped.length} ürün stok durumu veya satış durumu nedeniyle eklenemedi:`
                : "Siparişteki ürünler şu anda stokta veya satışta bulunmadığı için sepetinize eklenemedi."}
            </DialogDescription>
          </DialogHeader>

          {resultModal.skipped.length > 0 && (
            <div className="my-2 divide-y divide-border/60 max-h-56 overflow-y-auto">
              {resultModal.skipped.map((s, idx) => (
                <div key={idx} className="flex items-center justify-between gap-3 py-2.5 text-xs">
                  <span className="font-medium text-foreground truncate">{s.title}</span>
                  <Badge variant="destructive" className="shrink-0 text-[11px]">
                    {s.reason}
                  </Badge>
                </div>
              ))}
            </div>
          )}

          <DialogFooter className="pt-2 flex flex-col sm:flex-row gap-2">
            {resultModal.addedCount > 0 && (
              <Button
                type="button"
                size="lg"
                className="w-full sm:w-auto flex-1 rounded-2xl font-semibold shadow-xs"
                onClick={() => {
                  closeModal();
                  router.push("/cart");
                }}
              >
                Sepete Git
              </Button>
            )}
            <Button
              type="button"
              variant={resultModal.addedCount > 0 ? "outline" : "default"}
              size="lg"
              className="w-full sm:w-auto rounded-2xl font-semibold"
              onClick={closeModal}
            >
              {resultModal.addedCount > 0 ? "Kapat" : "Anladım"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
