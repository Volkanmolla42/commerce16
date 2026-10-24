import type { Metadata } from "next";
import { storeConfig } from "./store-config";
import { baseUrl } from "./utils";

export const storeOgImage = {
  url: "/opengraph-image.png",
  width: 1200,
  height: 630,
  alt: `${storeConfig.name} paylaşım görseli`,
};

export const storeTwitterImage = "/twitter-image.png";

type PageMetadataOptions = {
  title: string;
  path: string;
  description?: string;
  robots?: Metadata["robots"];
};

export function pageMetadata({
  title,
  path,
  description = storeConfig.description,
  robots,
}: PageMetadataOptions): Metadata {
  const fullTitle = `${title} | ${storeConfig.name}`;
  const url = new URL(path, baseUrl).toString();

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      title: fullTitle,
      description,
      siteName: storeConfig.name,
      locale: "tr_TR",
      url,
      images: [storeOgImage],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [storeTwitterImage],
    },
    ...(robots ? { robots } : {}),
  };
}
