import { DEFAULT_LOW_STOCK_THRESHOLD } from "./low-stock";
import { DEFAULT_NEW_BADGE_DAYS, isNewProduct } from "./new-badge";
import type { ProductVariant } from "./types";
import { isVariantSellable } from "./variants";

const LOW_STOCK_THRESHOLD = DEFAULT_LOW_STOCK_THRESHOLD;
const BESTSELLER_SALES_THRESHOLD = 10;

export type ProductBadge =
  | { kind: "discount"; percent: number }
  | { kind: "new" }
  | { kind: "low-stock" }
  | { kind: "bestseller" };

function discountPercent(price: string, compareAtPrice?: string): number | null {
  if (!compareAtPrice) return null;
  const current = Number(price);
  const compareAt = Number(compareAtPrice);
  if (!Number.isFinite(current) || !Number.isFinite(compareAt) || compareAt <= current || compareAt <= 0) return null;
  const percent = Math.round(((compareAt - current) / compareAt) * 100);
  return percent > 0 ? percent : null;
}

export function getProductBadges({
  variants,
  _creationTime,
  soldCount,
  selectedVariantId,
  compact = false,
  newBadgeDays = DEFAULT_NEW_BADGE_DAYS,
  lowStockThreshold = LOW_STOCK_THRESHOLD,
  now,
}: {
  variants?: ProductVariant[];
  _creationTime?: number;
  soldCount?: number;
  selectedVariantId?: string;
  compact?: boolean;
  newBadgeDays?: number;
  lowStockThreshold?: number;
  now?: number;
}): ProductBadge[] {
  if (!variants?.length) return [];
  const sellable = variants.filter(isVariantSellable);
  if (sellable.length === 0) return [];

  const selected = selectedVariantId
    ? variants.find((variant) => variant.id === selectedVariantId)
    : undefined;
  const priceBasis = selected ?? sellable.reduce((cheapest, variant) =>
    Number(variant.price) < Number(cheapest.price) ? variant : cheapest);
  const discount = discountPercent(priceBasis.price, priceBasis.compareAtPrice);

  const stock = selected
    ? (selected.stockQuantity ?? 0)
    : sellable.reduce((total, variant) => total + (variant.stockQuantity ?? 0), 0);
  const lowStock = stock > 0 && stock <= lowStockThreshold;
  const isNew = isNewProduct({ _creationTime, now, days: newBadgeDays });
  const isBestseller = (soldCount ?? 0) >= BESTSELLER_SALES_THRESHOLD;

  const statuses: ProductBadge[] = [];
  if (lowStock) statuses.push({ kind: "low-stock" });
  if (isBestseller) statuses.push({ kind: "bestseller" });
  if (isNew) statuses.push({ kind: "new" });

  return [
    ...(discount !== null ? [{ kind: "discount" as const, percent: discount }] : []),
    ...(compact ? statuses.slice(0, 1) : statuses),
  ];
}
