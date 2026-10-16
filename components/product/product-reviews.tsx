"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import { StarRating } from "./star-rating";
import { Button } from "@/components/ui";
import {
  CheckBadgeIcon,
  ChatBubbleLeftRightIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";

export function ProductReviews({ productId }: { productId: string }) {
  const reviewsData = useQuery(api.reviews.getByProduct, {
    productId: productId as Id<"products">,
  });
  const eligibility = useQuery(api.reviews.getProductReviewEligibility, {
    productId: productId as Id<"products">,
  });

  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsBreakdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const averageRating = reviewsData?.averageRating ?? 0;
  const reviewCount = reviewsData?.reviewCount ?? 0;
  const distribution = reviewsData?.distribution ?? { star1: 0, star2: 0, star3: 0, star4: 0, star5: 0 };
  const reviews = reviewsData?.reviews ?? [];

  const formatDate = (timestamp: number) => {
    try {
      return new Intl.DateTimeFormat("tr-TR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(timestamp));
    } catch {
      return "";
    }
  };

  return (
    <section
      id="degerlendirmeler"
      aria-label="Ürün Değerlendirmeleri"
      className="mt-16 border-t border-border pt-12 pb-20"
    >
      <div className="mx-auto max-w-4xl px-4 space-y-6">
        {/* Sol Hizalı Başlık, Yıldız Puanı ve Aksiyon */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-border/70">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Müşteri Değerlendirmeleri
            </h2>

            {reviewCount > 0 ? (
              <div
                ref={dropdownRef}
                className="relative inline-flex items-center"
                onMouseEnter={() => setIsBreakdownOpen(true)}
                onMouseLeave={() => setIsBreakdownOpen(false)}
              >
                <button
                  type="button"
                  onClick={() => setIsBreakdownOpen((prev) => !prev)}
                  aria-expanded={isBreakdownOpen}
                  aria-haspopup="dialog"
                  className="group inline-flex items-center gap-2 rounded-xl border border-border/80 bg-muted/40 hover:bg-muted px-2.5 py-1 text-xs transition-colors cursor-pointer"
                >
                  <StarRating rating={averageRating} size="sm" showText={false} />
                  <span className="font-mono font-bold text-foreground tabular-nums">
                    {averageRating.toFixed(1)}
                  </span>
                  <span className="text-muted-foreground group-hover:text-foreground">
                    ({reviewCount})
                  </span>
                  <ChevronDownIcon
                    className={`size-3 text-muted-foreground transition-transform duration-200 ${
                      isBreakdownOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* Hover / Tıklamada Açılan Yıldız Dağılım Kartı */}
                {isBreakdownOpen && (
                  <div
                    role="dialog"
                    aria-label="Puan Dağılımı Detayı"
                    className="absolute left-0 top-full z-30 mt-1.5 w-64 rounded-2xl border border-border/80 bg-popover/95 p-4 shadow-xl backdrop-blur-md animate-in fade-in-0 zoom-in-95 text-left"
                  >
                    <p className="mb-2.5 text-xs font-semibold text-foreground">Puan Dağılımı</p>
                    <div className="space-y-2">
                      {([5, 4, 3, 2, 1] as const).map((star) => {
                        const key = `star${star}` as keyof typeof distribution;
                        const count = distribution[key] ?? 0;
                        const percentage = reviewCount > 0 ? Math.round((count / reviewCount) * 100) : 0;

                        return (
                          <div key={star} className="flex items-center gap-2 text-xs">
                            <span className="w-5 font-semibold text-foreground">{star}★</span>
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-amber-400 transition-all duration-300"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <span className="w-8 text-right font-medium text-muted-foreground tabular-nums">
                              %{percentage}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">
                (Henüz değerlendirme yok)
              </span>
            )}
          </div>

          {/* Doğrulanmış Alıcı Aksiyonu */}
          {eligibility?.canReview && (
            <Button asChild size="sm" variant="outline" className="rounded-xl text-xs font-semibold shrink-0 cursor-pointer">
              <Link href={`/account/orders/${eligibility.eligibleOrderId}`}>
                <CheckBadgeIcon className="mr-1.5 size-3.5 text-emerald-500" />
                <span>{eligibility.alreadyReviewed ? "Değerlendirmemi Güncelle" : "Ürünü Değerlendir"}</span>
              </Link>
            </Button>
          )}
        </div>

        {/* Yorumlar Listesi (Genişliği max-w-2xl ile sınırlı) */}
        <div className="space-y-4">
          {reviews.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border/80 bg-muted/20 p-8 text-center sm:p-12">
              <ChatBubbleLeftRightIcon className="mx-auto size-10 text-muted-foreground/60" />
              <h3 className="mt-3 text-sm font-semibold text-foreground">
                Henüz değerlendirme yapılmamış
              </h3>
              <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                Bu ürünü satın alan müşterilerimiz henüz bir yorum paylaşmadı. İlk değerlendirmeyi ürünü satın alan müşterilerimiz Siparişlerim sayfasından yapabilir.
              </p>
            </div>
          ) : (
            reviews.map((review) => (
              <article
                key={review._id}
                className="rounded-2xl border border-border/70 bg-card p-5 space-y-2.5 transition-all hover:border-border shadow-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      {review.authorName}
                    </span>
                    {review.isVerifiedPurchase ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                        <CheckBadgeIcon className="size-3" />
                        <span>Doğrulanmış Alıcı</span>
                      </span>
                    ) : null}
                  </div>
                  <time className="text-[11px] text-muted-foreground">
                    {formatDate(review.createdAt)}
                  </time>
                </div>

                <StarRating rating={review.rating} size="sm" showText={false} />

                {review.title ? (
                  <h4 className="text-xs font-semibold text-foreground">
                    {review.title}
                  </h4>
                ) : null}

                <p className="text-xs leading-relaxed text-muted-foreground">
                  {review.content}
                </p>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
