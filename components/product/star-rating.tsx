"use client";

import { useState } from "react";
import { StarIcon as StarSolid } from "@heroicons/react/24/solid";
import { StarIcon as StarOutline } from "@heroicons/react/24/outline";

export function StarRating({
  rating,
  maxRating = 5,
  size = "md",
  reviewCount,
  showText = true,
  interactive = false,
  onRate,
}: {
  rating: number;
  maxRating?: number;
  size?: "xs" | "sm" | "md" | "lg";
  reviewCount?: number;
  showText?: boolean;
  interactive?: boolean;
  onRate?: (rating: number) => void;
}) {
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  const activeRating = hoverRating !== null ? hoverRating : rating;

  const sizeClasses = {
    xs: "size-3",
    sm: "size-3.5",
    md: "size-4",
    lg: "size-6",
  }[size];

  const textClasses = {
    xs: "text-[11px]",
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base font-semibold",
  }[size];

  return (
    <div className="inline-flex items-center gap-1.5">
      <div
        className="flex items-center gap-0.5"
        role={interactive ? "group" : "img"}
        aria-label={`Puan: ${rating} / ${maxRating}${reviewCount ? `, ${reviewCount} değerlendirme` : ""}`}
      >
        {Array.from({ length: maxRating }, (_, index) => {
          const starValue = index + 1;
          const isFilled = activeRating >= starValue;
          const isHalf = !isFilled && activeRating >= starValue - 0.5;

          const starIcon = isFilled ? (
            <StarSolid className={`${sizeClasses} text-amber-600 dark:text-amber-400`} />
          ) : isHalf ? (
            <span className="relative inline-block">
              <StarOutline className={`${sizeClasses} text-neutral-500 dark:text-neutral-400`} />
              <span className="absolute inset-0 overflow-hidden w-1/2">
                <StarSolid className={`${sizeClasses} text-amber-600 dark:text-amber-400`} />
              </span>
            </span>
          ) : (
            <StarOutline className={`${sizeClasses} text-neutral-500 dark:text-neutral-400`} />
          );

          if (!interactive) {
            return (
              <span key={index} className="relative inline-flex items-center" aria-hidden="true">
                {starIcon}
              </span>
            );
          }

          return (
            <button
              key={index}
              type="button"
              onClick={() => onRate?.(starValue)}
              onMouseEnter={() => setHoverRating(starValue)}
              onMouseLeave={() => setHoverRating(null)}
              className="relative transition-transform cursor-pointer hover:scale-115 active:scale-95"
              aria-label={`${starValue} Yıldız`}
            >
              {starIcon}
            </button>
          );
        })}
      </div>

      {showText && (
        <span className={`${textClasses} font-medium text-foreground`}>
          {rating > 0 ? rating.toFixed(1) : "Puanlanmamış"}
          {reviewCount !== undefined && reviewCount > 0 ? (
            <span className="ml-1 text-muted-foreground font-normal">
              ({reviewCount})
            </span>
          ) : null}
        </span>
      )}
    </div>
  );
}
