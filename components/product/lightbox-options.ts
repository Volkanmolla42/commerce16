import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Counter from "yet-another-react-lightbox/plugins/counter";

export function lightboxOptions(imageCount: number, galleryLabel: string) {
  return {
    plugins: [Zoom, Counter],
    zoom: { scrollToZoom: true, maxZoomPixelRatio: 3 },
    carousel: { finite: imageCount === 1, preload: 1, padding: 16 },
    controller: { closeOnBackdropClick: true, aria: true },
    labels: {
      Close: "Görseli kapat",
      Next: "Sonraki görsel",
      Previous: "Önceki görsel",
      "Zoom in": "Yakınlaştır",
      "Zoom out": "Uzaklaştır",
      Lightbox: galleryLabel,
      "Photo gallery": galleryLabel,
      Slide: "Görsel",
      Carousel: "Galeri",
      "{index} of {total}": "{index} / {total}",
    },
    styles: { container: { backgroundColor: "rgba(10, 10, 10, 0.98)" } },
  };
}
