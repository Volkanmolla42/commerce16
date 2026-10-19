"use client";

import type { Dispatch, SetStateAction } from "react";
import Image from "next/image";
import { ArrowPathIcon, PlusCircleIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { PendingImage } from "./product-editor-helpers";

export function ProductDescriptionSection(props: {
  description: string;
  setDescription: Dispatch<SetStateAction<string>>;
  processingImages: boolean;
  saving: boolean;
  descriptionImageLimitReached: boolean;
  descriptionImages: { storageId: string; url: string | null }[];
  descriptionPendingImages: PendingImage[];
  handleImageSelection: (event: React.ChangeEvent<HTMLInputElement>, kind: "gallery" | "description") => void;
  removeDescriptionImage: (storageId: string) => void;
  removePendingImage: (image: PendingImage) => void;
}) {
  const {
    description,
    setDescription,
    processingImages,
    saving,
    descriptionImageLimitReached,
    descriptionImages,
    descriptionPendingImages,
    handleImageSelection,
    removeDescriptionImage,
    removePendingImage,
  } = props;

  return (
          <section aria-label="Açıklama" className="rounded-2xl border border-border bg-card/70 p-4 sm:p-6">
            <div className="space-y-5">
              <h2 className="text-sm font-semibold text-foreground">Açıklama</h2>
              <div className="space-y-1.5">
                <Label htmlFor="product-description">Ürün açıklaması</Label>
                <textarea
                  id="product-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={4000}
                  rows={6}
                  placeholder="Kumaş, kalıp, bakım ve kullanım bilgileri..."
                  className="min-h-32 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
                />
                <p className="text-[11px] text-muted-foreground leading-normal">
                  Paragraflar için alt satır kullanın. En fazla 4000 karakter.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-xs font-semibold text-foreground">Açıklama görselleri</h3>
                    <p className="text-[11px] text-muted-foreground leading-normal">
                      Ürün galerisinden bağımsızdır; yalnızca açıklama bölümünde gösterilir. En fazla 12 görsel.
                    </p>
                  </div>
                  <label
                    htmlFor="product-description-image-upload"
                    className={`inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted ${
                      processingImages || saving || descriptionImageLimitReached ? "pointer-events-none opacity-60" : ""
                    }`}
                  >
                    <PlusCircleIcon className="size-4" />
                    <span>{processingImages ? "Yükleniyor…" : "Görsel ekle"}</span>
                    <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {descriptionImages.length + descriptionPendingImages.length}/12
                    </span>
                  </label>
                </div>
                <input
                  id="product-description-image-upload"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  disabled={saving || processingImages || descriptionImageLimitReached}
                  onChange={(event) => void handleImageSelection(event, "description")}
                  className="sr-only"
                />
                {descriptionImages.length > 0 || descriptionPendingImages.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                    {descriptionImages.map((image) => (
                      <div key={image.storageId} className="group relative aspect-[4/5] overflow-hidden rounded-xl border border-border bg-background">
                        {image.url ? (
                          <Image src={image.url} alt="" width={200} height={250} unoptimized className="size-full object-cover" />
                        ) : (
                          <span className="grid size-full place-items-center bg-muted text-[10px] text-muted-foreground">Görsel yok</span>
                        )}
                        <Button
                          type="button"
                          size="icon"
                          variant="secondary"
                          aria-label="Açıklama görselini kaldır"
                          title="Görseli kaldır"
                          disabled={saving}
                          className="absolute right-1.5 top-1.5 size-8 rounded-full border border-white/10 bg-background/90 text-foreground hover:bg-muted hover:text-foreground"
                          onClick={() => removeDescriptionImage(image.storageId)}
                        >
                          <TrashIcon className="size-3.5" />
                        </Button>
                      </div>
                    ))}
                    {descriptionPendingImages.map((image) => (
                      <div key={image.id} className="group relative aspect-[4/5] overflow-hidden rounded-xl border border-border bg-background">
                        <Image src={image.previewUrl} alt="" width={200} height={250} unoptimized className="size-full object-cover" />
                        {image.status === "uploading" && <div className="absolute inset-0 grid place-items-center bg-background/60"><ArrowPathIcon className="size-4 animate-spin text-muted-foreground" aria-hidden="true" /></div>}
                        {image.status === "error" && <div className="absolute inset-x-0 bottom-0 bg-destructive px-1 py-0.5 text-center text-[9px] font-medium text-white">Yüklenemedi</div>}
                        <Button
                          type="button"
                          size="icon"
                          variant="secondary"
                          aria-label="Açıklama görselini kaldır"
                          title="Görseli kaldır"
                          disabled={saving}
                          className="absolute right-1.5 top-1.5 size-8 rounded-full border border-white/10 bg-background/90 text-foreground hover:bg-muted hover:text-foreground"
                          onClick={() => removePendingImage(image)}
                        >
                          <TrashIcon className="size-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </section>
  );
}
