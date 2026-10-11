import {
  productPageClassName,
  productGridClassName,
  productDetailsClassName,
  productGalleryClassName,
  productPurchaseBarClassName,
} from "./product-layout";
import { Suspense } from "react";
import { ProductImagePreview } from "./product-image-transition";

export function ProductGallerySkeleton() {
  return (
    <div
      aria-hidden="true"
      className={`${productGalleryClassName} bg-muted motion-safe:animate-pulse [&:has(img)]:animate-none`}
    >
      <Suspense fallback={null}>
        <ProductImagePreview />
      </Suspense>
    </div>
  );
}

export function ProductDescriptionSkeleton() {
  return (
    <div
      role="status"
      aria-label="Ürün bilgileri yükleniyor"
      aria-busy="true"
      className="mx-auto w-full max-w-[560px]"
    >
      <div aria-hidden="true" className="motion-safe:animate-pulse">
        <div className="border-b border-border pb-5">
          <div className="flex items-start justify-between gap-5">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-7 w-full rounded bg-muted sm:h-9 xl:h-10" />
              <div className="h-7 w-3/4 rounded bg-muted sm:h-9 xl:h-10" />
            </div>
            <div className="mt-1 size-10 shrink-0 rounded-full bg-muted" />
          </div>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-8 w-28 rounded bg-muted" />
            <div className="h-3 w-12 rounded bg-muted" />
          </div>
        </div>
        <div className="pt-5">
          {[0, 1].map((group) => (
            <div key={group} className="mb-5">
              <div className="mb-3 h-5 w-20 rounded bg-muted" />
              <div className="flex gap-2">
                {[0, 1, 2].map((option) => (
                  <div key={option} className="h-12 w-14 rounded-xl bg-muted" />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div data-product-purchase-bar className={productPurchaseBarClassName}>
          <div className="h-5 w-20 shrink-0 rounded bg-muted md:hidden" />
          <div className="h-12 min-w-0 flex-1 rounded-xl bg-muted" />
        </div>
        <div className="mt-6 border-y border-border py-4">
          <div className="flex min-h-11 items-center justify-between">
            <div className="h-4 w-32 rounded bg-muted" />
            <div className="size-4 rounded bg-muted" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProductSkeleton() {
  return (
    <div className={productPageClassName}>
      <div className={productGridClassName}>
        <div className="min-w-0">
          <ProductGallerySkeleton />
        </div>
        <div className={productDetailsClassName}>
          <ProductDescriptionSkeleton />
        </div>
      </div>
    </div>
  );
}
