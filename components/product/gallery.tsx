"use client";

import { productGalleryClassName } from "./product-layout";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowsPointingOutIcon,
  PhotoIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import type { Product, ProductVariant } from "@/lib/catalog/types";
import { getSelectedVariant, getVariantForImage, hasVariantOptionCombination } from "@/lib/catalog/variants";
import { ProductImageTransition } from "./product-image-transition";
import { ProductBadges } from "./product-badges";

const ProductLightbox = dynamic(() => import("./product-lightbox"), {
  ssr: false,
});

export function Gallery({ product, defaultVariant }: { product: Product; defaultVariant?: ProductVariant }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const images = product.images ?? [];
  const selectedVariant = getSelectedVariant(product, searchParams) ?? defaultVariant;
  const selectedVariantImageIndex = selectedVariant
    ? images.findIndex((image) =>
        Boolean(image.selectedOptions?.length) &&
        image.selectedOptions!.every((option) =>
          selectedVariant.selectedOptions.some((selected) =>
            selected.name === option.name && selected.value === option.value)))
    : -1;

  const requestedIndex = Number(searchParams.get("image"));
  const hasExplicitImage = searchParams.has("image") &&
    Number.isInteger(requestedIndex) &&
    requestedIndex >= 0 &&
    requestedIndex < images.length;
  const imageIndex = hasExplicitImage ? requestedIndex : Math.max(0, selectedVariantImageIndex);
  const activeImage = images[imageIndex];

  const updateImage = (index: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("image", index.toString());
    const imageVariant = getVariantForImage(product, images[index]);
    if (imageVariant) {
      for (const option of imageVariant.selectedOptions) {
        params.set(option.name.toLocaleLowerCase("tr-TR"), option.value);
      }
    }
    window.history.replaceState(null, "", `?${params.toString()}`);
  };

  const handleSelectVariantFromLightbox = (
    optionsToSelect: { name: string; value: string }[],
  ) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const opt of optionsToSelect) {
      const key = opt.name.toLocaleLowerCase("tr-TR");
      params.set(key, opt.value);
    }
    if (product.options && product.variants) {
      for (const option of product.options) {
        const optionKey = option.name.toLocaleLowerCase("tr-TR");
        const selected = params.get(optionKey);
        if (
          selected &&
          !hasVariantOptionCombination(
            { options: product.options, variants: product.variants },
            params,
            option.name,
            selected,
          )
        ) {
          params.delete(optionKey);
        }
      }
    }
    params.delete("image");
    window.history.replaceState(null, "", `?${params.toString()}`);
  };

  const nextImageIndex = imageIndex + 1 < images.length ? imageIndex + 1 : 0;
  const previousImageIndex =
    imageIndex === 0 ? images.length - 1 : imageIndex - 1;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div
        className={`${productGalleryClassName} order-1 bg-neutral-100 dark:bg-neutral-900`}
      >
        {activeImage && failedImage !== activeImage.url ? (
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            aria-label="Ürün görselini tam ekran aç"
            className="group absolute inset-0 cursor-zoom-in focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-primary"
          >
            <ProductImageTransition productId={product.id}>
              <Image
                data-product-gallery-image
                className="h-full w-full object-contain"
                fill
                sizes="(min-width: 1400px) 600px, (min-width: 1024px) 45vw, calc(100vw - 2rem)"
                alt={product.title}
                src={activeImage.url}
                onError={() => setFailedImage(activeImage.url)}
                loading="eager"
                fetchPriority="high"
              />
            </ProductImageTransition>
            <span className="absolute bottom-2 right-2 flex size-9 items-center justify-center rounded-full bg-white/90 text-neutral-900 shadow-sm sm:w-auto sm:gap-1.5 sm:px-3">
              <ArrowsPointingOutIcon className="size-4" aria-hidden="true" />
              <span className="hidden text-xs font-medium sm:inline">Büyüt</span>
            </span>
          </button>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
            <PhotoIcon className="size-10" aria-hidden="true" />
            <p className="text-sm">Ürün görseli hazırlanıyor</p>
          </div>
        )}

        {images.length > 1 ? (
          <span className="absolute right-2 top-2 z-10 rounded-full bg-white/85 px-2 py-1 text-[11px] font-medium text-neutral-900">
            {imageIndex + 1} / {images.length}
          </span>
        ) : null}

        <div className="pointer-events-none absolute left-2 top-2 z-10">
          <ProductBadges
            variants={product.variants}
            createdAt={product.createdAt}
            publishedAt={product.publishedAt}
            soldCount={product.soldCount}
            selectedVariantId={selectedVariant?.id}
            size="md"
          />
        </div>

        {images.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() => updateImage(previousImageIndex)}
              aria-label="Önceki ürün görseli"
              className="absolute left-2 top-1/2 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-200/70 bg-white/90 text-neutral-800 shadow-sm transition-[color,background-color,border-color,transform] duration-150 hover:bg-white active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neutral-900 dark:border-neutral-700/70 dark:bg-neutral-900/90 dark:text-white dark:hover:bg-neutral-800 dark:focus-visible:outline-white"
            >
              <ArrowLeftIcon className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => updateImage(nextImageIndex)}
              aria-label="Sonraki ürün görseli"
              className="absolute right-2 top-1/2 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-200/70 bg-white/90 text-neutral-800 shadow-sm transition-[color,background-color,border-color,transform] duration-150 hover:bg-white active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neutral-900 dark:border-neutral-700/70 dark:bg-neutral-900/90 dark:text-white dark:hover:bg-neutral-800 dark:focus-visible:outline-white"
            >
              <ArrowRightIcon className="size-4" />
            </button>
          </>
        ) : null}
      </div>

      {images.length > 1 ? (
        <ul
          aria-label="Diğer ürün görselleri"
          className="no-scrollbar order-2 flex max-w-full items-center gap-2 overflow-x-auto px-1 py-1"
        >
          {images.map((image, index) => {
            const isActive = index === imageIndex;

            return (
              <li
                key={`${image.url}:${index}`}
                className="size-16 shrink-0 sm:size-20"
              >
                <button
                  type="button"
                  onClick={() => updateImage(index)}
                  aria-label={`Ürün görseli ${index + 1} seç`}
                  aria-pressed={isActive}
                  className={`h-full w-full rounded-xl p-0.5 transition-[border-color,box-shadow,transform] duration-150 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neutral-900 dark:focus-visible:outline-white ${
                    isActive
                      ? "ring-2 ring-neutral-900 ring-offset-2 ring-offset-white dark:ring-white dark:ring-offset-black"
                      : ""
                  }`}
                >
                  <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-black">
                    <Image
                      className="h-full w-full object-contain"
                      alt={product.title}
                      src={image.url}
                      width={80}
                      height={80}
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
          index={imageIndex}
          onSelectVariant={handleSelectVariantFromLightbox}
          onClose={(index) => {
            setLightboxOpen(false);
            if (index !== imageIndex) updateImage(index);
          }}
        />
      ) : null}
    </div>
  );
}
