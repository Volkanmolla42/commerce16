"use client";

import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Counter from "yet-another-react-lightbox/plugins/counter";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/counter.css";

export default function DescriptionImageLightbox({
  images,
  index,
  onClose,
}: {
  images: { url: string }[];
  index: number;
  onClose: () => void;
}) {
  return (
    <Lightbox
      open
      close={onClose}
      index={index}
      slides={images.map((image) => ({ src: image.url }))}
      plugins={[Zoom, Counter]}
      zoom={{ scrollToZoom: true, maxZoomPixelRatio: 3 }}
      carousel={{ finite: images.length === 1, preload: 1, padding: 16 }}
      controller={{ closeOnBackdropClick: true, aria: true }}
      labels={{
        Close: "Görseli kapat",
        Next: "Sonraki görsel",
        Previous: "Önceki görsel",
        "Zoom in": "Yakınlaştır",
        "Zoom out": "Uzaklaştır",
        Lightbox: "Açıklama görselleri",
        "Photo gallery": "Açıklama görselleri",
        Slide: "Görsel",
        Carousel: "Galeri",
        "{index} of {total}": "{index} / {total}",
      }}
      styles={{ container: { backgroundColor: "rgba(10, 10, 10, 0.98)" } }}
    />
  );
}
