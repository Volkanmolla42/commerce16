"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatMoney } from "@/lib/format-money";
import { TruckIcon, CheckCircleIcon, SparklesIcon } from "@heroicons/react/24/outline";

export function FreeShippingBar({
  totalAmount,
  freeShipping = false,
  className = "",
}: {
  totalAmount: number;
  freeShipping?: boolean;
  className?: string;
}) {
  const settings = useQuery(api.settings.getStoreSettings, {});
  const threshold = settings?.freeShippingThreshold ?? 0;

  // Barem kapalıysa (0 veya negatif) gösterilmez
  if (threshold <= 0) {
    return null;
  }

  const isFree = freeShipping || totalAmount >= threshold;
  const remaining = Math.max(0, threshold - totalAmount);
  const progress = isFree ? 100 : Math.min(100, Math.max(0, Math.round((totalAmount / threshold) * 100)));

  return (
    <div
      className={`rounded-2xl border p-4 transition-all duration-300 ${
        isFree
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-950 dark:text-emerald-200"
          : "border-primary/20 bg-primary/5 text-foreground"
      } ${className}`}
      role="region"
      aria-label="Kargo Ücreti Durumu"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 font-medium">
          {isFree ? (
            <>
              <CheckCircleIcon className="size-5 shrink-0 text-emerald-500" />
              <span>
                <strong>Tebrikler!</strong> Siparişiniz için <strong>kargo ücretsiz</strong>!
              </span>
            </>
          ) : (
            <>
              <TruckIcon className="size-5 shrink-0 text-primary" />
              <span>
                Ücretsiz kargo için sepetinize{" "}
                <strong className="text-primary font-bold">{formatMoney(remaining)}</strong> daha ekleyin!
              </span>
            </>
          )}
        </div>

        {!isFree ? (
          <Link
            href="/search"
            className="text-[11px] font-semibold text-primary underline underline-offset-4 hover:opacity-80 transition-opacity"
          >
            Ürün Ekle ➔
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            <SparklesIcon className="size-3.5" />
            <span>Kargo Bedava</span>
          </span>
        )}
      </div>

      {/* İlerleme Çubuğu */}
      <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-neutral-200/80 dark:bg-neutral-800">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${
            isFree ? "bg-emerald-500" : "bg-primary"
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
