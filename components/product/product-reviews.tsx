"use client";

import { routes } from "@/lib/storefront-routes";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import { StarRating } from "./star-rating";
import { Button } from "@/components/ui/button";
import {
  CheckBadgeIcon,
  ChatBubbleLeftRightIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";

function formatDate(timestamp: number) {
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(timestamp));
  } catch {
    return "";
  }
}

export function ProductReviews({ productId }: { productId: string }) {
  const sectionRef = useRef<HTMLElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setShouldLoad(true);
      observer.disconnect();
    }, { rootMargin: "600px" });
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  const reviewsData = useQuery(api.reviews.getByProduct, shouldLoad
    ? {
        productId: productId as Id<"products">,
        limit: showAll ? 100 : 3,
      }
    : "skip");
  const eligibility = useQuery(api.reviews.getProductReviewEligibility, shouldLoad
    ? { productId: productId as Id<"products"> }
    : "skip");
  const averageRating = reviewsData?.averageRating ?? 0;
  const reviewCount = reviewsData?.reviewCount ?? 0;
  const commentCount = reviewsData?.commentCount ?? 0;
  const reviews = reviewsData?.reviews ?? [];
  const previewReviews = showAll ? reviews : reviews.slice(0, 3);

  return (
    <section
      ref={sectionRef}
      id="degerlendirmeler"
      aria-label="Ürün Değerlendirmeleri"
      aria-busy={!reviewsData}
      className="mt-16 border-t border-border/70 pt-10 pb-16"
    >
      <div className="w-full">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Ürün Değerlendirmeleri
          </h2>
          {eligibility?.canReview && eligibility.eligibleOrderId ? (
            <Button asChild size="sm" variant="outline" className="shrink-0 cursor-pointer rounded-xl text-xs font-semibold">
              <Link href={routes.accountOrder(eligibility.eligibleOrderId)}>
                <CheckBadgeIcon className="mr-1.5 size-3.5 text-emerald-700 dark:text-emerald-400" />
                {eligibility.alreadyReviewed ? "Değerlendirmemi Güncelle" : "Ürünü Değerlendir"}
              </Link>
            </Button>
          ) : null}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Değerlendirmeler yalnızca teslim edilmiş sipariş sahipleri tarafından yapılabilir; doğrulanmamış yorum yayınlanmaz.
        </p>

        {!reviewsData ? null : reviewCount === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-border/80 bg-muted/20 p-10 text-center">
            <ChatBubbleLeftRightIcon className="mx-auto size-9 text-muted-foreground/60" aria-hidden="true" />
            <h3 className="mt-3 text-sm font-semibold text-foreground">
              Henüz değerlendirme yapılmamış
            </h3>
            <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
              Bu ürünü satın alan müşterilerimiz henüz bir yorum paylaşmadı.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
              <StarRating rating={averageRating} size="md" showText={false} />
              <span className="text-lg font-bold tabular-nums text-foreground">
                {averageRating.toFixed(1)}
              </span>
              {reviews.length > 3 ? (
                <button
                  type="button"
                  onClick={() => setShowAll((current) => !current)}
                  aria-expanded={showAll}
                  aria-label={showAll ? "Yorumları gizle" : "Yorumları göster"}
                  className="grid size-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <ChevronDownIcon className={`size-4 transition-transform ${showAll ? "rotate-180" : ""}`} />
                </button>
              ) : null}
              <span className="text-xs text-muted-foreground">{reviewCount} Değerlendirme</span>
              <span className="size-1 rounded-full bg-border" aria-hidden="true" />
              <span className="text-xs text-muted-foreground">{commentCount} Yorum</span>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {previewReviews.map((review) => (
                <article
                  key={review._id}
                  className="flex h-full flex-col rounded-2xl border border-border/70 bg-card p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <StarRating rating={review.rating} size="xs" showText={false} />
                    <time className="text-[10px] text-muted-foreground">
                      {formatDate(review._creationTime)}
                    </time>
                  </div>

                  <div className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-foreground">
                    <span>{review.authorName}</span>
                    {review.isVerifiedPurchase ? (
                      <span role="img" aria-label="Doğrulanmış Alıcı">
                        <CheckBadgeIcon className="size-3.5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                      </span>
                    ) : null}
                  </div>

                  {review.title ? (
                    <h3 className="mt-2 text-xs font-semibold text-foreground">
                      {review.title}
                    </h3>
                  ) : null}
                  <p className="mt-1.5 line-clamp-5 text-xs leading-5 text-muted-foreground">
                    {review.content}
                  </p>
                </article>
              ))}
            </div>

            {reviews.length > 3 ? (
              <div className="mt-5 flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAll((current) => !current)}
                  aria-expanded={showAll}
                  className="h-10 cursor-pointer rounded-full border-border px-6 text-[11px] font-semibold uppercase tracking-wider"
                >
                  {showAll ? "Yorumları Gizle" : "Yorumları Göster"}
                  <ChevronDownIcon className={`ml-1.5 size-3.5 transition-transform ${showAll ? "rotate-180" : ""}`} />
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
