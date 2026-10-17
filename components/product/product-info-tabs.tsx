"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useQuery } from "convex/react";
import { ArrowsPointingOutIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import { api } from "@/convex/_generated/api";
import { DeliveryInfo } from "./delivery-info";
import type { Product } from "@/lib/catalog/types";

const DescriptionImageLightbox = dynamic(() => import("./description-image-lightbox"), {
  ssr: false,
});

type InfoTab = "product" | "questions";

const tabs: { id: InfoTab; label: string }[] = [
  { id: "product", label: "Ürün Bilgileri" },
  { id: "questions", label: "Soru Cevap" },
];

export function ProductInfoTabs({ product }: { product: Product }) {
  const [tab, setTab] = useState<InfoTab>("product");
  const [expanded, setExpanded] = useState(false);
  const [activeDescriptionImage, setActiveDescriptionImage] = useState(0);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const category = useQuery(
    api.categories.getBySlug,
    product.categorySlug ? { slug: product.categorySlug } : "skip",
  );

  const description = product.description?.trim() ?? "";
  const descriptionImages = product.descriptionImages ?? [];
  const descriptionImage = descriptionImages[activeDescriptionImage] ?? descriptionImages[0];
  const canToggle = description.length > 320;
  const attributes = product.attributes?.flatMap((attribute) => {
    const definition = category?.attributes?.find(
      (candidate) => candidate.key === attribute.key,
    );
    if (!definition?.label) return [];
    const value = Array.isArray(attribute.value)
      ? attribute.value.join(", ")
      : typeof attribute.value === "boolean"
        ? attribute.value
          ? "Evet"
          : "Hayır"
        : String(attribute.value);
    return [{
      key: attribute.key,
      label: definition.label,
      value: `${value}${definition.unit ? ` ${definition.unit}` : ""}`,
    }];
  }) ?? [];

  return (
    <section>
      <div role="tablist" aria-label="Ürün bilgileri" className="flex gap-6 border-b border-border/70">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`-mb-px border-b-2 py-3 text-sm font-semibold transition-colors ${
              tab === item.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "product" ? (
        <div className="pt-5 sm:pt-6">
          <div className={`grid gap-6 ${descriptionImage ? "md:grid-cols-[220px_minmax(0,1.2fr)_minmax(0,0.8fr)]" : "md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)]"}`}>
            {descriptionImage ? (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setPreviewIndex(activeDescriptionImage)}
                  aria-label="Açıklama görselini büyüt"
                  className="group relative aspect-[3/4] w-full cursor-zoom-in overflow-hidden rounded-xl border border-border/70 bg-muted/30"
                >
                  <Image
                    src={descriptionImage.url}
                    alt={`${product.title} açıklama görseli`}
                    fill
                    sizes="(min-width: 768px) 220px, 100vw"
                    className="object-contain"
                  />
                  <span className="absolute bottom-2 right-2 flex size-8 items-center justify-center rounded-full bg-black/60 text-white opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                    <ArrowsPointingOutIcon className="size-4" aria-hidden="true" />
                  </span>
                </button>
                {descriptionImages.length > 1 ? (
                  <div role="group" aria-label="Açıklama görselleri" className="grid grid-cols-4 gap-1.5">
                    {descriptionImages.map((image, index) => (
                      <button
                        key={image.url}
                        type="button"
                        onClick={() => setActiveDescriptionImage(index)}
                        aria-label={`Açıklama görseli ${index + 1}`}
                        aria-pressed={activeDescriptionImage === index}
                        className={`relative aspect-square overflow-hidden rounded-lg border transition-colors ${
                          activeDescriptionImage === index
                            ? "border-foreground"
                            : "border-border/70 hover:border-foreground/40"
                        }`}
                      >
                        <Image
                          src={image.url}
                          alt=""
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="min-w-0">
              <h3 className="text-base font-semibold text-foreground">Ürün Açıklaması</h3>
              {description ? (
                <>
                  <p className={`mt-3 whitespace-pre-line text-sm leading-6 text-muted-foreground ${!expanded && canToggle ? "line-clamp-6" : ""}`}>
                    {description}
                  </p>
                  {canToggle ? (
                    <button
                      type="button"
                      onClick={() => setExpanded((current) => !current)}
                      aria-expanded={expanded}
                      className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-primary hover:underline"
                    >
                      {expanded ? "Daha Az Göster" : "Daha Fazla Göster"}
                      <ChevronDownIcon className={`size-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
                    </button>
                  ) : null}
                </>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  Bu ürün için açıklama bulunmuyor.
                </p>
              )}
            </div>

            <div className="min-w-0">
              <DeliveryInfo />
            </div>
          </div>

          {attributes.length > 0 ? (
            <section className="mt-8">
              <h3 className="text-base font-semibold text-foreground">Ürün Özellikleri</h3>
              <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
                {attributes.map((attribute) => (
                  <div key={attribute.key} className="min-w-0">
                    <dt className="text-xs text-muted-foreground">{attribute.label}</dt>
                    <dd className="mt-1 break-words text-sm font-medium text-foreground">
                      {attribute.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}
        </div>
      ) : (
        <div className="pt-5 sm:pt-6">
          <p className="text-sm text-muted-foreground">Henüz soru bulunmuyor.</p>
        </div>
      )}

      {previewIndex !== null ? (
        <DescriptionImageLightbox
          images={descriptionImages}
          index={previewIndex}
          onClose={() => setPreviewIndex(null)}
        />
      ) : null}
    </section>
  );
}
