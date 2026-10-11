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
import { useRouter, useSearchParams } from "next/navigation";
import type { Product } from "@/lib/catalog/types";
import {
  getProductImages,
  getProductImagesForSelection,
} from "@/lib/catalog/product-images";
import { getSelectedVariant } from "@/lib/catalog/variants";
import { ProductImageTransition } from "./product-image-transition";

const ProductLightbox = dynamic(() => import("./product-lightbox"), {
  ssr: false,
});

export function Gallery({ product }: { product: Product }) {
  const router = useRouter();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const selection =
    product.options?.flatMap((option) => {
      const value = searchParams.get(option.name.toLocaleLowerCase("tr-TR"));
      return value ? [{ name: option.name, value }] : [];
    }) ?? [];
  const matchingImages = getProductImagesForSelection(
    product.images,
    selection,
  );
  const images =
    matchingImages.length || getSelectedVariant(product, searchParams)
      ? matchingImages
      : getProductImages(product);
  const requestedIndex = Number(searchParams.get("image") ?? 0);
  const imageIndex =
    Number.isInteger(requestedIndex) &&
    requestedIndex >= 0 &&
    requestedIndex < images.length
      ? requestedIndex
      : 0;
  const activeImage = images[imageIndex];

  const updateImage = (index: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("image", index.toString());
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const nextImageIndex = imageIndex + 1 < images.length ? imageIndex + 1 : 0;
  const previousImageIndex =
    imageIndex === 0 ? images.length - 1 : imageIndex - 1;

  return (
    <div className="min-w-0">
      <div
        className={`${productGalleryClassName} bg-neutral-100 dark:bg-neutral-900`}
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
                sizes="(min-width: 1400px) 720px, (min-width: 1024px) 55vw, calc(100vw - 2rem)"
                alt={product.title}
                src={activeImage.url}
                onError={() => setFailedImage(activeImage.url)}
                loading="eager"
                fetchPriority="high"
              />
            </ProductImageTransition>
            <span className="absolute bottom-3 right-3 flex min-h-10 items-center gap-2 rounded-full bg-white/95 px-3 text-xs font-medium text-neutral-900 shadow-sm">
              <ArrowsPointingOutIcon className="size-4" aria-hidden="true" />
              Büyüt
            </span>
          </button>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
            <PhotoIcon className="size-10" aria-hidden="true" />
            <p className="text-sm">Ürün görseli hazırlanıyor</p>
          </div>
        )}

        {images.length > 1 ? (
          <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-neutral-900">
            {imageIndex + 1} / {images.length}
          </span>
        ) : null}

        {images.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() => updateImage(previousImageIndex)}
              aria-label="Önceki ürün görseli"
              className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-200 bg-white/95 text-neutral-800 shadow-lg backdrop-blur-sm transition-[color,background-color,border-color,transform] duration-150 hover:bg-white active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neutral-900 dark:border-neutral-700 dark:bg-neutral-900/95 dark:text-white dark:hover:bg-neutral-800 dark:focus-visible:outline-white"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => updateImage(nextImageIndex)}
              aria-label="Sonraki ürün görseli"
              className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-200 bg-white/95 text-neutral-800 shadow-lg backdrop-blur-sm transition-[color,background-color,border-color,transform] duration-150 hover:bg-white active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neutral-900 dark:border-neutral-700 dark:bg-neutral-900/95 dark:text-white dark:hover:bg-neutral-800 dark:focus-visible:outline-white"
            >
              <ArrowRightIcon className="h-5 w-5" />
            </button>
          </>
        ) : null}
      </div>

      {images.length > 1 ? (
        <ul
          aria-label="Diğer ürün görselleri"
          className="no-scrollbar mt-3 flex max-w-full items-center gap-2 overflow-x-auto px-1 py-2"
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
          title={product.title}
          index={imageIndex}
          onClose={(index) => {
            setLightboxOpen(false);
            if (index !== imageIndex) updateImage(index);
          }}
        />
      ) : null}
    </div>
  );
}
