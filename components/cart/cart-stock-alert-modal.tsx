"use client";

import Image from "next/image";
import { ShoppingBagIcon } from "@heroicons/react/24/outline";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export type RemovedCartItem = {
  id: string;
  variantId?: string;
  title: string;
  image?: string;
  variantTitle?: string;
  reason: "out_of_stock" | "quantity_adjusted";
  adjustedQuantity?: number;
};

interface CartStockAlertModalProps {
  open: boolean;
  onClose: () => void;
  items: RemovedCartItem[];
}

export function CartStockAlertModal({
  open,
  onClose,
  items,
}: CartStockAlertModalProps) {
  if (items.length === 0) return null;

  const hasAdjusted = items.some((item) => item.reason === "quantity_adjusted");
  const hasOutOfStock = items.some((item) => item.reason === "out_of_stock");

  const description = hasAdjusted && !hasOutOfStock
    ? "Stok sınırını aşan ürünlerin miktarı mevcut stok adedine göre güncellendi."
    : hasOutOfStock && !hasAdjusted
      ? "Stoğu tükenen ürün(ler) sepetinizden otomatik olarak kaldırıldı."
      : "Stok durumu değişen ürünler sepetinizde güncellendi.";

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md rounded-3xl p-6">
        <DialogHeader className="space-y-1.5 text-left">
          <DialogTitle className="text-lg font-bold text-foreground">
            Sepetiniz Güncellendi
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="divide-y divide-border/60 max-h-64 overflow-y-auto my-2">
          {items.map((item) => (
            <div
              key={`${item.id}:${item.variantId ?? ""}`}
              className="flex items-center gap-3 py-3 first:pt-1 last:pb-1"
            >
              <div className="relative size-14 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
                {item.image ? (
                  <Image
                    src={item.image}
                    alt={item.title}
                    width={56}
                    height={56}
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-muted-foreground">
                    <ShoppingBagIcon className="size-6" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <h4 className="line-clamp-1 text-sm font-medium leading-snug text-foreground">
                  {item.title}
                </h4>
                {item.variantTitle && (
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                    {item.variantTitle}
                  </p>
                )}
              </div>

              <div className="shrink-0">
                {item.reason === "quantity_adjusted" ? (
                  <Badge variant="secondary" className="text-[11px] font-medium">
                    Stok: {item.adjustedQuantity} Adet
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="text-[11px] font-medium">
                    Tükendi
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            size="lg"
            className="w-full rounded-2xl font-semibold shadow-xs"
            onClick={onClose}
          >
            Anladım
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
