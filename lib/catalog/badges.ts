import { DEFAULT_LOW_STOCK_THRESHOLD } from "./low-stock";
import { DEFAULT_NEW_BADGE_DAYS, isNewProduct } from "./new-badge";
import type { ProductVariant } from "./types";
import { isVariantSellable } from "./variants";

export const LOW_STOCK_THRESHOLD = DEFAULT_LOW_STOCK_THRESHOLD;
export const BESTSELLER_SALES_THRESHOLD = 10;

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
  createdAt,
  publishedAt,
  soldCount,
  selectedVariantId,
  compact = false,
  newBadgeDays = DEFAULT_NEW_BADGE_DAYS,
  now,
}: {
  variants?: ProductVariant[];
  createdAt?: number;
  publishedAt?: number;
  soldCount?: number;
  selectedVariantId?: string;
  compact?: boolean;
  newBadgeDays?: number;
  now?: number;
}): ProductBadge[] {
  if (!variants?.length) return [];
  const sellable = variants.filter(isVariantSellable);
  if (sellable.length === 0) return [];

  const selected = selectedVariantId
    ? variants.find((variant) => variant.id === selectedVariantId)
    : undefined;
  const priceBasis = selected ?? sellable.reduce((cheapest, variant) =>
    Number(variant.price.amount) < Number(cheapest.price.amount) ? variant : cheapest);
  const discount = discountPercent(priceBasis.price.amount, priceBasis.compareAtPrice);

  const stock = selected
    ? (selected.stockQuantity ?? 0)
    : sellable.reduce((total, variant) => total + (variant.stockQuantity ?? 0), 0);
  const lowStock = stock > 0 && stock <= LOW_STOCK_THRESHOLD;
  const isNew = isNewProduct({ createdAt, publishedAt, now, days: newBadgeDays });
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
