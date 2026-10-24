"use client";

import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/counter.css";
import { lightboxOptions } from "./lightbox-options";

export default function DescriptionImageLightbox({
  images,
  index,
  onClose,
  alt,
}: {
  images: { url: string }[];
  index: number;
  onClose: () => void;
  alt: string;
}) {
  return (
    <Lightbox
      open
      close={onClose}
      index={index}
      slides={images.map((image) => ({ src: image.url, alt }))}
      {...lightboxOptions(images.length, "Açıklama görselleri")}
    />
  );
}
