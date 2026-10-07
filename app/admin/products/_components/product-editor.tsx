"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { Doc } from "@/convex/_generated/dataModel";
import { Button, Input, Label } from "@/components/ui";
import { AdminLoading, AdminNotice } from "../../_components/admin-primitives";
import { runAdminAction, useAdminResource } from "../../_components/admin-api";
import { slugify } from "@/lib/admin/slug";
import { adminPath } from "@/lib/admin/routes";
import { type CategoryAttributeDefinition, type ProductAttribute } from "@/lib/catalog/attributes";
import {
  AdjustmentsHorizontalIcon,
  ArrowPathIcon,
  CheckIcon,
  DocumentArrowDownIcon,
  GlobeAltIcon,
  PlusCircleIcon,
  PlusIcon,
  Squares2X2Icon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  AttributeBooleanToggle,
  AttributeMultiSelect,
  AttributeNumberInput,
  AttributeSingleSelect,
} from "./attribute-field-inputs";
import { VariantOptionValuesInput } from "./variant-option-values-input";

type StoredImage = NonNullable<Doc<"products">["storageImages"]>[number] & {
  url: string | null;
};
export type Product = Omit<Doc<"products">, "seo" | "rating" | "complementaryProductIds" | "upsellProductIds"> & { storageImages?: StoredImage[] };
export type Category = Doc<"categories">;
type PendingImage = { id: string; blob: Blob; fileName: string; previewUrl: string };
type VariantOptionDraft = { id: string; name: string; values: string[] };
type VariantDraft = {
  id?: string;
  selectedOptions: { name: string; value: string }[];
  sku: string;
  barcode?: string;
  price: string;
  vatRate: string;
  stockQuantity: string;
  availableForSale: boolean;
};

async function convertImageToWebp(file: File) {
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

function productImageFileName(productTitle: string, index: number) {
  return `${slugify(productTitle) || "urun"}-${index + 1}.webp`;
}

function createEditorId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function selectionKey(selectedOptions: { name: string; value: string }[]) {
  return JSON.stringify([...selectedOptions].sort((a, b) => a.name.localeCompare(b.name)));
}

function variantOptionSignature(options: { name: string; values: string[] }[]) {
  return JSON.stringify(options.map((option) => [option.name.trim(), option.values]));
}

function getVariantCombinations(options: { name: string; values: string[] }[]) {
  return options.reduce<{ name: string; value: string }[][]>(
    (combinations, option) => combinations.flatMap((combination) =>
      option.values.map((value) => [...combination, { name: option.name, value }]),
    ),
    [[]],
  );
}

function generatedVariantSku(slug: string, selectedOptions: { name: string; value: string }[]) {
  const source = `${slug}:${selectionKey(selectedOptions)}`.toLocaleUpperCase("en-US");
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash = Math.imul(hash ^ source.charCodeAt(index), 16777619);
  }
  return `SKU-${(hash >>> 0).toString(36).toUpperCase().padStart(7, "0")}`;
}

function ProductEditor({
  product,
  categories,
  onCancel,
  onSaved,
}: {
  product: Product | null;
  categories: Category[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(product?.title || "");
  const [slug, setSlug] = useState(product?.slug || "");
  const [price, setPrice] = useState(product?.price || "");
  const defaultVariant = product?.variants?.find((variant) => variant.selectedOptions.length === 0);
  const [baseSku, setBaseSku] = useState(defaultVariant?.sku || product?.sku || generatedVariantSku(product?.slug || slug, []));
  const [baseBarcode, setBaseBarcode] = useState(defaultVariant?.barcode || "");
  const [baseStockQuantity, setBaseStockQuantity] = useState(
    defaultVariant?.stockQuantity == null
      ? product?.stockQuantity == null ? "0" : String(product.stockQuantity)
      : String(defaultVariant.stockQuantity),
  );
  const [baseVatRate, setBaseVatRate] = useState(defaultVariant?.vatRate == null
    ? product?.vatRate == null ? "" : String(product.vatRate)
    : String(defaultVariant.vatRate));
  const [variantOptions, setVariantOptions] = useState<VariantOptionDraft[]>(() =>
    (product?.options ?? []).map((option) => ({ ...option, values: option.values })),
  );
  const [generatedOptionSignature, setGeneratedOptionSignature] = useState(() =>
    variantOptionSignature(product?.options ?? []),
  );
  const [categorySlug, setCategorySlug] = useState(product?.categorySlug || "");
  const [attributeValues, setAttributeValues] = useState<Record<string, string | string[]>>(() => {
    const map: Record<string, string | string[]> = {};
    for (const attribute of product?.attributes ?? []) {
      if (Array.isArray(attribute.value)) {
        map[attribute.key] = attribute.value;
      } else {
        map[attribute.key] = String(attribute.value);
      }
    }
    return map;
  });
  const [storageImages, setStorageImages] = useState<StoredImage[]>(product?.storageImages || []);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [processingImages, setProcessingImages] = useState(false);
  const previewUrls = useRef<string[]>([]);
  const [availableForSale, setAvailableForSale] = useState(product?.availableForSale ?? true);
  const [variantRows, setVariantRows] = useState<VariantDraft[]>(() =>
    (product?.variants ?? [])
      .filter((variant) => variant.selectedOptions.length > 0)
      .map((variant) => ({
        id: variant.id,
        selectedOptions: variant.selectedOptions.map(({ name, value }) => ({ name, value })),
        sku: variant.sku ?? "",
        barcode: variant.barcode ?? "",
        price: variant.price ?? product?.price ?? "",
        vatRate: variant.vatRate == null ? product?.vatRate == null ? "" : String(product.vatRate) : String(variant.vatRate),
        stockQuantity: String(variant.stockQuantity ?? 0),
        availableForSale: variant.availableForSale,
      })),
  );
  const [isVariantProduct, setIsVariantProduct] = useState(() =>
    Boolean(product?.variants?.some((variant) => variant.selectedOptions.length > 0)),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const categoryAttributes = categories.find((category) => category.slug === categorySlug)?.attributes ?? [];

  const changeCategory = (nextSlug: string) => {
    setCategorySlug(nextSlug);
    const nextKeys = new Set(categories.find((category) => category.slug === nextSlug)?.attributes?.map((attribute) => attribute.key) ?? []);
    setAttributeValues((current) => Object.fromEntries(Object.entries(current).filter(([key]) => nextKeys.has(key))));
  };

  useEffect(() => () => {
    for (const url of previewUrls.current) URL.revokeObjectURL(url);
  }, []);

  const addVariantOption = () => {
    setVariantOptions((current) => current.length >= 3
      ? current
      : [...current, { id: createEditorId(), name: "", values: [] }]);
  };

  const generateVariantRows = () => {
    const options = variantOptions.map((option) => ({
      name: option.name.trim(),
      values: option.values.map((v) => v.trim()).filter(Boolean),
    }));
    if (options.some((option) => !option.name || option.values.length === 0)) {
      setError("Her seçenek için bir ad ve en az bir değer gir.");
      return;
    }
    if (new Set(options.map((option) => option.name.toLocaleLowerCase("tr-TR"))).size !== options.length) {
      setError("Seçenek adları birbirinden farklı olmalı.");
      return;
    }
    if (options.some((option) => new Set(option.values.map((value) => value.toLocaleLowerCase("tr-TR"))).size !== option.values.length)) {
      setError("Aynı seçenek değerini birden fazla ekleme.");
      return;
    }

    const combinations = getVariantCombinations(options);
    if (combinations.length > 100) {
      setError("Bir üründe en fazla 100 kombinasyon olabilir.");
      return;
    }

    const existingRows = new Map(variantRows.map((variant) => [selectionKey(variant.selectedOptions), variant]));
    setVariantRows(combinations.map((selectedOptions) => existingRows.get(selectionKey(selectedOptions)) ?? ({
      id: createEditorId(),
      selectedOptions,
      sku: generatedVariantSku(slug, selectedOptions),
      barcode: "",
      price: price || "",
      vatRate: baseVatRate,
      stockQuantity: "0",
      availableForSale: true,
    })));
    setGeneratedOptionSignature(variantOptionSignature(options));
    setError(null);
  };

  const toggleVariantProduct = () => {
    if (isVariantProduct) {
      const first = variantRows[0];
      if (first) {
        setBaseSku(first.sku);
        setBaseBarcode(first.barcode || "");
        setBaseStockQuantity(first.stockQuantity);
        setPrice(first.price);
        setBaseVatRate(first.vatRate);
      }
      setIsVariantProduct(false);
      return;
    }
    if (variantOptions.length === 0) {
      setVariantOptions([{ id: createEditorId(), name: "Renk", values: [] }]);
    }
    setIsVariantProduct(true);
  };

  const updateVariant = (index: number, patch: Partial<VariantDraft>) => {
    setVariantRows((current) => current.map((variant, currentIndex) =>
      currentIndex === index ? { ...variant, ...patch } : variant,
    ));
  };

  const removeVariant = (index: number) => {
    setVariantRows((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };
  const handleImageSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files || []);
    event.currentTarget.value = "";
    if (!files.length) return;
    if (storageImages.length + pendingImages.length + files.length > 20) {
      setError("Bir üründe en fazla 20 görsel olabilir.");
      return;
    }

    setProcessingImages(true);
    setError(null);
    try {
      const nextImages: PendingImage[] = [];
      for (const [index, file] of files.entries()) {
        const blob = await convertImageToWebp(file);
        const position = storageImages.length + pendingImages.length + index;
        const fileName = productImageFileName(title || slug || "urun", position);
        const previewUrl = URL.createObjectURL(blob);
        previewUrls.current.push(previewUrl);
        nextImages.push({ id: createEditorId(), blob, fileName, previewUrl });
      }
      setPendingImages((current) => [...current, ...nextImages]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Görsel WebP'ye çevrilemedi.");
    } finally {
      setProcessingImages(false);
    }
  };

  const removePendingImage = (image: PendingImage) => {
    URL.revokeObjectURL(image.previewUrl);
    previewUrls.current = previewUrls.current.filter((url) => url !== image.previewUrl);
    setPendingImages((current) => current.filter((item) => item.id !== image.id));
  };

  const uploadPendingImage = async (image: PendingImage, fileName: string): Promise<StoredImage> => {
    const { uploadUrl } = await runAdminAction<{ uploadUrl: string }>("product.image-upload-url");
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": "image/webp" },
      body: image.blob,
    });
    if (!response.ok) throw new Error("WebP görsel Convex Storage'a yüklenemedi.");

    const uploaded: unknown = await response.json();
    if (
      typeof uploaded !== "object" || uploaded === null ||
      !("storageId" in uploaded) || typeof uploaded.storageId !== "string"
    ) {
      throw new Error("Yüklenen görselin kimliği alınamadı.");
    }

    const { url } = await runAdminAction<{ url: string }>("product.image-url", {
      storageId: uploaded.storageId,
    });
    return { storageId: uploaded.storageId as StoredImage["storageId"], fileName, url };
  };

  const save = async (event?: React.FormEvent<HTMLFormElement>, publishStatusOverride?: boolean) => {
    if (event) event.preventDefault();
    const targetAvailableForSale = publishStatusOverride !== undefined ? publishStatusOverride : availableForSale;
    const activeVariantRows = isVariantProduct ? variantRows : [];
    const activeOptions = isVariantProduct ? variantOptions.map((option) => ({
      id: option.id,
      name: option.name.trim(),
      values: option.values.map((v) => v.trim()).filter(Boolean),
    })) : [];
    const basePrice = (activeVariantRows[0]?.price ?? price).trim();

    if (activeVariantRows.length === 0 && !baseSku.trim()) {
      setError("Ürün SKU kodunu gir.");
      return;
    }
    if (!slug.trim()) {
      setError("Ürün adı geçerli bir mağaza adresi oluşturmalı.");
      return;
    }
    if (!categorySlug) {
      setError("Ürün kategorisini seçin.");
      return;
    }
    const productAttributes: ProductAttribute[] = [];
    for (const definition of categoryAttributes) {
      const raw = attributeValues[definition.key];
      if (definition.type === "multiselect") {
        const list = Array.isArray(raw) ? raw.filter(Boolean) : [];
        if (list.length === 0) {
          if (definition.required) {
            setError(`${definition.label} alanı için en az bir seçenek seçmelisiniz.`);
            return;
          }
          continue;
        }
        productAttributes.push({ key: definition.key, value: list });
      } else if (definition.type === "number") {
        const str = typeof raw === "string" ? raw.trim() : "";
        if (!str) {
          if (definition.required) {
            setError(`${definition.label} alanı zorunludur.`);
            return;
          }
          continue;
        }
        const value = Number(str);
        if (!Number.isFinite(value)) {
          setError(`${definition.label} sayısal bir değer olmalı.`);
          return;
        }
        productAttributes.push({ key: definition.key, value });
      } else if (definition.type === "boolean") {
        const str = typeof raw === "string" ? raw.trim() : "";
        if (!str) {
          if (definition.required) {
            setError(`${definition.label} alanı zorunludur.`);
            return;
          }
          continue;
        }
        productAttributes.push({ key: definition.key, value: str === "true" });
      } else {
        const str = typeof raw === "string" ? raw.trim() : "";
        if (!str) {
          if (definition.required) {
            setError(`${definition.label} alanı zorunludur.`);
            return;
          }
          continue;
        }
        productAttributes.push({ key: definition.key, value: str });
      }
    }
    if (activeVariantRows.length === 0 && !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(baseSku.trim())) {
      setError("SKU 1-64 karakter olmalı ve yalnızca harf, rakam, nokta, alt çizgi veya tire içermeli.");
      return;
    }
    if (activeVariantRows.length === 0 && (!baseStockQuantity.trim() || !/^\d+$/.test(baseStockQuantity) || !Number.isSafeInteger(Number(baseStockQuantity)))) {
      setError("Stok adedi sıfır veya daha büyük bir tam sayı olmalı.");
      return;
    }
    if (activeVariantRows.length > 100) {
      setError("Bir üründe en fazla 100 varyant olabilir.");
      return;
    }
    if (isVariantProduct && (activeOptions.length === 0 || activeOptions.some((option) => !option.name || option.values.length === 0))) {
      setError("Varyant seçeneklerine ad ve en az bir değer gir.");
      return;
    }
    if (isVariantProduct && variantOptionSignature(activeOptions) !== generatedOptionSignature) {
      setError("Seçenekleri değiştirdin. Varyant tablosunu yeniden oluştur.");
      return;
    }
    if (isVariantProduct && new Set(activeOptions.map((option) => option.name.toLocaleLowerCase("tr-TR"))).size !== activeOptions.length) {
      setError("Seçenek adları birbirinden farklı olmalı.");
      return;
    }
    if (isVariantProduct && activeOptions.some((option) => new Set(option.values.map((value) => value.toLocaleLowerCase("tr-TR"))).size !== option.values.length)) {
      setError("Aynı seçenek değerini birden fazla ekleme.");
      return;
    }
    const combinationCount = activeOptions.reduce((count, option) => count * option.values.length, 1);
    if (isVariantProduct && combinationCount > 100) {
      setError("Bir üründe en fazla 100 kombinasyon olabilir.");
      return;
    }
    if (isVariantProduct && activeVariantRows.length === 0) {
      setError("En az bir satılabilir kombinasyon oluştur.");
      return;
    }
    if (isVariantProduct && activeVariantRows.some((variant) =>
      variant.selectedOptions.length !== activeOptions.length ||
      activeOptions.some((option) => !variant.selectedOptions.some((selected) => selected.name === option.name && option.values.includes(selected.value))),
    )) {
      setError("Varyant tablosunu güncel seçeneklerle yeniden oluştur.");
      return;
    }
    if (!baseVatRate.trim() || !/^\d+(?:[.,]\d{1,2})?$/.test(baseVatRate.trim()) || Number(baseVatRate.replace(",", ".")) > 100) {
      setError("0 ile 100 arasında geçerli bir KDV oranı gir.");
      return;
    }
    if (new Set(activeVariantRows.map((variant) => selectionKey(variant.selectedOptions))).size !== activeVariantRows.length) {
      setError("Varyant kombinasyonları birbirinden farklı olmalı.");
      return;
    }
    if (!/^\d+(?:[.,]\d{1,2})?$/.test(basePrice) || !Number.isSafeInteger(Math.round(Number(basePrice.replace(",", ".")) * 100))) {
      setError("Geçerli bir satış fiyatı gir.");
      return;
    }
    for (const draft of activeVariantRows) {
      const variantStock = draft.stockQuantity.trim();
      if (!variantStock || !/^\d+$/.test(variantStock) || !Number.isSafeInteger(Number(variantStock))) {
        setError("Her varyant için sıfır veya daha büyük bir stok adedi girin.");
        return;
      }
      const variantSku = draft.sku.trim();
      if (!variantSku) {
        setError("Her varyant için ayrı bir SKU girin.");
        return;
      }
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(variantSku)) {
        setError("SKU 1-64 karakter olmalı ve yalnızca harf, rakam, nokta, alt çizgi veya tire içermeli.");
        return;
      }
      if (!/^\d+(?:[.,]\d{1,2})?$/.test(draft.price.trim()) || !Number.isSafeInteger(Math.round(Number(draft.price.replace(",", ".")) * 100))) {
        setError("Her varyant için geçerli bir satış fiyatı gir.");
        return;
      }
    }
    if (new Set(activeVariantRows.map((variant) => variant.sku.trim().toLocaleUpperCase("en-US"))).size !== activeVariantRows.length) {
      setError("Her varyantın SKU kodu birbirinden farklı olmalı.");
      return;
    }
    if (storageImages.length + pendingImages.length > 20) {
      setError("Bir üründe en fazla 20 görsel olabilir.");
      return;
    }
    setSaving(true);
    setError(null);
    const parsedVatRate = Number(baseVatRate.replace(",", "."));
    const input = {
      ...(product ? { id: product._id } : {}),
      title: title.trim(),
      slug: slug.trim(),
      price: basePrice.replace(",", "."),
      vatRate: parsedVatRate,
      categorySlug,
      attributes: productAttributes,
      images: [],
      availableForSale: targetAvailableForSale,
      options: activeVariantRows.length > 0 ? activeOptions : [],
      variants: activeVariantRows.length > 0 ? activeVariantRows.map((variant) => {
        const selectedOptions = variant.selectedOptions;
        return {
          id: variant.id || createEditorId(),
          sku: variant.sku.trim(),
          ...(variant.barcode?.trim() ? { barcode: variant.barcode.trim() } : {}),
          title: selectedOptions.map(({ value }) => value).join(" / "),
          selectedOptions,
          price: variant.price.trim().replace(",", "."),
          vatRate: parsedVatRate,
          availableForSale: variant.availableForSale,
          stockQuantity: Number(variant.stockQuantity),
        };
      }) : [{
        id: variantRows[0]?.id || defaultVariant?.id || createEditorId(),
        sku: baseSku.trim(),
        ...(baseBarcode.trim() ? { barcode: baseBarcode.trim() } : {}),
        title: "Ürünün kendisi",
        selectedOptions: [],
        vatRate: parsedVatRate,
        availableForSale: targetAvailableForSale,
        stockQuantity: Number(baseStockQuantity),
      }],
    };

    try {
      const uploadedImages: StoredImage[] = [];
      for (const [index, image] of pendingImages.entries()) {
        uploadedImages.push(await uploadPendingImage(
          image,
          productImageFileName(title || slug || "urun", storageImages.length + index),
        ));
      }
      await runAdminAction(product ? "product.update" : "product.create", {
        ...input,
        storageImages: [...storageImages, ...uploadedImages].map((image) => ({
          storageId: image.storageId,
          fileName: image.fileName,
        })),
      });
      onSaved();

    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ürün kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="scheme-dark mx-auto w-full max-w-7xl px-4 py-5 text-neutral-100 sm:px-6 lg:px-8">
      <header className="mb-6">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">{title || (product ? "Ürün detayları" : "Yeni ürün")}</h1>
        </div>
      </header>

      <form onSubmit={save} className="space-y-5">
        <div className="space-y-5">
          <section aria-label="Görseller" className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4 sm:p-5">
              <label htmlFor="product-image-upload" className={`flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-700 bg-neutral-950 p-4 text-center transition hover:border-neutral-500 hover:bg-neutral-800/70 ${processingImages || saving ? "pointer-events-none opacity-60" : ""}`}>
                <span className="grid size-9 place-items-center rounded-full bg-neutral-800 text-neutral-300"><PlusCircleIcon className="size-5" /></span>
                <strong className="text-xs font-medium text-neutral-200">
                  {processingImages ? "Görseller hazırlanıyor…" : `Görsel ekle (${storageImages.length + pendingImages.length}/20)`}
                </strong>
              </label>
              <input id="product-image-upload" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={saving || processingImages} onChange={(event) => void handleImageSelection(event)} className="sr-only" />
              {(storageImages.length > 0 || pendingImages.length > 0) && <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8">
                {storageImages.map((image) => <div key={image.storageId} className="group relative overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950">
                  {image.url ? <Image src={image.url} alt={title} width={240} height={240} unoptimized className="aspect-square w-full object-cover" /> : <div className="aspect-square" />}
                  <Button type="button" size="sm" variant="secondary" disabled={saving} className="absolute right-1 top-1 min-h-7 rounded-md bg-neutral-950/90 px-2 text-[10px] text-neutral-100 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100" onClick={() => setStorageImages((current) => current.filter((item) => item.storageId !== image.storageId))}>
                    <TrashIcon className="mr-1 size-3" />
                    Kaldır
                  </Button>
                </div>)}
                {pendingImages.map((image) => <div key={image.id} className="group relative overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950">
                  <Image src={image.previewUrl} alt={title} width={240} height={240} unoptimized className="aspect-square w-full object-cover" />
                  <Button type="button" size="sm" variant="secondary" disabled={saving} className="absolute right-1 top-1 min-h-7 rounded-md bg-neutral-950/90 px-2 text-[10px] text-neutral-100 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100" onClick={() => removePendingImage(image)}>
                    <TrashIcon className="mr-1 size-3" />
                    Kaldır
                  </Button>
                </div>)}
              </div>}
          </section>
          <section aria-label="Ürün detayları" className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4 sm:p-6">
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-[1fr_10rem] sm:items-start">
                  <div className="space-y-2">
                    <Label htmlFor="product-title" className="text-xs font-medium text-neutral-300">Ürün adı <span className="text-red-400">*</span></Label>
                    <Input id="product-title" name="title" autoComplete="off" required minLength={2} maxLength={140} placeholder="Ürün adı" value={title} onChange={(event) => {
                      const nextTitle = event.target.value;
                      setTitle(nextTitle);
                      setSlug(slugify(nextTitle));
                    }} className="h-12 rounded-xl border-neutral-700 bg-neutral-950 px-4 text-sm text-neutral-100 placeholder:text-neutral-600 focus-visible:ring-neutral-400" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="product-vat-rate" className="text-xs font-medium text-neutral-300">KDV oranı (%) <span className="text-red-400">*</span></Label>
                    <Input
                      id="product-vat-rate"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      max="100"
                      step="0.01"
                      required
                      value={baseVatRate}
                      onChange={(event) => setBaseVatRate(event.target.value)}
                      placeholder="Örn. 20"
                      className="h-12 rounded-xl border-neutral-700 bg-neutral-950 px-3 text-sm text-neutral-100 focus-visible:ring-neutral-400"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                  <div className="space-y-2">
                    <Label htmlFor="product-category" className="text-xs font-medium text-neutral-300">Kategori <span className="text-red-400">*</span></Label>
                    <select id="product-category" name="categorySlug" required value={categorySlug} onChange={(event) => changeCategory(event.target.value)} className="h-11 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 text-sm text-neutral-100 outline-none focus:ring-2 focus:ring-neutral-400/30">
                      <option value="" disabled>Kategori seçin</option>
                      {categories.map((category) => <option key={category._id} value={category.slug}>{category.title}</option>)}
                    </select>
                  </div>
                  <label className="flex h-11 cursor-pointer items-center gap-2.5 rounded-lg border border-neutral-800 bg-neutral-950/60 px-4 text-xs font-medium text-neutral-200 hover:border-neutral-700">
                    <input type="checkbox" checked={isVariantProduct} onChange={toggleVariantProduct} className="size-4 accent-neutral-200" />
                    <Squares2X2Icon className="size-4 text-neutral-400" />
                    <span>Varyantlı ürün</span>
                  </label>
                </div>

                {categoryAttributes.length > 0 ? (
                  <section aria-labelledby="product-category-attributes-heading" className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-950/40 p-4 sm:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800/80 pb-3">
                      <h3 id="product-category-attributes-heading" className="flex items-center gap-1.5 text-sm font-semibold text-neutral-100">
                        <AdjustmentsHorizontalIcon className="size-4 text-neutral-400" />
                        Teknik Özellikler
                      </h3>
                      <span className="rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1 text-xs text-neutral-300">
                        {categoryAttributes.length} özellik
                      </span>
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2">
                      {categoryAttributes.map((attribute: CategoryAttributeDefinition) => {
                        const inputId = `product-attribute-${attribute.key}`;
                        const rawValue = attributeValues[attribute.key];

                        return (
                          <div key={attribute.key} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label htmlFor={inputId} className="text-xs font-medium text-neutral-200">
                                {attribute.label}
                                {attribute.unit ? ` (${attribute.unit})` : ""}
                                {attribute.required ? <span className="text-red-400"> *</span> : null}
                              </Label>
                              <span className="text-[10px] text-neutral-400 bg-neutral-900 px-1.5 py-0.5 rounded border border-neutral-800">
                                {attribute.type === "multiselect"
                                  ? "Çoklu Seçim"
                                  : attribute.type === "select"
                                  ? "Tekli Seçim"
                                  : attribute.type === "boolean"
                                  ? "Evet / Hayır"
                                  : attribute.type === "number"
                                  ? "Sayı"
                                  : "Metin"}
                              </span>
                            </div>

                            {attribute.type === "multiselect" ? (
                              <AttributeMultiSelect
                                attribute={attribute}
                                value={Array.isArray(rawValue) ? rawValue : []}
                                onChange={(next) =>
                                  setAttributeValues((current) => ({
                                    ...current,
                                    [attribute.key]: next,
                                  }))
                                }
                              />
                            ) : attribute.type === "select" ? (
                              <AttributeSingleSelect
                                attribute={attribute}
                                value={typeof rawValue === "string" ? rawValue : ""}
                                onChange={(next) =>
                                  setAttributeValues((current) => ({
                                    ...current,
                                    [attribute.key]: next,
                                  }))
                                }
                              />
                            ) : attribute.type === "boolean" ? (
                              <AttributeBooleanToggle
                                attribute={attribute}
                                value={typeof rawValue === "string" ? rawValue : ""}
                                onChange={(next) =>
                                  setAttributeValues((current) => ({
                                    ...current,
                                    [attribute.key]: next,
                                  }))
                                }
                              />
                            ) : attribute.type === "number" ? (
                              <AttributeNumberInput
                                attribute={attribute}
                                value={typeof rawValue === "string" ? rawValue : ""}
                                onChange={(next) =>
                                  setAttributeValues((current) => ({
                                    ...current,
                                    [attribute.key]: next,
                                  }))
                                }
                              />
                            ) : (
                              <Input
                                id={inputId}
                                type="text"
                                required={attribute.required}
                                value={typeof rawValue === "string" ? rawValue : ""}
                                onChange={(event) =>
                                  setAttributeValues((current) => ({
                                    ...current,
                                    [attribute.key]: event.target.value,
                                  }))
                                }
                                placeholder={attribute.label}
                                className="h-11 rounded-lg border-neutral-700 bg-neutral-900 text-sm text-neutral-100 placeholder:text-neutral-600"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ) : categorySlug ? (
                  <div className="rounded-xl border border-dashed border-neutral-800 bg-neutral-950/30 p-4 text-xs text-neutral-400">
                    Bu kategori için özellik tanımlanmamış.
                  </div>
                ) : null}

                {isVariantProduct ? (
                    <>
                      <section aria-label="Varyant seçenekleri" className="mb-4 space-y-3 rounded-xl border border-neutral-800 bg-neutral-950/70 p-3 sm:p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <h4 className="text-xs font-semibold text-neutral-200">Varyasyon Seçenekleri</h4>
                          <Button type="button" variant="outline" className="min-h-9 rounded-lg border-neutral-700 bg-neutral-950 px-3 text-xs text-neutral-200 hover:bg-neutral-800" disabled={variantOptions.length >= 3} onClick={addVariantOption}>
                            <PlusCircleIcon className="mr-2 size-4" /> Seçenek ekle
                          </Button>
                        </div>
                        {variantOptions.map((option, index) => (
                          <div key={option.id} className="grid gap-3 sm:grid-cols-[minmax(9rem,0.7fr)_minmax(0,1.3fr)_auto] sm:items-end">
                            <div className="space-y-1.5">
                              <Label htmlFor={`variant-option-name-${index}`} className="text-xs text-neutral-400">Seçenek adı</Label>
                              <Input id={`variant-option-name-${index}`} maxLength={40} value={option.name} onChange={(event) => setVariantOptions((current) => current.map((item) => item.id === option.id ? { ...item, name: event.target.value } : item))} placeholder="Örn. Beden" className="h-10 rounded-lg border-neutral-700 bg-neutral-950 text-sm text-neutral-100" />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs text-neutral-400">Değerler</Label>
                              <VariantOptionValuesInput
                                values={option.values}
                                onChange={(nextValues) =>
                                  setVariantOptions((current) =>
                                    current.map((item) => (item.id === option.id ? { ...item, values: nextValues } : item))
                                  )
                                }
                              />
                            </div>
                            <Button type="button" variant="ghost" className="min-h-10 px-3 text-xs text-neutral-400 hover:bg-rose-950 hover:text-rose-300" aria-label={`${option.name || `Seçenek ${index + 1}`} seçeneğini kaldır`} disabled={variantOptions.length <= 1} onClick={() => setVariantOptions((current) => current.filter((item) => item.id !== option.id))}>
                              <TrashIcon className="size-4" />
                            </Button>
                          </div>
                        ))}
                        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-neutral-800 pt-3">
                          <Button type="button" variant="secondary" className="min-h-9 rounded-lg px-3 text-xs" onClick={generateVariantRows}>
                            <ArrowPathIcon className="mr-1.5 size-3.5" />
                            Kombinasyonları oluştur
                          </Button>
                        </div>
                      </section>

                      {variantRows.length > 0 && <>
                        <div className="hidden overflow-x-auto rounded-xl border border-neutral-800 md:block">
                          <table className="w-full min-w-[760px] border-collapse text-left text-xs">
                            <thead className="bg-neutral-950 text-neutral-400">
                              <tr>
                                <th scope="col" className="px-3 py-3 font-medium">Kombinasyon</th>
                                <th scope="col" className="px-3 py-3 font-medium">SKU <span className="text-red-400">*</span></th>
                                <th scope="col" className="px-3 py-3 font-medium">Barkod</th>
                                <th scope="col" className="px-3 py-3 font-medium">Adet <span className="text-red-400">*</span></th>
                                <th scope="col" className="px-3 py-3 font-medium">Fiyat (₺) <span className="text-red-400">*</span></th>
                                <th scope="col" className="px-3 py-3 font-medium">Satışta</th>
                                <th scope="col" className="px-3 py-3 font-medium"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-800">
                              {variantRows.map((variant, index) => <tr key={variant.id ?? selectionKey(variant.selectedOptions)}>
                                <td className="min-w-36 whitespace-nowrap px-3 py-3 font-medium text-neutral-200">{variant.selectedOptions.map(({ value }) => value).join(" / ")}</td>
                                <td className="min-w-36 px-3 py-3"><Input aria-label={`Varyant ${index + 1} SKU`} maxLength={64} value={variant.sku} onChange={(event) => updateVariant(index, { sku: event.target.value })} className="h-10 rounded-lg border-neutral-700 bg-neutral-950 font-mono text-xs text-neutral-100" /></td>
                                <td className="min-w-32 px-3 py-3"><Input aria-label={`Varyant ${index + 1} Barkod`} placeholder="Barkod / GTIN" maxLength={64} value={variant.barcode ?? ""} onChange={(event) => updateVariant(index, { barcode: event.target.value })} className="h-10 rounded-lg border-neutral-700 bg-neutral-950 font-mono text-xs text-neutral-100" /></td>
                                <td className="w-20 px-2 py-3"><Input aria-label={`Varyant ${index + 1} stok adedi`} type="number" inputMode="numeric" min="0" step="1" value={variant.stockQuantity} onChange={(event) => updateVariant(index, { stockQuantity: event.target.value })} className="h-10 rounded-lg border-neutral-700 bg-neutral-950 text-xs text-neutral-100" /></td>
                                <td className="w-28 px-2 py-3"><Input aria-label={`Varyant ${index + 1} fiyatı`} type="number" inputMode="decimal" min="0" step="0.01" value={variant.price} onChange={(event) => updateVariant(index, { price: event.target.value })} className="h-10 rounded-lg border-neutral-700 bg-neutral-950 text-xs text-neutral-100" /></td>
                                <td className="px-3 py-3"><input aria-label={`Varyant ${index + 1} satışta`} type="checkbox" checked={variant.availableForSale} onChange={(event) => updateVariant(index, { availableForSale: event.target.checked })} className="size-4 accent-neutral-200" /></td>
                                <td className="px-2 py-3"><Button type="button" variant="ghost" aria-label={`Varyant ${index + 1} kombinasyonunu kaldır`} className="min-h-9 px-2 text-neutral-400 hover:bg-rose-950 hover:text-rose-300" disabled={variantRows.length <= 1} onClick={() => removeVariant(index)}><TrashIcon className="size-4" /></Button></td>
                              </tr>)}
                            </tbody>
                          </table>
                        </div>

                        <div className="space-y-3 md:hidden">
                          {variantRows.map((variant, index) => <section key={variant.id ?? selectionKey(variant.selectedOptions)} aria-label={`Varyant ${index + 1}`} className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-950/70 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex flex-wrap gap-1.5">{variant.selectedOptions.map((selected) => <span key={selected.name} className="rounded-md bg-neutral-800 px-2 py-1 text-xs text-neutral-200">{selected.name}: {selected.value}</span>)}</div>
                              <Button type="button" variant="ghost" aria-label={`Varyant ${index + 1} kombinasyonunu kaldır`} className="min-h-8 px-2 text-xs text-neutral-400 hover:bg-rose-950 hover:text-rose-300" disabled={variantRows.length <= 1} onClick={() => removeVariant(index)}><TrashIcon className="size-4" /></Button>
                            </div>
                            <div className="space-y-2"><Label htmlFor={`mobile-variant-sku-${index}`} className="text-xs text-neutral-400">SKU <span className="text-red-400">*</span></Label><Input id={`mobile-variant-sku-${index}`} maxLength={64} value={variant.sku} onChange={(event) => updateVariant(index, { sku: event.target.value })} className="h-11 rounded-lg border-neutral-700 bg-neutral-900 font-mono text-sm text-neutral-100" /></div>
                            <div className="space-y-2"><Label htmlFor={`mobile-variant-barcode-${index}`} className="text-xs text-neutral-400">Barkod</Label><Input id={`mobile-variant-barcode-${index}`} placeholder="Barkod / GTIN" maxLength={64} value={variant.barcode ?? ""} onChange={(event) => updateVariant(index, { barcode: event.target.value })} className="h-11 rounded-lg border-neutral-700 bg-neutral-900 font-mono text-sm text-neutral-100" /></div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-2"><Label htmlFor={`mobile-variant-stock-${index}`} className="text-xs text-neutral-400">Adet <span className="text-red-400">*</span></Label><Input id={`mobile-variant-stock-${index}`} type="number" inputMode="numeric" min="0" step="1" value={variant.stockQuantity} onChange={(event) => updateVariant(index, { stockQuantity: event.target.value })} className="h-11 rounded-lg border-neutral-700 bg-neutral-900 text-sm text-neutral-100" /></div>
                              <div className="space-y-2"><Label htmlFor={`mobile-variant-price-${index}`} className="text-xs text-neutral-400">Fiyat (₺) <span className="text-red-400">*</span></Label><Input id={`mobile-variant-price-${index}`} type="number" inputMode="decimal" min="0" step="0.01" value={variant.price} onChange={(event) => updateVariant(index, { price: event.target.value })} className="h-11 rounded-lg border-neutral-700 bg-neutral-900 text-sm text-neutral-100" /></div>
                            </div>
                            <label className="flex min-h-11 items-center gap-2 self-end text-xs text-neutral-300"><input type="checkbox" checked={variant.availableForSale} onChange={(event) => updateVariant(index, { availableForSale: event.target.checked })} className="size-4 accent-neutral-200" />Satışta</label>
                          </section>)}
                        </div>
                      </>}
                    </>
                  ) : (
                    <>
                    <div className="hidden overflow-x-auto rounded-xl border border-neutral-800 md:block">
                      <table className="w-full min-w-[640px] border-collapse text-left text-xs">
                        <thead className="bg-neutral-950 text-neutral-400">
                          <tr>
                            <th scope="col" className="px-3 py-3 font-medium">Ürün</th>
                            <th scope="col" className="px-3 py-3 font-medium">SKU <span className="text-red-400">*</span></th>
                            <th scope="col" className="px-3 py-3 font-medium">Barkod</th>
                            <th scope="col" className="px-3 py-3 font-medium">Adet <span className="text-red-400">*</span></th>
                            <th scope="col" className="px-3 py-3 font-medium">Fiyat (₺) <span className="text-red-400">*</span></th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="min-w-36 px-3 py-3"><div className="flex h-10 items-center rounded-lg border border-neutral-800 bg-neutral-900 px-3 text-xs text-neutral-400">Tek ürün</div></td>
                            <td className="min-w-36 px-3 py-3"><Input aria-label="Ürün SKU" name="sku" required maxLength={64} value={baseSku} onChange={(event) => setBaseSku(event.target.value)} className="h-10 rounded-lg border-neutral-700 bg-neutral-950 font-mono text-xs text-neutral-100" /></td>
                            <td className="min-w-32 px-3 py-3"><Input aria-label="Ürün Barkod" placeholder="Barkod / GTIN" maxLength={64} value={baseBarcode} onChange={(event) => setBaseBarcode(event.target.value)} className="h-10 rounded-lg border-neutral-700 bg-neutral-950 font-mono text-xs text-neutral-100" /></td>
                            <td className="w-24 px-2 py-3"><Input aria-label="Ürün stok adedi" name="stockQuantity" required type="number" inputMode="numeric" min="0" step="1" value={baseStockQuantity} onChange={(event) => setBaseStockQuantity(event.target.value)} className="h-10 rounded-lg border-neutral-700 bg-neutral-950 text-xs text-neutral-100" /></td>
                            <td className="w-28 px-2 py-3"><Input aria-label="Ürün satış fiyatı" name="price" type="number" inputMode="decimal" min="0" step="0.01" required placeholder="0,00" value={price} onChange={(event) => setPrice(event.target.value)} className="h-10 rounded-lg border-neutral-700 bg-neutral-950 text-xs font-semibold text-neutral-100 placeholder:text-neutral-600" /></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div className="space-y-3 md:hidden">
                      <section aria-label="Tek ürün" className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-950/70 p-3">
                        <span className="text-xs font-medium text-neutral-400">Tek ürün</span>
                        <div className="space-y-2"><Label htmlFor="mobile-product-sku" className="text-xs text-neutral-400">SKU <span className="text-red-400">*</span></Label><Input id="mobile-product-sku" required maxLength={64} value={baseSku} onChange={(event) => setBaseSku(event.target.value)} className="h-11 rounded-lg border-neutral-700 bg-neutral-900 font-mono text-sm text-neutral-100" /></div>
                        <div className="space-y-2"><Label htmlFor="mobile-product-barcode" className="text-xs text-neutral-400">Barkod</Label><Input id="mobile-product-barcode" placeholder="Barkod / GTIN" maxLength={64} value={baseBarcode} onChange={(event) => setBaseBarcode(event.target.value)} className="h-11 rounded-lg border-neutral-700 bg-neutral-900 font-mono text-sm text-neutral-100" /></div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2"><Label htmlFor="mobile-product-stock" className="text-xs text-neutral-400">Stok adedi <span className="text-red-400">*</span></Label><Input id="mobile-product-stock" required type="number" inputMode="numeric" min="0" step="1" value={baseStockQuantity} onChange={(event) => setBaseStockQuantity(event.target.value)} className="h-11 rounded-lg border-neutral-700 bg-neutral-900 text-sm text-neutral-100" /></div>
                          <div className="space-y-2"><Label htmlFor="mobile-product-price" className="text-xs text-neutral-400">Fiyat (₺) <span className="text-red-400">*</span></Label><Input id="mobile-product-price" type="number" inputMode="decimal" min="0" step="0.01" required placeholder="0,00" value={price} onChange={(event) => setPrice(event.target.value)} className="h-11 rounded-lg border-neutral-700 bg-neutral-900 text-sm text-neutral-100 placeholder:text-neutral-600" /></div>
                        </div>
                      </section>
                    </div>
                    </>
                  )}
              </div>
          </section>
        </div>

        {error && <AdminNotice kind="error">{error}</AdminNotice>}
        <div className="sticky bottom-0 z-20 -mx-4 flex flex-col-reverse items-stretch justify-between gap-3 border-t border-neutral-800 bg-neutral-950/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:flex-row sm:items-center sm:px-6 lg:-mx-8 lg:px-8">
          <span className="min-h-5 text-xs text-neutral-400" role="status">
            {saving ? (pendingImages.length ? "Görseller yükleniyor…" : "Kaydediliyor…") : error ? "Bilgileri kontrol edin" : ""}
          </span>
          <div className="flex flex-wrap items-center justify-end gap-2.5">
            {product ? (
              <>
                <label className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900/70 px-3 text-xs font-medium text-neutral-200 hover:border-neutral-700">
                  <input
                    type="checkbox"
                    name="availableForSale"
                    checked={availableForSale}
                    onChange={(event) => setAvailableForSale(event.target.checked)}
                    className="size-4 accent-neutral-200"
                  />
                  <GlobeAltIcon className="size-4 text-neutral-400" />
                  <span>Mağazada yayınla</span>
                </label>
                <Button type="button" variant="ghost" onClick={onCancel} className="min-h-10 text-neutral-300">
                  <XMarkIcon className="mr-1.5 size-4" />
                  Vazgeç
                </Button>
                <Button
                  type="submit"
                  disabled={saving || processingImages}
                  className="min-h-10 rounded-lg bg-neutral-100 px-5 font-semibold text-neutral-950 hover:bg-white"
                >
                  <CheckIcon className="mr-1.5 size-4" />
                  Değişiklikleri kaydet
                </Button>
              </>
            ) : (
              <>
                <Button type="button" variant="ghost" onClick={onCancel} className="min-h-10 text-neutral-300">
                  <XMarkIcon className="mr-1.5 size-4" />
                  Vazgeç
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving || processingImages}
                  onClick={() => void save(undefined, false)}
                  className="min-h-10 border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800 hover:text-white"
                >
                  <DocumentArrowDownIcon className="mr-1.5 size-4" />
                  Taslak olarak kaydet
                </Button>
                <Button
                  type="button"
                  disabled={saving || processingImages}
                  onClick={() => void save(undefined, true)}
                  className="min-h-10 rounded-lg bg-neutral-100 px-5 font-semibold text-neutral-950 hover:bg-white"
                >
                  <PlusIcon className="mr-1.5 size-4" />
                  Ürünü ekle
                </Button>
              </>
            )}
          </div>
        </div>
      </form>
    </main>
  );
}


export function ProductEditorRoute({ productId }: { productId?: string }) {
  return <ProductEditorData productId={productId} />;
}

function ProductEditorData({ productId }: { productId?: string }) {
  const router = useRouter();
  const { data: products, loading: productsLoading, error: productsError } = useAdminResource<Product[]>("products");
  const { data: categories, loading: categoriesLoading, error: categoriesError } = useAdminResource<Category[]>("categories");
  const product = productId ? products?.find((candidate) => candidate._id === productId) ?? null : null;
  const loading = categoriesLoading || (Boolean(productId) && productsLoading);
  const error = categoriesError || (productId && productsError) || null;

  if (loading) return <div className="mx-auto max-w-6xl p-6"><AdminLoading label="Ürün formu" /></div>;
  if (error) return <div className="mx-auto max-w-6xl p-6"><AdminNotice kind="error">{error}</AdminNotice></div>;
  if (productId && !product) return <div className="mx-auto max-w-6xl p-6"><AdminNotice kind="error">Ürün bulunamadı.</AdminNotice></div>;

  return (
    <ProductEditor
      key={product?._id ?? "new-product"}
      product={product}
      categories={categories ?? []}
      onCancel={() => router.push(adminPath("products"))}
      onSaved={() => {
        router.push(adminPath("products"));
      }}
    />
  );
}
