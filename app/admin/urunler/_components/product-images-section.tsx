"use client";

import type { Dispatch, SetStateAction } from "react";
import Image from "next/image";
import {
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusCircleIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import type { PendingImage, StoredImage, VariantOptionDraft } from "./product-editor-helpers";

export function ProductImagesSection(props: {
  images: StoredImage[];
  title: string;
  saving: boolean;
  processingImages: boolean;
  uploadingCount: number;
  uploadedCount: number;
  failedCount: number;
  galleryPendingImages: PendingImage[];
  variantOptions: VariantOptionDraft[];
  moveImage: (index: number, step: -1 | 1) => void;
  movePendingImage: (index: number, step: -1 | 1) => void;
  removePendingImage: (image: PendingImage) => void;
  handleImageSelection: (event: React.ChangeEvent<HTMLInputElement>, kind: "gallery" | "description") => void;
  setImages: Dispatch<SetStateAction<StoredImage[]>>;
  setPendingImages: Dispatch<SetStateAction<PendingImage[]>>;
}) {
  const {
    images,
    title,
    saving,
    processingImages,
    uploadingCount,
    uploadedCount,
    failedCount,
    galleryPendingImages,
    variantOptions,
    moveImage,
    movePendingImage,
    removePendingImage,
    handleImageSelection,
    setImages,
    setPendingImages,
  } = props;

  return (
          <section aria-label="Görseller" className="space-y-4 rounded-2xl border border-border bg-card/70 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground">Görseller</h2>
                {uploadingCount + failedCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-[10px] text-muted-foreground" role="status">
                    <ArrowPathIcon className={`size-3 ${uploadingCount > 0 ? "animate-spin" : ""}`} aria-hidden="true" />
                    {uploadedCount}/{galleryPendingImages.length} yüklendi
                  </span>
                )}
              </div>
              <label htmlFor="product-image-upload" className={`inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:border-border hover:bg-muted ${processingImages || saving ? "pointer-events-none opacity-60" : ""}`}>
                <PlusCircleIcon className="size-4" />
                <span>{processingImages ? "Hazırlanıyor…" : "Görsel ekle"}</span>
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{images.length + galleryPendingImages.length}/20</span>
              </label>
            </div>
            <p className="text-[11px] leading-4 text-muted-foreground">
              Yalnızca telif hakkına sahip olduğunuz veya kullanım izni bulunan görselleri yükleyin.
            </p>
            <input id="product-image-upload" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={saving || processingImages} onChange={(event) => void handleImageSelection(event, "gallery")} className="sr-only" />
            {(images.length > 0 || galleryPendingImages.length > 0) ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {images.map((image, index) => (
                <div key={image.storageId} className="group overflow-hidden rounded-xl border border-border bg-background">
                  <div className="relative aspect-[4/5] overflow-hidden bg-card">
                    {image.url ? <Image src={image.url} alt={title} width={400} height={500} unoptimized className="size-full object-cover" /> : null}
                    {index === 0 && (
                      <span className="absolute left-2 top-2 rounded-md bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground shadow-sm">
                        Kapak
                      </span>
                    )}
                    {index > 0 && (
                      <Button
                        type="button"
                        size="icon"
                        variant="secondary"
                        aria-label="Sola taşı"
                        title="Sola taşı"
                        disabled={saving}
                        className="absolute left-2 top-1/2 -translate-y-1/2 size-8 rounded-full border border-white/10 bg-background/90 text-foreground opacity-100 hover:bg-muted hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                        onClick={() => moveImage(index, -1)}
                      >
                        <ChevronLeftIcon className="size-4" />
                      </Button>
                    )}
                    {index < images.length - 1 && (
                      <Button
                        type="button"
                        size="icon"
                        variant="secondary"
                        aria-label="Sağa taşı"
                        title="Sağa taşı"
                        disabled={saving}
                        className="absolute right-2 top-1/2 -translate-y-1/2 size-8 rounded-full border border-white/10 bg-background/90 text-foreground opacity-100 hover:bg-muted hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                        onClick={() => moveImage(index, 1)}
                      >
                        <ChevronRightIcon className="size-4" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      aria-label={`Görseli kaldır: ${image.fileName}`}
                      title="Görseli kaldır"
                      disabled={saving}
                      className="absolute right-2 top-2 size-8 rounded-full border border-white/10 bg-background/90 text-foreground opacity-100 hover:bg-muted hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                      onClick={() => setImages((current) => current.filter((item) => item.storageId !== image.storageId))}
                    >
                      <TrashIcon className="size-4" />
                    </Button>
                  </div>
                  {variantOptions.length > 0 && (
                    <select
                      aria-label={`${image.fileName} görsel kapsamı`}
                      disabled={saving}
                      value={JSON.stringify(image.selectedOptions ?? [])}
                      onChange={(event) => {
                        const selectedOptions: { name: string; value: string }[] = JSON.parse(event.target.value) as { name: string; value: string }[];
                        setImages((current) => current.map((item) => item.storageId === image.storageId
                          ? { ...item, selectedOptions: selectedOptions.length ? selectedOptions : undefined }
                          : item));
                      }}
                      className="mx-2 mb-2 mt-2 h-10 w-[calc(100%-1rem)] rounded-md border border-border bg-card px-2.5 text-xs text-foreground outline-none focus-visible:border-border"
                    >
                      <option value="[]">Tüm varyantlarda</option>
                      {variantOptions.flatMap((option) => option.values.map((value) => {
                        const scope = [{ name: option.name, value }];
                        return <option key={`${option.id}:${value}`} value={JSON.stringify(scope)}>{option.name}: {value}</option>;
                      }))}
                    </select>
                  )}
                </div>
              ))}
              {galleryPendingImages.map((image, index) => (
                <div key={image.id} className="group overflow-hidden rounded-xl border border-border bg-background">
                  <div className="relative aspect-[4/5] overflow-hidden bg-card">
                    <Image src={image.previewUrl} alt={title} width={400} height={500} unoptimized className="size-full object-cover" />
                    {image.status === "uploading" && (
                      <div className="absolute inset-0 grid place-items-center bg-background/60">
                        <ArrowPathIcon className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
                      </div>
                    )}
                    {image.status === "error" && (
                      <div className="absolute inset-x-0 bottom-0 bg-destructive px-2 py-1 text-center text-[10px] font-medium text-white">Yüklenemedi</div>
                    )}
                    {images.length === 0 && index === 0 && (
                      <span className="absolute left-2 top-2 rounded-md bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground shadow-sm">
                        Kapak
                      </span>
                    )}
                    {index > 0 && (
                      <Button
                        type="button"
                        size="icon"
                        variant="secondary"
                        aria-label="Sola taşı"
                        title="Sola taşı"
                        disabled={saving}
                        className="absolute left-2 top-1/2 -translate-y-1/2 size-8 rounded-full border border-white/10 bg-background/90 text-foreground opacity-100 hover:bg-muted hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                        onClick={() => movePendingImage(index, -1)}
                      >
                        <ChevronLeftIcon className="size-4" />
                      </Button>
                    )}
                    {index < galleryPendingImages.length - 1 && (
                      <Button
                        type="button"
                        size="icon"
                        variant="secondary"
                        aria-label="Sağa taşı"
                        title="Sağa taşı"
                        disabled={saving}
                        className="absolute right-2 top-1/2 -translate-y-1/2 size-8 rounded-full border border-white/10 bg-background/90 text-foreground opacity-100 hover:bg-muted hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                        onClick={() => movePendingImage(index, 1)}
                      >
                        <ChevronRightIcon className="size-4" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      aria-label={`Görseli kaldır: ${image.fileName}`}
                      title="Görseli kaldır"
                      disabled={saving}
                      className="absolute right-2 top-2 size-8 rounded-full border border-white/10 bg-background/90 text-foreground opacity-100 hover:bg-muted hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                      onClick={() => removePendingImage(image)}>
                      <TrashIcon className="size-4" />
                    </Button>
                  </div>
                  {variantOptions.length > 0 && (
                    <select
                      aria-label={`${image.fileName} görsel kapsamı`}
                      disabled={saving}
                      value={JSON.stringify(image.selectedOptions ?? [])}
                      onChange={(event) => {
                        const selectedOptions: { name: string; value: string }[] = JSON.parse(event.target.value) as { name: string; value: string }[];
                        setPendingImages((current) => current.map((item) => item.id === image.id
                          ? { ...item, selectedOptions: selectedOptions.length ? selectedOptions : undefined }
                          : item));
                      }}
                      className="mx-2 mb-2 mt-2 h-10 w-[calc(100%-1rem)] rounded-md border border-border bg-card px-2.5 text-xs text-foreground outline-none focus-visible:border-border"
                    >
                      <option value="[]">Tüm varyantlarda</option>
                      {variantOptions.flatMap((option) => option.values.map((value) => {
                        const scope = [{ name: option.name, value }];
                        return <option key={`${option.id}:${value}`} value={JSON.stringify(scope)}>{option.name}: {value}</option>;
                      }))}
                    </select>
                  )}
                </div>
              ))}
            </div> : <div className="rounded-xl border border-dashed border-border bg-background/50 px-4 py-5 text-center text-xs text-muted-foreground">Henüz görsel eklenmedi</div>}
          </section>
  );
}
