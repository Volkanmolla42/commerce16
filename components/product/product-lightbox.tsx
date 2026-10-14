"use client";

import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Counter from "yet-another-react-lightbox/plugins/counter";
import type { ProductImage } from "@/lib/catalog/types";
import { useRef, useState } from "react";
import { CheckIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/counter.css";

export default function ProductLightbox({
  images,
  title,
  index,
  searchParams,
  onSelectVariant,
  onClose,
}: {
  images: ProductImage[];
  title: string;
  index: number;
  searchParams?: Pick<URLSearchParams, "get">;
  onSelectVariant?: (options: { name: string; value: string }[]) => void;
  onClose: (index: number) => void;
}) {
  const activeIndex = useRef(index);
  const [currentIndex, setCurrentIndex] = useState(index);

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
          const currentImage = images[currentIndex];
          const imageOptions = currentImage?.selectedOptions ?? [];
          if (imageOptions.length === 0) return null;

          const isAlreadySelected = searchParams
            ? imageOptions.every(
                (opt) =>
                  searchParams.get(opt.name.toLocaleLowerCase("tr-TR")) ===
                  opt.value,
              )
            : false;

          const optionLabel = imageOptions.map((o) => o.value).join(" / ");

          return (
            <div className="absolute inset-x-0 bottom-6 z-50 flex justify-center pointer-events-none px-4">
              <div className="pointer-events-auto">
                {isAlreadySelected ? (
                  <button
                    type="button"
                    onClick={() => onClose(currentIndex)}
                    aria-label={`Bu varyant seçili (${optionLabel}), incelemeyi kapat`}
                    className="flex h-11 items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-950/80 px-5 text-sm font-semibold text-emerald-200 backdrop-blur-md shadow-2xl transition hover:bg-emerald-900/90 active:scale-95"
                  >
                    <CheckIcon className="size-4 text-emerald-400 shrink-0" />
                    <span>Bu varyant seçili ({optionLabel})</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectVariant?.(imageOptions);
                    }}
                    aria-label={`Bu varyantı seç (${optionLabel})`}
                    className="flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-neutral-900 shadow-2xl transition hover:bg-neutral-100 active:scale-95"
                  >
                    <CheckCircleIcon className="size-4 text-neutral-900 shrink-0" />
                    <span>Bu varyantı seç ({optionLabel})</span>
                  </button>
                )}
              </div>
            </div>
          );
        },
      }}
      styles={{ container: { backgroundColor: "rgba(10, 10, 10, 0.98)" } }}
    />
  );
}
