"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { Doc } from "@/convex/_generated/dataModel";
import { Button, Input, Label } from "@/components/ui";
import { AdminLoading, AdminNotice, AdminPageHeader } from "../../_components/admin-primitives";
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

type StoredImage = NonNullable<Doc<"products">["images"]>[number] & {
  url: string | null;
};
export type Product = Omit<Doc<"products">, "priceValue" | "images"> & { images: StoredImage[] };
export type Category = Doc<"categories">;
type PendingImage = { id: string; blob: Blob; fileName: string; previewUrl: string; selectedOptions?: { name: string; value: string }[] };
type VariantOptionDraft = { id: string; name: string; values: string[] };
type VariantDraft = {
  id?: string;
  selectedOptions: { name: string; value: string }[];
  sku: string;
  barcode?: string;
  price: string;
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

function normalizeOptionKey(str: string) {
  return str.trim().toLocaleLowerCase("tr-TR");
}

function selectionKey(selectedOptions: { name: string; value: string }[]) {
  return JSON.stringify(
    [...selectedOptions]
      .map((opt) => ({ name: normalizeOptionKey(opt.name), value: opt.value.trim() }))
      .sort((a, b) => a.name.localeCompare(b.name, "tr-TR"))
  );
}

function variantOptionSignature(options: { name: string; values: string[] }[]) {
  return JSON.stringify(
    options.map((option) => [
      normalizeOptionKey(option.name),
      [...option.values.map((v) => v.trim()).filter(Boolean)],
    ])
  );
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
  const [images, setImages] = useState<StoredImage[]>(product?.images || []);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [processingImages, setProcessingImages] = useState(false);
  const previewUrls = useRef<string[]>([]);
  const [availableForSale, setAvailableForSale] = useState(product?.availableForSale ?? true);
  const [variantRows, setVariantRows] = useState<VariantDraft[]>(() => {
    const existingVariants = (product?.variants ?? []).map((variant) => ({
        id: variant.id,
        selectedOptions: variant.selectedOptions.map(({ name, value }) => ({ name, value })),
        sku: variant.sku ?? "",
        barcode: variant.barcode ?? "",
        price: variant.price,
        stockQuantity: String(variant.stockQuantity),
        availableForSale: variant.availableForSale,
      }));
    return existingVariants.length ? existingVariants : [{
      id: createEditorId(),
      selectedOptions: [],
      sku: generatedVariantSku(product?.slug || "", []),
      barcode: "",
      price: "",
      stockQuantity: "0",
      availableForSale: true,
    }];
  });
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
    if (options.length === 0) {
      setError("Varyant kombinasyonlarını oluşturmak için en az bir seçenek ekleyin.");
      return;
    }
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

    const existingExactMap = new Map<string, VariantDraft>();
    for (const variant of variantRows) {
      existingExactMap.set(selectionKey(variant.selectedOptions), variant);
    }

    const usedSkus = new Set<string>();
    const claimedParentCounts = new Map<VariantDraft, number>();
    const defaultRow = variantRows.find((variant) => variant.selectedOptions.length === 0);

    const ensureUniqueSku = (candidate: string, fallbackSlug: string, selOptions: { name: string; value: string }[]) => {
      let cleaned = candidate.trim().replace(/[^A-Za-z0-9._-]/g, "").slice(0, 64);
      if (!cleaned || !/^[A-Za-z0-9]/.test(cleaned)) {
        cleaned = generatedVariantSku(fallbackSlug, selOptions);
      }
      let finalSku = cleaned;
      let counter = 2;
      while (usedSkus.has(finalSku.toLocaleUpperCase("en-US"))) {
        const suffix = `-${counter}`;
        const base = cleaned.slice(0, Math.max(1, 64 - suffix.length));
        finalSku = `${base}${suffix}`;
        counter += 1;
      }
      usedSkus.add(finalSku.toLocaleUpperCase("en-US"));
      return finalSku;
    };

    // 1. Aşama: Birebir eşleşen kombinasyonları ve onların mevcut verilerini koru
    const resolvedRows: (VariantDraft | null)[] = combinations.map((comb) => {
      const key = selectionKey(comb);
      const exact = existingExactMap.get(key);
      if (exact) {
        const sku = ensureUniqueSku(exact.sku, slug, comb);
        return {
          ...exact,
          selectedOptions: comb,
          sku,
        };
      }
      return null;
    });

    // 2. Aşama: Yeni eklenen veya değişen seçenekler için mevcut varyantlardan akıllı miras alma
    const nextVariantRows = combinations.map((comb, index) => {
      const existingResolved = resolvedRows[index];
      if (existingResolved) return existingResolved;

      // En çok ortak seçeneğe sahip mevcut satırı bul
      let bestMatch: VariantDraft | null = null;
      let bestScore = 0;

      for (const row of variantRows) {
        let score = 0;
        for (const rowOpt of row.selectedOptions) {
          const matchingCombOpt = comb.find(
            (c) => normalizeOptionKey(c.name) === normalizeOptionKey(rowOpt.name)
          );
          if (matchingCombOpt) {
            if (matchingCombOpt.value.trim() === rowOpt.value.trim()) {
              score += 10;
            }
          } else {
            const valueMatch = comb.some((c) => c.value.trim() === rowOpt.value.trim());
            if (valueMatch) {
              score += 5;
            }
          }
        }
        if (score > bestScore) {
          bestScore = score;
          bestMatch = row;
        }
      }

      if (bestMatch && bestScore > 0) {
        const claimCount = claimedParentCounts.get(bestMatch) ?? 0;
        claimedParentCounts.set(bestMatch, claimCount + 1);

        const addedOptions = comb.filter(
          (c) => !bestMatch!.selectedOptions.some((p) => normalizeOptionKey(p.name) === normalizeOptionKey(c.name))
        );

        let candidateSku = "";
        if (bestMatch.sku) {
          const addedSuffix = addedOptions
            .map((opt) => slugify(opt.value).toUpperCase().replace(/[^A-Z0-9._-]/g, ""))
            .filter(Boolean)
            .join("-");

          if (addedSuffix) {
            candidateSku = `${bestMatch.sku}-${addedSuffix}`;
          } else if (claimCount === 0) {
            candidateSku = bestMatch.sku;
          } else {
            candidateSku = `${bestMatch.sku}-${claimCount + 1}`;
          }
        } else {
          candidateSku = generatedVariantSku(slug, comb);
        }

        const sku = ensureUniqueSku(candidateSku, slug, comb);

        return {
          id: claimCount === 0 && bestMatch.id ? bestMatch.id : createEditorId(),
          selectedOptions: comb,
          sku,
          barcode: claimCount === 0 ? (bestMatch.barcode ?? "") : "",
          price: bestMatch.price || defaultRow?.price || variantRows[0]?.price || "",
          stockQuantity: "0",
          availableForSale: bestMatch.availableForSale ?? true,
        };
      }

      if (defaultRow && index === 0) {
        return {
          ...defaultRow,
          selectedOptions: comb,
          sku: ensureUniqueSku(defaultRow.sku, slug, comb),
        };
      }

      const sku = ensureUniqueSku(generatedVariantSku(slug, comb), slug, comb);
      return {
        id: createEditorId(),
        selectedOptions: comb,
        sku,
        barcode: "",
        price: defaultRow?.price || variantRows[0]?.price || "",
        stockQuantity: "0",
        availableForSale: true,
      };
    });

    setVariantRows(nextVariantRows);
    setImages((current) => current.map((image) => {
      const selectedOptions = image.selectedOptions?.filter(({ name, value }) =>
        options.some((option) => normalizeOptionKey(option.name) === normalizeOptionKey(name) && option.values.includes(value)),
      );
      return { ...image, selectedOptions: selectedOptions?.length ? selectedOptions : undefined };
    }));
    setPendingImages((current) => current.map((image) => {
      const selectedOptions = image.selectedOptions?.filter(({ name, value }) =>
        options.some((option) => normalizeOptionKey(option.name) === normalizeOptionKey(name) && option.values.includes(value)),
      );
      return { ...image, selectedOptions: selectedOptions?.length ? selectedOptions : undefined };
    }));
    setGeneratedOptionSignature(variantOptionSignature(options));
    setError(null);
  };

  const removeVariantOption = (optionId: string) => {
    const nextOptions = variantOptions.filter((option) => option.id !== optionId);
    if (nextOptions.length > 0) {
      setVariantOptions(nextOptions);
      return;
    }

    const hasCombinations = variantRows.some((variant) => variant.selectedOptions.length > 0);
    if (hasCombinations && variantRows.length > 1 && !window.confirm(
      "Seçenekleri kaldırınca kombinasyonlar silinecek. İlk kombinasyonun SKU, fiyat ve stoku korunacak. Devam edilsin mi?",
    )) return;

    const firstVariant = variantRows[0];
    if (firstVariant) setVariantRows([{ ...firstVariant, selectedOptions: [] }]);
    setVariantOptions([]);
    setGeneratedOptionSignature(variantOptionSignature([]));
    setImages((current) => current.map((image) => ({ ...image, selectedOptions: undefined })));
    setPendingImages((current) => current.map((image) => ({ ...image, selectedOptions: undefined })));
    setError(null);
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
    if (images.length + pendingImages.length + files.length > 20) {
      setError("Bir üründe en fazla 20 görsel olabilir.");
      return;
    }

    setProcessingImages(true);
    setError(null);
    try {
      const nextImages: PendingImage[] = [];
      for (const [index, file] of files.entries()) {
        const blob = await convertImageToWebp(file);
        const position = images.length + pendingImages.length + index;
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
    return {
      storageId: uploaded.storageId as StoredImage["storageId"], fileName, url,
      ...(image.selectedOptions?.length ? { selectedOptions: image.selectedOptions } : {}),
    };
  };

  const save = async (event?: React.FormEvent<HTMLFormElement>, publishStatusOverride?: boolean) => {
    if (event) event.preventDefault();
    const targetAvailableForSale = publishStatusOverride !== undefined ? publishStatusOverride : availableForSale;
    const activeVariantRows = variantRows;
    const activeOptions = variantOptions.map((option) => ({
      id: option.id,
      name: option.name.trim(),
      values: option.values.map((v) => v.trim()).filter(Boolean),
    }));
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
    if (activeVariantRows.length === 0) {
      setError("Ürün için en az bir kombinasyon gerekli.");
      return;
    }
    if (activeVariantRows.length > 100) {
      setError("Bir üründe en fazla 100 kombinasyon olabilir.");
      return;
    }
    if (activeOptions.some((option) => !option.name || option.values.length === 0)) {
      setError("Her seçenek için bir ad ve en az bir değer gir.");
      return;
    }
    if (variantOptionSignature(activeOptions) !== generatedOptionSignature) {
      setError("Seçenekleri değiştirdin. Tabloyu güncellemek için 'Kombinasyonları oluştur' butonuna tıkla.");
      return;
    }
    if (new Set(activeOptions.map((option) => option.name.toLocaleLowerCase("tr-TR"))).size !== activeOptions.length) {
      setError("Seçenek adları birbirinden farklı olmalı.");
      return;
    }
    if (activeOptions.some((option) => new Set(option.values.map((value) => value.toLocaleLowerCase("tr-TR"))).size !== option.values.length)) {
      setError("Aynı seçenek değerini birden fazla ekleme.");
      return;
    }
    const combinationCount = activeOptions.reduce((count, option) => count * option.values.length, 1);
    if (combinationCount > 100) {
      setError("Bir üründe en fazla 100 kombinasyon olabilir.");
      return;
    }
    if ((activeOptions.length === 0 && activeVariantRows.length !== 1) || activeVariantRows.some((variant) =>
      variant.selectedOptions.length !== activeOptions.length ||
      activeOptions.some((option) => !variant.selectedOptions.some((selected) => normalizeOptionKey(selected.name) === normalizeOptionKey(option.name) && option.values.includes(selected.value))),
    )) {
      setError("Kombinasyon tablosunu güncel seçeneklerle yeniden oluştur.");
      return;
    }
    if (new Set(activeVariantRows.map((variant) => selectionKey(variant.selectedOptions))).size !== activeVariantRows.length) {
      setError("Kombinasyonlar birbirinden farklı olmalı.");
      return;
    }
    for (const draft of activeVariantRows) {
      const variantSku = draft.sku.trim();
      if (!variantSku) {
        setError("Her kombinasyon için ayrı bir SKU girin.");
        return;
      }
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(variantSku)) {
        setError("SKU 1-64 karakter olmalı ve yalnızca harf, rakam, nokta, alt çizgi veya tire içermeli.");
        return;
      }
      if (!/^\d+(?:[.,]\d{1,2})?$/.test(draft.price.trim()) || !Number.isSafeInteger(Math.round(Number(draft.price.replace(",", ".")) * 100))) {
      setError("Her kombinasyon için geçerli bir satış fiyatı gir.");
        return;
      }
      if (!/^\d+$/.test(draft.stockQuantity) || !Number.isSafeInteger(Number(draft.stockQuantity))) {
        setError("Her kombinasyon için sıfır veya daha büyük tam sayı stok gir.");
        return;
      }
    }
    if (new Set(activeVariantRows.map((variant) => variant.sku.trim().toLocaleUpperCase("en-US"))).size !== activeVariantRows.length) {
      setError("Her kombinasyonun SKU kodu birbirinden farklı olmalı.");
      return;
    }
    if (images.length + pendingImages.length > 20) {
      setError("Bir üründe en fazla 20 görsel olabilir.");
      return;
    }
    setSaving(true);
    setError(null);
    const input = {
      ...(product ? { id: product._id } : {}),
      title: title.trim(),
      slug: slug.trim(),
      categorySlug,
      attributes: productAttributes,
      images: [],
      availableForSale: targetAvailableForSale,
      options: activeOptions,
      variants: activeVariantRows.map((variant) => {
        const selectedOptions = variant.selectedOptions;
        return {
          id: variant.id || createEditorId(),
          sku: variant.sku.trim(),
          ...(variant.barcode?.trim() ? { barcode: variant.barcode.trim() } : {}),
          title: selectedOptions.map(({ value }) => value).join(" / ") || "Ürünün kendisi",
          selectedOptions,
          price: variant.price.trim().replace(",", "."),
          stockQuantity: Number(variant.stockQuantity),
          availableForSale: variant.availableForSale,
        };
      }),
    };

    try {
      const uploadedImages: StoredImage[] = [];
      for (const [index, image] of pendingImages.entries()) {
        uploadedImages.push(await uploadPendingImage(
          image,
          productImageFileName(title || slug || "urun", images.length + index),
        ));
      }
      await runAdminAction(product ? "product.update" : "product.create", {
        ...input,
        images: [...images, ...uploadedImages].map((image) => ({
          storageId: image.storageId,
          fileName: image.fileName,
          ...(image.selectedOptions?.length ? { selectedOptions: image.selectedOptions } : {}),
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
    <div className="scheme-dark w-full text-foreground">
      <AdminPageHeader
        title={title || (product ? "Ürün detayları" : "Yeni ürün")}
        description={product
          ? "Ürün bilgilerini, görsellerini ve varyantlarını düzenleyin."
          : "Yeni ürünün bilgilerini, görsellerini ve varyantlarını tanımlayın."}
      />

      <form onSubmit={save} className="space-y-5">
        <div className="space-y-5">
          <section aria-label="Görseller" className="space-y-4 rounded-2xl border border-border bg-card/70 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-foreground">Görseller</h2>
              <label htmlFor="product-image-upload" className={`inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:border-border hover:bg-muted ${processingImages || saving ? "pointer-events-none opacity-60" : ""}`}>
                <PlusCircleIcon className="size-4" />
                <span>{processingImages ? "Hazırlanıyor…" : "Görsel ekle"}</span>
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{images.length + pendingImages.length}/20</span>
              </label>
            </div>
            <input id="product-image-upload" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={saving || processingImages} onChange={(event) => void handleImageSelection(event)} className="sr-only" />
            {(images.length > 0 || pendingImages.length > 0) ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {images.map((image) => <div key={image.storageId} className="group overflow-hidden rounded-xl border border-border bg-background">
                <div className="relative aspect-[4/5] overflow-hidden bg-card">
                  {image.url ? <Image src={image.url} alt={title} width={400} height={500} unoptimized className="size-full object-cover" /> : null}
                  <Button type="button" size="icon" variant="secondary" aria-label={`Görseli kaldır: ${image.fileName}`} title="Görseli kaldır" disabled={saving} className="absolute right-2 top-2 size-9 rounded-full border border-white/10 bg-background/90 text-foreground opacity-100 hover:bg-muted hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100" onClick={() => setImages((current) => current.filter((item) => item.storageId !== image.storageId))}>
                    <TrashIcon className="size-4" />
                  </Button>
                </div>
                {variantOptions.length > 0 && <select aria-label={`${image.fileName} görsel kapsamı`} disabled={saving} value={JSON.stringify(image.selectedOptions ?? [])} onChange={(event) => {
                  const selectedOptions: { name: string; value: string }[] = JSON.parse(event.target.value) as { name: string; value: string }[];
                  setImages((current) => current.map((item) => item.storageId === image.storageId
                    ? { ...item, selectedOptions: selectedOptions.length ? selectedOptions : undefined }
                    : item));
                }} className="mx-2 mb-2 mt-2 h-10 w-[calc(100%-1rem)] rounded-md border border-border bg-card px-2.5 text-xs text-foreground outline-none focus-visible:border-border">
                  <option value="[]">Tüm varyantlarda</option>
                  {variantOptions.flatMap((option) => option.values.map((value) => {
                    const scope = [{ name: option.name, value }];
                    return <option key={`${option.id}:${value}`} value={JSON.stringify(scope)}>{option.name}: {value}</option>;
                  }))}
                </select>}
              </div>)}
              {pendingImages.map((image) => <div key={image.id} className="group overflow-hidden rounded-xl border border-border bg-background">
                <div className="relative aspect-[4/5] overflow-hidden bg-card">
                  <Image src={image.previewUrl} alt={title} width={400} height={500} unoptimized className="size-full object-cover" />
                  <Button type="button" size="icon" variant="secondary" aria-label={`Görseli kaldır: ${image.fileName}`} title="Görseli kaldır" disabled={saving} className="absolute right-2 top-2 size-9 rounded-full border border-white/10 bg-background/90 text-foreground opacity-100 hover:bg-muted hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100" onClick={() => removePendingImage(image)}>
                    <TrashIcon className="size-4" />
                  </Button>
                </div>
                {variantOptions.length > 0 && <select aria-label={`${image.fileName} görsel kapsamı`} disabled={saving} value={JSON.stringify(image.selectedOptions ?? [])} onChange={(event) => {
                  const selectedOptions: { name: string; value: string }[] = JSON.parse(event.target.value) as { name: string; value: string }[];
                  setPendingImages((current) => current.map((item) => item.id === image.id
                    ? { ...item, selectedOptions: selectedOptions.length ? selectedOptions : undefined }
                    : item));
                }} className="mx-2 mb-2 mt-2 h-10 w-[calc(100%-1rem)] rounded-md border border-border bg-card px-2.5 text-xs text-foreground outline-none focus-visible:border-border">
                  <option value="[]">Tüm varyantlarda</option>
                  {variantOptions.flatMap((option) => option.values.map((value) => {
                    const scope = [{ name: option.name, value }];
                    return <option key={`${option.id}:${value}`} value={JSON.stringify(scope)}>{option.name}: {value}</option>;
                  }))}
                </select>}
              </div>)}
            </div> : <div className="rounded-xl border border-dashed border-border bg-background/50 px-4 py-5 text-center text-xs text-muted-foreground">Henüz görsel eklenmedi</div>}
          </section>
          <section aria-label="Ürün Bilgileri" className="rounded-2xl border border-border bg-card/70 p-4 sm:p-6">
            <div className="space-y-5">
              <h2 className="text-sm font-semibold text-foreground">Ürün Bilgileri</h2>
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="product-title" className="text-xs font-medium text-muted-foreground">Ürün adı <span className="text-destructive">*</span></Label>
                  <Input id="product-title" name="title" autoComplete="off" required minLength={2} maxLength={140} placeholder="Ürün adı" value={title} onChange={(event) => {
                    const nextTitle = event.target.value;
                    setTitle(nextTitle);
                    setSlug(slugify(nextTitle));
                  }} className="h-12 rounded-xl border-border bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-ring" />
                </div>
              </div>

              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="product-category" className="text-xs font-medium text-muted-foreground">Kategori <span className="text-destructive">*</span></Label>
                  <select id="product-category" name="categorySlug" required value={categorySlug} onChange={(event) => changeCategory(event.target.value)} className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/30">
                    <option value="" disabled>Kategori seçin</option>
                    {categories.map((category) => <option key={category._id} value={category.slug}>{category.title}</option>)}
                  </select>
                </div>
              </div>

              {categoryAttributes.length > 0 ? (
                <section aria-labelledby="product-category-attributes-heading" className="space-y-4 rounded-xl border border-border bg-background/40 p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                    <h3 id="product-category-attributes-heading" className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      <AdjustmentsHorizontalIcon className="size-4 text-muted-foreground" />
                      Teknik Özellikler
                    </h3>
                    <span className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground">
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
                            <Label htmlFor={inputId} className="text-xs font-medium text-foreground">
                              {attribute.label}
                              {attribute.unit ? ` (${attribute.unit})` : ""}
                              {attribute.required ? <span className="text-destructive"> *</span> : null}
                            </Label>
                            <span className="text-[10px] text-muted-foreground bg-card px-1.5 py-0.5 rounded border border-border">
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
                              className="h-11 rounded-lg border-border bg-card text-sm text-foreground placeholder:text-muted-foreground"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              ) : categorySlug ? (
                <div className="rounded-xl border border-dashed border-border bg-background/30 p-4 text-xs text-muted-foreground">
                  Bu kategori için özellik tanımlanmamış.
                </div>
              ) : null}
            </div>
          </section>

          <section aria-label="Varyantlar" className="rounded-2xl border border-border bg-card/70 p-4 sm:p-6">
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-foreground">Varyantlar</h2>
              </div>
                  <section aria-label="Varyant seçenekleri" className="mb-4 space-y-3 rounded-xl border border-border bg-background/70 p-3 sm:p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h4 className="text-xs font-semibold text-foreground">Varyant seçenekleri</h4>
                      <Button type="button" variant="outline" className="min-h-9 rounded-lg border-border bg-background px-3 text-xs text-foreground hover:bg-muted" disabled={variantOptions.length >= 3} onClick={addVariantOption}>
                        <PlusCircleIcon className="mr-2 size-4" /> Seçenek ekle
                      </Button>
                    </div>
                    {variantOptions.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                        Seçenek eklemeden ürün tek kombinasyon olarak kaydedilir.
                      </div>
                    ) : (
                      variantOptions.map((option, index) => (
                        <div key={option.id} className="grid gap-3 sm:grid-cols-[minmax(9rem,0.7fr)_minmax(0,1.3fr)_auto] sm:items-end">
                          <div className="space-y-1.5">
                            <Label htmlFor={`variant-option-name-${index}`} className="text-xs text-muted-foreground">Seçenek adı</Label>
                            <Input id={`variant-option-name-${index}`} maxLength={40} value={option.name} onChange={(event) => setVariantOptions((current) => current.map((item) => item.id === option.id ? { ...item, name: event.target.value } : item))} placeholder="Örn. Beden" className="h-10 rounded-lg border-border bg-background text-sm text-foreground" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Değerler</Label>
                            <VariantOptionValuesInput
                              values={option.values}
                              onChange={(nextValues) =>
                                setVariantOptions((current) =>
                                  current.map((item) => (item.id === option.id ? { ...item, values: nextValues } : item))
                                )
                              }
                            />
                          </div>
                          <Button type="button" variant="ghost" className="min-h-10 px-3 text-xs text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`${option.name || `Seçenek ${index + 1}`} seçeneğini kaldır`} onClick={() => removeVariantOption(option.id)}>
                            <TrashIcon className="size-4" />
                          </Button>
                        </div>
                      ))
                    )}
                    {variantOptions.length > 0 && <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-3">
                      <Button type="button" variant="secondary" className="min-h-9 rounded-lg px-3 text-xs" onClick={generateVariantRows}>
                        <ArrowPathIcon className="mr-1.5 size-3.5" />
                        Kombinasyonları oluştur
                      </Button>
                    </div>}
                  </section>

                  <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
                      <table className="w-full min-w-[760px] border-collapse text-left text-xs">
                        <thead className="bg-background text-muted-foreground">
                          <tr>
                            <th scope="col" className="px-3 py-3 font-medium">Kombinasyon</th>
                            <th scope="col" className="px-3 py-3 font-medium">SKU <span className="text-destructive">*</span></th>
                            <th scope="col" className="px-3 py-3 font-medium">Barkod</th>
                            <th scope="col" className="px-3 py-3 font-medium">Fiyat (₺) <span className="text-destructive">*</span></th>
                            <th scope="col" className="px-3 py-3 font-medium">Stok</th>
                            <th scope="col" className="px-3 py-3 font-medium">Satışta</th>
                            <th scope="col" className="px-3 py-3 font-medium"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {variantRows.map((variant, index) => <tr key={variant.id ?? selectionKey(variant.selectedOptions)}>
                            <td className="min-w-36 whitespace-nowrap px-3 py-3 font-medium text-foreground">{variant.selectedOptions.map(({ value }) => value).join(" / ") || "Tek ürün"}</td>
                            <td className="min-w-36 px-3 py-3"><Input aria-label={`Kombinasyon ${index + 1} SKU`} maxLength={64} value={variant.sku} onChange={(event) => updateVariant(index, { sku: event.target.value })} className="h-10 rounded-lg border-border bg-background font-mono text-xs text-foreground" /></td>
                            <td className="min-w-32 px-3 py-3"><Input aria-label={`Kombinasyon ${index + 1} Barkod`} placeholder="Barkod / GTIN" maxLength={64} value={variant.barcode ?? ""} onChange={(event) => updateVariant(index, { barcode: event.target.value })} className="h-10 rounded-lg border-border bg-background font-mono text-xs text-foreground" /></td>
                            <td className="w-28 px-2 py-3"><Input aria-label={`Kombinasyon ${index + 1} fiyatı`} type="number" inputMode="decimal" min="0" step="0.01" value={variant.price} onChange={(event) => updateVariant(index, { price: event.target.value })} className="h-10 rounded-lg border-border bg-background text-xs text-foreground" /></td>
                            <td className="w-24 px-2 py-3"><Input aria-label={`Kombinasyon ${index + 1} stok adedi`} type="number" inputMode="numeric" min="0" step="1" value={variant.stockQuantity} onChange={(event) => updateVariant(index, { stockQuantity: event.target.value })} className="h-10 rounded-lg border-border bg-background text-xs text-foreground" /></td>
                            <td className="px-3 py-3"><input aria-label={`Kombinasyon ${index + 1} satışta`} type="checkbox" checked={variant.availableForSale} onChange={(event) => updateVariant(index, { availableForSale: event.target.checked })} className="size-4 accent-foreground" /></td>
                            <td className="px-2 py-3"><Button type="button" variant="ghost" aria-label={`Kombinasyon ${index + 1} seçeneğini kaldır`} className="min-h-9 px-2 text-muted-foreground hover:bg-muted hover:text-foreground" disabled={variantRows.length <= 1} onClick={() => removeVariant(index)}><TrashIcon className="size-4" /></Button></td>
                          </tr>)}
                        </tbody>
                      </table>
                    </div>

                    <div className="space-y-3 md:hidden">
                      {variantRows.map((variant, index) => <section key={variant.id ?? selectionKey(variant.selectedOptions)} aria-label={`Kombinasyon ${index + 1}`} className="space-y-3 rounded-xl border border-border bg-background/70 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex flex-wrap gap-1.5">{variant.selectedOptions.length > 0 ? variant.selectedOptions.map((selected) => <span key={selected.name} className="rounded-md bg-muted px-2 py-1 text-xs text-foreground">{selected.name}: {selected.value}</span>) : <span className="text-xs text-muted-foreground">Tek ürün</span>}</div>
                          <Button type="button" variant="ghost" aria-label={`Kombinasyon ${index + 1} seçeneğini kaldır`} className="min-h-8 px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground" disabled={variantRows.length <= 1} onClick={() => removeVariant(index)}><TrashIcon className="size-4" /></Button>
                        </div>
                        <div className="space-y-2"><Label htmlFor={`mobile-variant-sku-${index}`} className="text-xs text-muted-foreground">SKU <span className="text-destructive">*</span></Label><Input id={`mobile-variant-sku-${index}`} maxLength={64} value={variant.sku} onChange={(event) => updateVariant(index, { sku: event.target.value })} className="h-11 rounded-lg border-border bg-card font-mono text-sm text-foreground" /></div>
                        <div className="space-y-2"><Label htmlFor={`mobile-variant-barcode-${index}`} className="text-xs text-muted-foreground">Barkod</Label><Input id={`mobile-variant-barcode-${index}`} placeholder="Barkod / GTIN" maxLength={64} value={variant.barcode ?? ""} onChange={(event) => updateVariant(index, { barcode: event.target.value })} className="h-11 rounded-lg border-border bg-card font-mono text-sm text-foreground" /></div>
                        <div className="space-y-2"><Label htmlFor={`mobile-variant-price-${index}`} className="text-xs text-muted-foreground">Fiyat (₺) <span className="text-destructive">*</span></Label><Input id={`mobile-variant-price-${index}`} type="number" inputMode="decimal" min="0" step="0.01" value={variant.price} onChange={(event) => updateVariant(index, { price: event.target.value })} className="h-11 rounded-lg border-border bg-card text-sm text-foreground" /></div>
                        <div className="space-y-2"><Label htmlFor={`mobile-variant-stock-${index}`} className="text-xs text-muted-foreground">Stok adedi</Label><Input id={`mobile-variant-stock-${index}`} type="number" inputMode="numeric" min="0" step="1" value={variant.stockQuantity} onChange={(event) => updateVariant(index, { stockQuantity: event.target.value })} className="h-11 rounded-lg border-border bg-card text-sm text-foreground" /></div>
                        <label className="flex min-h-11 items-center gap-2 self-end text-xs text-muted-foreground"><input type="checkbox" checked={variant.availableForSale} onChange={(event) => updateVariant(index, { availableForSale: event.target.checked })} className="size-4 accent-foreground" />Satışta</label>
                      </section>)}
                  </div>
            </div>
          </section>
        </div>

        {error && <AdminNotice kind="error">{error}</AdminNotice>}
        <div className="sticky bottom-0 z-20 -mx-4 flex flex-col-reverse items-stretch justify-between gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:flex-row sm:items-center sm:px-6 lg:-mx-8 lg:px-8">
          <span className="min-h-5 text-xs text-muted-foreground" role="status">
            {saving ? (pendingImages.length ? "Görseller yükleniyor…" : "Kaydediliyor…") : error ? "Bilgileri kontrol edin" : ""}
          </span>
          <div className="flex flex-wrap items-center justify-end gap-2.5">
            {product ? (
              <>
                <label className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-border bg-card/70 px-3 text-xs font-medium text-foreground hover:border-border">
                  <input
                    type="checkbox"
                    name="availableForSale"
                    checked={availableForSale}
                    onChange={(event) => setAvailableForSale(event.target.checked)}
                    className="size-4 accent-foreground"
                  />
                  <GlobeAltIcon className="size-4 text-muted-foreground" />
                  <span>Mağazada yayınla</span>
                </label>
                <Button type="button" variant="ghost" onClick={onCancel} className="min-h-10 text-muted-foreground">
                  <XMarkIcon className="mr-1.5 size-4" />
                  Vazgeç
                </Button>
                <Button
                  type="submit"
                  disabled={saving || processingImages}
                  className="min-h-10 rounded-lg bg-muted px-5 font-semibold text-foreground hover:bg-white"
                >
                  <CheckIcon className="mr-1.5 size-4" />
                  Değişiklikleri kaydet
                </Button>
              </>
            ) : (
              <>
                <Button type="button" variant="ghost" onClick={onCancel} className="min-h-10 text-muted-foreground">
                  <XMarkIcon className="mr-1.5 size-4" />
                  Vazgeç
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving || processingImages}
                  onClick={() => void save(undefined, false)}
                  className="min-h-10 border-border bg-card text-foreground hover:bg-muted hover:text-foreground"
                >
                  <DocumentArrowDownIcon className="mr-1.5 size-4" />
                  Taslak olarak kaydet
                </Button>
                <Button
                  type="button"
                  disabled={saving || processingImages}
                  onClick={() => void save(undefined, true)}
                  className="min-h-10 rounded-lg bg-muted px-5 font-semibold text-foreground hover:bg-white"
                >
                  <PlusIcon className="mr-1.5 size-4" />
                  Ürünü ekle
                </Button>
              </>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}


export function ProductEditorRoute({ productId }: { productId?: string }) {
  return <ProductEditorData productId={productId} />;
}

function ProductEditorData({ productId }: { productId?: string }) {
  const router = useRouter();
  const { data: productData, loading: productsLoading, error: productsError } = useAdminResource<{ product: Product | null }>("product", productId ? { id: productId } : {});
  const { data: categories, loading: categoriesLoading, error: categoriesError } = useAdminResource<Category[]>("categories");
  const product = productData?.product ?? null;
  const loading = categoriesLoading || (Boolean(productId) && productsLoading);
  const error = categoriesError || (productId && productsError) || null;

  if (loading) return <AdminLoading label="Ürün formu" variant="form" />;
  if (error) return <div className="w-full"><AdminNotice kind="error">{error}</AdminNotice></div>;
  if (productId && !product) return <div className="w-full"><AdminNotice kind="error">Ürün bulunamadı.</AdminNotice></div>;

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
