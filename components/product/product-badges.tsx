"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { getProductBadges } from "@/lib/catalog/badges";
import type { ProductVariant } from "@/lib/catalog/types";

const labels = {
  "low-stock": "Tükeniyor",
  bestseller: "Çok Satan",
  new: "Yeni",
} as const;

export function ProductBadges({
  variants,
  _creationTime,
  soldCount,
  selectedVariantId,
  compact = false,
  size = "sm",
}: {
  variants?: ProductVariant[];
  _creationTime?: number;
  soldCount?: number;
  selectedVariantId?: string;
  compact?: boolean;
  size?: "sm" | "md";
}) {
  const [now, setNow] = useState<number>();
  const settings = useQuery(api.settings.getBadgeSettings, {});
  useEffect(() => {
    const timer = window.setTimeout(() => setNow(Date.now()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const badges = getProductBadges({ variants, _creationTime, soldCount, selectedVariantId, compact, newBadgeDays: settings?.newBadgeDays, lowStockThreshold: settings?.lowStockThreshold, now });
  if (badges.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {badges.map((badge) => (
        <span
          key={badge.kind}
          className={clsx(
            "inline-flex items-center rounded-md border font-semibold leading-none",
            size === "md" ? "px-2 py-1 text-xs" : "px-1.5 py-0.5 text-[10px]",
            badge.kind === "discount"
              ? "border-transparent bg-foreground text-background"
              : badge.kind === "low-stock"
                ? "border-amber-300 bg-background/90 text-amber-700 backdrop-blur dark:border-amber-700 dark:text-amber-400"
                : "border-border bg-background/90 text-foreground backdrop-blur",
          )}
        >
          {badge.kind === "discount" ? `-%${badge.percent}` : labels[badge.kind]}
        </span>
      ))}
    </div>
  );
}
