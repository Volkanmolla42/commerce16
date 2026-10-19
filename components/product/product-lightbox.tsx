"use client";

import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Counter from "yet-another-react-lightbox/plugins/counter";
import type { Product, ProductImage } from "@/lib/catalog/types";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BoltIcon, ShoppingBagIcon } from "@heroicons/react/24/outline";
import { useCart } from "@/components/cart/cart-context";
import { setQuickBuyItem } from "@/components/cart/quick-buy-store";
import {
  getVariantForImage,
  getVariantProduct,
  isVariantSellable,
} from "@/lib/catalog/variants";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/counter.css";

export default function ProductLightbox({
  images,
  product,
  title,
  index,
  onClose,
}: {
  images: ProductImage[];
  product: Product;
  title: string;
  index: number;
  onClose: (index: number) => void;
}) {
  const activeIndex = useRef(index);
  const [currentIndex, setCurrentIndex] = useState(index);
  const router = useRouter();
  const { addItem } = useCart();

  return (
    <Lightbox
      open
      close={() => onClose(activeIndex.current)}
      index={index}
      slides={images.map((image) => ({ src: image.url, alt: title }))}
      plugins={[Zoom, Counter]}
      zoom={{ scrollToZoom: true, maxZoomPixelRatio: 3 }}
      carousel={{ finite: images.length === 1, preload: 1, padding: 16 }}
      controller={{ closeOnBackdropClick: true, aria: true }}
      on={{
        view: ({ index }) => {
          activeIndex.current = index;
          setCurrentIndex(index);
        },
      }}
      labels={{
        Close: "Görseli kapat",
        Next: "Sonraki görsel",
        Previous: "Önceki görsel",
        "Zoom in": "Yakınlaştır",
        "Zoom out": "Uzaklaştır",
        Lightbox: "Ürün görselleri",
        "Photo gallery": "Ürün görselleri",
        Slide: "Görsel",
        Carousel: "Galeri",
        "{index} of {total}": "{index} / {total}",
      }}
      render={{
        iconError: () => <span className="text-sm text-neutral-300">Görsel yüklenemedi</span>,
        buttonPrev: images.length === 1 ? () => null : undefined,
        buttonNext: images.length === 1 ? () => null : undefined,
        controls: () => {
          const variant = getVariantForImage(product, images[currentIndex]);
          if (!variant) return null;

          const available = isVariantSellable(variant);
          const variantLabel = variant.selectedOptions.map(({ value }) => value).join(" / ") || variant.title;
          const selectedProduct = getVariantProduct(product, variant);

          const addToCart = () => {
            if (!available) return;
            addItem(selectedProduct, 1, variant.id);
            onClose(currentIndex);
          };

          const quickBuy = () => {
            if (!available) return;
            setQuickBuyItem({ product: selectedProduct, quantity: 1, variantId: variant.id });
            router.push("/checkout?mode=quick-buy");
          };

          return (
            <div className="pointer-events-none absolute inset-x-0 bottom-4 z-50 flex justify-center px-4 sm:bottom-6">
              <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-white/15 bg-neutral-950/90 p-3 shadow-2xl backdrop-blur-md">
                <p className="truncate text-center text-xs text-neutral-400">
                  Varyant: <span className="font-semibold text-white">{variantLabel}</span>
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={addToCart}
                    disabled={!available}
                    className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-white text-sm font-semibold text-neutral-900 transition hover:bg-neutral-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ShoppingBagIcon className="size-4 shrink-0" aria-hidden="true" />
                    Sepete Ekle
                  </button>
                  <button
                    type="button"
                    onClick={quickBuy}
                    disabled={!available}
                    className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-white/25 bg-white/10 text-sm font-semibold text-white transition hover:bg-white/15 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <BoltIcon className="size-4 shrink-0" aria-hidden="true" />
                    Hızlı Satın Al
                  </button>
                </div>
              </div>
            </div>
          );
        },
      }}
      styles={{ container: { backgroundColor: "rgba(10, 10, 10, 0.98)" } }}
    />
  );
}
