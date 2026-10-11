"use client";

import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Counter from "yet-another-react-lightbox/plugins/counter";
import type { ProductImage } from "@/lib/catalog/types";
import { useRef } from "react";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/counter.css";

export default function ProductLightbox({ images, title, index, onClose }: {
  images: ProductImage[];
  title: string;
  index: number;
  onClose: (index: number) => void;
}) {
  const activeIndex = useRef(index);
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
      on={{ view: ({ index }) => { activeIndex.current = index; } }}
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
      }}
      styles={{ container: { backgroundColor: "rgba(10, 10, 10, 0.98)" } }}
    />
  );
}
