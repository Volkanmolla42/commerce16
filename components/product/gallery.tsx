"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowsPointingOutIcon,
  PhotoIcon,
} from "@heroicons/react/24/outline";
import { ProductBadges } from "./product-badges";
import { productGalleryClassName } from "./product-layout";
import { cn } from "@/lib/utils";
import { getSelectedVariant, getVariantForImage, optionQueryKey } from "@/lib/catalog/variants";
import type { Product, ProductVariant } from "@/lib/catalog/types";

const ProductLightbox = dynamic(() => import("./product-lightbox"), { ssr: false });

interface GalleryProps {
  product: Product;
  defaultVariant?: ProductVariant;
  selectedVariant?: ProductVariant;
  onSelectVariant?: (variant: ProductVariant) => void;
  sizes?: string;
}

export function Gallery({
  product,
  defaultVariant,
  selectedVariant,
  onSelectVariant,
  sizes,
}: GalleryProps) {
  const searchParams = useSearchParams();
  const images = product.images ?? [];
  const activeVariantFromUrl = getSelectedVariant(product, searchParams) ?? defaultVariant;
  const currentVariant = selectedVariant ?? activeVariantFromUrl;

  const findVariantIndex = (variant?: ProductVariant) => {
    if (!variant) return 0;
    const index = images.findIndex((img) =>
      img.selectedOptions?.length &&
      img.selectedOptions.every((opt) =>
        variant.selectedOptions.some((sel) => sel.name === opt.name && sel.value === opt.value)
      )
    );
    return index >= 0 ? index : 0;
  };

  const [activeIndex, setActiveIndex] = useState(() => findVariantIndex(currentVariant));
  const [prevVariantId, setPrevVariantId] = useState(currentVariant?.id);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [zoomActive, setZoomActive] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    setZoomPos({ x, y });
  };

  const activeImage = images[activeIndex];

  // Varyant dışarıdan değiştiğinde görseli güncelle
  if (currentVariant?.id !== prevVariantId) {
    setPrevVariantId(currentVariant?.id);
    setActiveIndex(findVariantIndex(currentVariant));
  }

  const handleSelect = (newIndex: number) => {
    setActiveIndex(newIndex);
    const matched = getVariantForImage(product, images[newIndex]);
    if (matched) {
      const params = new URLSearchParams(window.location.search);
      matched.selectedOptions.forEach((opt) => params.set(optionQueryKey(opt.name), opt.value));
      window.history.replaceState(null, "", `?${params.toString()}`);
      onSelectVariant?.(matched);
    }
  };

  if (images.length === 0) {
    return (
      <div className={`${productGalleryClassName} flex items-center justify-center bg-muted text-muted-foreground`}>
        <PhotoIcon className="size-10" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Ana Görsel ve Sağdaki Zoom Paneli */}
      <div className={`relative ${zoomActive ? "z-40" : ""}`}>
        <div className={`${productGalleryClassName} relative bg-neutral-100 dark:bg-neutral-900`}>
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            onMouseEnter={() => setZoomActive(true)}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setZoomActive(false)}
            className="group absolute inset-0 cursor-zoom-in"
            aria-label="Görseli büyüt"
          >
            {images.map((image, index) => (
              <Image
                key={image.url}
                data-product-gallery-image={index === activeIndex ? "" : undefined}
                src={image.url}
                alt={index === activeIndex ? product.title : ""}
                fill
                sizes={sizes ?? "(min-width: 1024px) 540px, (min-width: 768px) 50vw, 100vw"}
                className={cn(
                  "object-contain transition-opacity duration-200 ease-out",
                  index === activeIndex
                    ? "opacity-100 z-10"
                    : "opacity-0 pointer-events-none z-0"
                )}
                preload={index === 0}
                loading={index === 0 ? undefined : "eager"}
              />
            ))}

            {/* Büyüteç Lensi */}
            {zoomActive ? (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute hidden h-32 w-28 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-neutral-900/25 bg-neutral-900/10 shadow-xs backdrop-blur-[1px] dark:border-white/30 dark:bg-white/10 lg:block"
                style={{
                  left: `${zoomPos.x}%`,
                  top: `${zoomPos.y}%`,
                }}
              />
            ) : null}

            <span className="absolute bottom-2 right-2 flex size-9 items-center justify-center rounded-full bg-white/90 text-neutral-900 shadow-sm sm:w-auto sm:gap-1.5 sm:px-3">
              <ArrowsPointingOutIcon className="size-4" />
              <span className="hidden text-xs font-medium sm:inline">Büyüt</span>
            </span>
          </button>

        {images.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() => handleSelect((activeIndex - 1 + images.length) % images.length)}
              className="absolute left-2 top-1/2 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-sm hover:bg-white"
              aria-label="Önceki görsel"
            >
              <ArrowLeftIcon className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => handleSelect((activeIndex + 1) % images.length)}
              className="absolute right-2 top-1/2 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-sm hover:bg-white"
              aria-label="Sonraki görsel"
            >
              <ArrowRightIcon className="size-4" />
            </button>
            <span className="absolute right-2 top-2 z-10 rounded-full bg-white/85 px-2 py-1 text-[11px] font-medium text-neutral-900">
              {activeIndex + 1} / {images.length}
            </span>
          </>
        ) : null}

        <div className="pointer-events-none absolute left-2 top-2 z-10">
          <ProductBadges
            variants={product.variants}
            _creationTime={product._creationTime}
            soldCount={product.soldCount}
            selectedVariantId={currentVariant?.id}
            size="md"
          />
        </div>
      </div>

      {/* Sağda Gözüken Zoom Paneli (Trendyol Style) */}
      {zoomActive ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-[calc(100%+16px)] top-0 z-50 hidden aspect-[4/5] h-full overflow-hidden rounded-2xl border border-border bg-card shadow-2xl lg:block"
        >
          <div className="relative h-full w-full bg-neutral-100 dark:bg-neutral-900">
            <Image
              src={activeImage.url}
              alt={product.title}
              fill
              sizes="1200px"
              className="object-contain"
              style={{
                transform: "scale(2.5)",
                transformOrigin: `${zoomPos.x}% ${zoomPos.y}%`,
              }}
            />
          </div>
        </div>
      ) : null}
    </div>

      {/* Küçük Önizlemeler (Thumbnails) */}
      {images.length > 1 ? (
        <ul aria-label="Diğer ürün görselleri" className="no-scrollbar flex max-w-full items-center gap-2 overflow-x-auto px-1 py-1">
          {images.map((image, index) => {
            const isActive = index === activeIndex;
            return (
              <li key={image.url} className="size-16 shrink-0 sm:size-20">
                <button
                  type="button"
                  onClick={() => handleSelect(index)}
                  className={`h-full w-full rounded-xl p-0.5 transition ${
                    isActive
                      ? "ring-2 ring-neutral-900 dark:ring-white"
                      : "opacity-70 hover:opacity-100"
                  }`}
                  aria-label={`Görsel ${index + 1}`}
                >
                  <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-lg border bg-white dark:bg-black">
                    <Image
                      src={image.url}
                      alt=""
                      width={80}
                      height={80}
                      className="h-full w-full object-contain"
                    />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {lightboxOpen ? (
        <ProductLightbox
          images={images}
          product={product}
          title={product.title}
          index={activeIndex}
          onClose={(index) => {
            setActiveIndex(index);
            setLightboxOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
