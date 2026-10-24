"use client";

import type { Doc } from "@/convex/_generated/dataModel";
import { slugify } from "@/lib/text";
import type { CategoryAttributeDefinition, ProductAttribute } from "@/lib/catalog/attributes";

export type StoredImage = NonNullable<Doc<"products">["images"]>[number] & {
  url: string | null;
};
export type Product = Omit<Doc<"products">, "priceValue" | "images"> & {
  images: StoredImage[];
  descriptionImages: { storageId: string; url: string | null }[];
};
export type Category = Doc<"categories">;
export type ResolvedPendingImage = { storageId: string; fileName: string; kind: "gallery" | "description"; selectedOptions?: { name: string; value: string }[] };
export type PendingImage = {
  id: string;
  blob: Blob;
  fileName: string;
  previewUrl: string;
  kind: "gallery" | "description";
  status: "uploading" | "uploaded" | "error";
  storageId?: string;
  uploadPromise?: Promise<string | null>;
  selectedOptions?: { name: string; value: string }[];
};
export type ExitState = {
  isExisting: boolean;
  saved: boolean;
  title: string;
  slug: string;
  categorySlug: string;
  description: string;
  descriptionImageStorageIds: string[];
  attributeValues: Record<string, string | string[]>;
  categoryAttributes: CategoryAttributeDefinition[];
  variantOptions: { id: string; name: string; values: string[] }[];
  variantRows: VariantDraft[];
  pendingImages: PendingImage[];
};
export type VariantOptionDraft = { id: string; name: string; values: string[] };
export type VariantDraft = {
  id?: string;
  selectedOptions: { name: string; value: string }[];
  sku: string;
  barcode?: string;
  price: string;
  compareAtPrice: string;
  stockQuantity: string;
  availableForSale: boolean;
};

export async function convertImageToWebp(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Yalnızca görsel dosyaları yüklenebilir.");

  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new window.Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Görsel açılamadı."));
      element.src = sourceUrl;
    });
    if (image.naturalWidth * image.naturalHeight > 40_000_000) {
      throw new Error("Görsel çözünürlüğü çok yüksek.");
    }

    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Görsel dönüştürücü başlatılamadı.");
    context.drawImage(image, 0, 0);

    const webp = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => result ? resolve(result) : reject(new Error("Görsel WebP'ye çevrilemedi.")),
        "image/webp",
        0.86,
      );
    });
    if (webp.type !== "image/webp") {
      throw new Error("Bu tarayıcı WebP dönüşümünü desteklemiyor.");
    }
    return webp;
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

export function productImageFileName(productTitle: string, index: number) {
  return `${slugify(productTitle) || "urun"}-${index + 1}.webp`;
}

export async function uploadWebpToStorage(uploadUrl: string, blob: Blob) {
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": "image/webp" },
    body: blob,
  });
  if (!response.ok) throw new Error("WebP görsel Convex Storage'a yüklenemedi.");
  const uploaded: unknown = await response.json();
  if (
    typeof uploaded !== "object" || uploaded === null ||
    !("storageId" in uploaded) || typeof uploaded.storageId !== "string"
  ) {
    throw new Error("Yüklenen görselin kimliği alınamadı.");
  }
  return uploaded.storageId;
}

export async function resolveUploadedImages(pendingImages: PendingImage[]): Promise<ResolvedPendingImage[]> {
  return Promise.all(pendingImages.map(async (image) => {
    const storageId = image.storageId ?? (image.uploadPromise ? await image.uploadPromise : null);
    if (!storageId) throw new Error("Bazı görseller yüklenemedi. Sorunlu görselleri kaldırıp tekrar deneyin.");
    return toResolvedPendingImage({ ...image, storageId });
  }));
}

export function toResolvedPendingImage(image: PendingImage): ResolvedPendingImage {
  return {
    storageId: image.storageId!,
    fileName: image.fileName,
    kind: image.kind,
    ...(image.selectedOptions?.length ? { selectedOptions: image.selectedOptions } : {}),
  };
}

export function imagesPayload(images: { storageId: string; fileName: string; selectedOptions?: { name: string; value: string }[] }[]) {
  return images.map((image) => ({
    storageId: image.storageId,
    fileName: image.fileName,
    ...(image.selectedOptions?.length ? { selectedOptions: image.selectedOptions } : {}),
  }));
}

export function draftAttributes(
  categoryAttributes: CategoryAttributeDefinition[],
  attributeValues: Record<string, string | string[]>,
): ProductAttribute[] {
  const attributes: ProductAttribute[] = [];
  for (const definition of categoryAttributes) {
    const raw = attributeValues[definition.key];
    if (definition.type === "multiselect") {
      const list = Array.isArray(raw) ? raw.filter(Boolean) : [];
      if (list.length > 0) attributes.push({ key: definition.key, value: list });
    } else if (definition.type === "number") {
      const str = typeof raw === "string" ? raw.trim() : "";
      if (str && Number.isFinite(Number(str))) attributes.push({ key: definition.key, value: Number(str) });
    } else if (definition.type === "boolean") {
      const str = typeof raw === "string" ? raw.trim() : "";
      if (str) attributes.push({ key: definition.key, value: str === "true" });
    } else {
      const str = typeof raw === "string" ? raw.trim() : "";
      if (str) attributes.push({ key: definition.key, value: str });
    }
  }
  return attributes;
}

export function minimalDraftPayload(uploaded: ResolvedPendingImage[], descriptionImageStorageIds: string[]) {
  const slug = `taslak-${Date.now()}`;
  return {
    title: "Taslak",
    slug,
    categorySlug: "",
    attributes: [] as ProductAttribute[],
    images: imagesPayload(uploaded.filter((image) => image.kind === "gallery")),
    ...(descriptionImageStorageIds.length > 0 ? { descriptionImageStorageIds } : {}),
    availableForSale: false,
    options: [],
    variants: [{
      id: createEditorId(),
      selectedOptions: [],
      title: "Ürünün kendisi",
      price: "0",
      stockQuantity: 0,
      availableForSale: false,
      sku: generatedVariantSku(slug, []),
    }],
  };
}

export function draftSaveAttempts(state: ExitState, uploaded: ResolvedPendingImage[]) {
  const slug = state.slug.trim() || `taslak-${Date.now()}`;
  const descriptionImageStorageIds = [
    ...state.descriptionImageStorageIds,
    ...uploaded.filter((image) => image.kind === "description").map((image) => image.storageId),
  ];
  const full = {
    title: state.title.trim() || "Taslak",
    slug,
    categorySlug: state.categorySlug,
    description: state.description.trim(),
    ...(descriptionImageStorageIds.length > 0 ? { descriptionImageStorageIds } : {}),
    attributes: draftAttributes(state.categoryAttributes, state.attributeValues),
    images: imagesPayload(uploaded.filter((image) => image.kind === "gallery")),
    availableForSale: false,
    options: state.variantOptions
      .map((option) => ({ id: option.id, name: option.name.trim(), values: option.values.map((value) => value.trim()).filter(Boolean) }))
      .filter((option) => option.name && option.values.length > 0),
    variants: state.variantRows.map((variant) => {
      const selectedOptions = variant.selectedOptions;
      const price = /^\d+([.,]\d{1,2})?$/.test(variant.price.trim()) ? variant.price.trim().replace(",", ".") : "0";
      const compareAtPrice = /^\d+([.,]\d{1,2})?$/.test(variant.compareAtPrice.trim())
        ? variant.compareAtPrice.trim().replace(",", ".")
        : null;
      return {
        id: variant.id || createEditorId(),
        sku: variant.sku.trim() || generatedVariantSku(slug, selectedOptions),
        ...(variant.barcode?.trim() ? { barcode: variant.barcode.trim() } : {}),
        title: selectedOptions.map(({ value }) => value).join(" / ") || "Ürünün kendisi",
        selectedOptions,
        price,
        ...(compareAtPrice && Number(compareAtPrice) > Number(price) ? { compareAtPrice } : {}),
        stockQuantity: Number(variant.stockQuantity) || 0,
        availableForSale: false,
      };
    }),
  };
  return [full, minimalDraftPayload(uploaded, descriptionImageStorageIds)];
}

export async function postAdminAction(action: string, input: unknown) {
  return fetch("/api/admin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, input }),
    keepalive: true,
  });
}

export async function resolveStatePendingImages(state: ExitState): Promise<ResolvedPendingImage[]> {
  const uploaded: ResolvedPendingImage[] = [];
  for (const image of state.pendingImages) {
    const storageId = image.storageId ?? (image.uploadPromise ? await image.uploadPromise : null);
    if (storageId) {
      uploaded.push(toResolvedPendingImage({ ...image, storageId }));
    }
  }
  return uploaded;
}

// true: yapılacak iş yoktu ya da başarıyla tamamlandı; false: taslak denemeleri başarısız oldu (tekrar denenebilir).
export async function flushExitState(state: ExitState): Promise<boolean> {
  const uploaded = await resolveStatePendingImages(state);
  if (uploaded.length === 0) return true;
  if (state.isExisting) {
    for (const image of uploaded) {
      void postAdminAction("product.image-discard", { storageId: image.storageId }).catch(() => {});
    }
    return true;
  }
  for (const input of draftSaveAttempts(state, uploaded)) {
    try {
      const response = await postAdminAction("product.create", input);
      if (response.ok) return true;
    } catch {
      // sonraki deneme
    }
  }
  return false;
}

export function createEditorId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function normalizeOptionKey(str: string) {
  return str.trim().toLocaleLowerCase("tr-TR");
}

export function selectionKey(selectedOptions: { name: string; value: string }[]) {
  return JSON.stringify(
    [...selectedOptions]
      .map((opt) => ({ name: normalizeOptionKey(opt.name), value: opt.value.trim() }))
      .sort((a, b) => a.name.localeCompare(b.name, "tr-TR"))
  );
}

export function variantOptionSignature(options: { name: string; values: string[] }[]) {
  return JSON.stringify(
    options.map((option) => [
      normalizeOptionKey(option.name),
      [...option.values.map((v) => v.trim()).filter(Boolean)],
    ])
  );
}

export function getVariantCombinations(options: { name: string; values: string[] }[]) {
  return options.reduce<{ name: string; value: string }[][]>(
    (combinations, option) => combinations.flatMap((combination) =>
      option.values.map((value) => [...combination, { name: option.name, value }]),
    ),
    [[]],
  );
}

export function generatedVariantSku(slug: string, selectedOptions: { name: string; value: string }[]) {
  const source = `${slug}:${selectionKey(selectedOptions)}`.toLocaleUpperCase("en-US");
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash = Math.imul(hash ^ source.charCodeAt(index), 16777619);
  }
  return `SKU-${(hash >>> 0).toString(36).toUpperCase().padStart(7, "0")}`;
}

