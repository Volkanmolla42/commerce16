"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminLoading, AdminNotice } from "../../_components/admin-primitives";
import { runAdminAction, useAdminResource } from "../../_components/admin-api";
import { slugify } from "@/lib/text";
import { adminPath } from "@/lib/admin/routes";
import { type ProductAttribute } from "@/lib/catalog/attributes";
import {
  CheckIcon,
  DocumentArrowDownIcon,
  GlobeAltIcon,
  PlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  convertImageToWebp,
  createEditorId,
  flushExitState,
  generatedVariantSku,
  getVariantCombinations,
  imagesPayload,
  minimalDraftPayload,
  normalizeOptionKey,
  productImageFileName,
  resolveUploadedImages,
  selectionKey,
  toResolvedPendingImage,
  uploadWebpToStorage,
  variantOptionSignature,
  type Category,
  type ExitState,
  type PendingImage,
  type Product,
  type StoredImage,
  type VariantDraft,
  type VariantOptionDraft,
} from "./product-editor-helpers";
import { ProductAttributesSection } from "./product-attributes-section";
import { ProductDescriptionSection } from "./product-description-section";
import { ProductImagesSection } from "./product-images-section";
import { ProductVariantsSection } from "./product-variants-section";

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
  const slugRef = useRef(product?.slug || "");
  const [variantOptions, setVariantOptions] = useState<VariantOptionDraft[]>(() =>
    (product?.options ?? []).map((option) => ({ ...option, values: option.values })),
  );
  const generatedOptionSignature = useRef<string | null>(null);
  useEffect(() => {
    generatedOptionSignature.current = variantOptionSignature(product?.options ?? []);
  }, [product]);
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

  const moveImage = (index: number, step: -1 | 1) => {
    setImages((current) => {
      const target = index + step;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  };

  const movePendingImage = (index: number, step: -1 | 1) => {
    setPendingImages((current) => {
      const target = index + step;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  };
  const [processingImages, setProcessingImages] = useState(false);
  const previewUrls = useRef<string[]>([]);
  const savedRef = useRef(false);
  const exitStateRef = useRef<ExitState | null>(null);
  const [availableForSale, setAvailableForSale] = useState(product?.availableForSale ?? true);
  const [variantRows, setVariantRows] = useState<VariantDraft[]>(() => {
    const existingVariants = (product?.variants ?? []).map((variant) => ({
        id: variant.id,
        selectedOptions: variant.selectedOptions.map(({ name, value }) => ({ name, value })),
        sku: variant.sku ?? "",
        barcode: variant.barcode ?? "",
        price: variant.price,
        compareAtPrice: variant.compareAtPrice ?? "",
        stockQuantity: String(variant.stockQuantity),
        availableForSale: variant.availableForSale,
      }));
    return existingVariants.length ? existingVariants : [{
      id: createEditorId(),
      selectedOptions: [],
      sku: generatedVariantSku(product?.slug || createEditorId(), []),
      barcode: "",
      price: "",
      compareAtPrice: "",
      stockQuantity: "0",
      availableForSale: true,
    }];
  });
  const [description, setDescription] = useState(product?.description ?? "");
  const [descriptionImages, setDescriptionImages] = useState<{ storageId: string; url: string | null }[]>(
    product?.descriptionImages?.map((image) => ({ storageId: String(image.storageId), url: image.url })) ?? [],
  );
  const galleryPendingImages = pendingImages.filter((image) => image.kind === "gallery");
  const descriptionPendingImages = pendingImages.filter((image) => image.kind === "description");
  const descriptionImageLimitReached = descriptionImages.length + descriptionPendingImages.length >= 12;
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const categoryAttributes = categories.find((category) => category.slug === categorySlug)?.attributes ?? [];

  useEffect(() => {
    exitStateRef.current = {
      isExisting: Boolean(product),
      saved: savedRef.current,
      title,
      slug: slugRef.current,
      categorySlug,
      description,
      descriptionImageStorageIds: [
        ...descriptionImages.map((image) => image.storageId),
        ...descriptionPendingImages.flatMap((image) => image.storageId ? [image.storageId] : []),
      ],
      attributeValues,
      categoryAttributes,
      variantOptions,
      variantRows,
      pendingImages,
    };
  });

  const uploadingCount = galleryPendingImages.filter((image) => image.status === "uploading").length;
  const uploadedCount = galleryPendingImages.filter((image) => image.status === "uploaded").length;
  const failedCount = galleryPendingImages.filter((image) => image.status === "error").length;

  const changeCategory = (nextSlug: string) => {
    setCategorySlug(nextSlug);
    const nextKeys = new Set(categories.find((category) => category.slug === nextSlug)?.attributes?.map((attribute) => attribute.key) ?? []);
    setAttributeValues((current) => Object.fromEntries(Object.entries(current).filter(([key]) => nextKeys.has(key))));
  };

  useEffect(() => () => {
    for (const url of previewUrls.current) URL.revokeObjectURL(url);
  }, []);

  useEffect(() => {
    const mountedAt = Date.now();
    return () => {
      // StrictMode dev'de efekti çift çalıştırır; koruma yalnızca dev'de, prod tam davranır.
      if (process.env.NODE_ENV === "development" && Date.now() - mountedAt < 1500) return;
      const state = exitStateRef.current;
      if (!state || state.saved) return;
      void flushExitState(state);
    };
  }, []);

  useEffect(() => {
    const handler = () => {
      const state = exitStateRef.current;
      if (!state || state.saved) return;
      const uploaded = state.pendingImages.filter((image) => image.storageId).map(toResolvedPendingImage);
      if (uploaded.length === 0) return;
      if (state.isExisting) {
        for (const image of uploaded) {
          navigator.sendBeacon("/api/admin", new Blob(
            [JSON.stringify({ action: "product.image-discard", input: { storageId: image.storageId } })],
            { type: "application/json" },
          ));
        }
        return;
      }
      navigator.sendBeacon("/api/admin", new Blob(
        [JSON.stringify({ action: "product.create", input: minimalDraftPayload(uploaded, state.descriptionImageStorageIds) })],
        { type: "application/json" },
      ));
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
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
        const sku = ensureUniqueSku(exact.sku, slugRef.current, comb);
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
          candidateSku = generatedVariantSku(slugRef.current, comb);
        }

        const sku = ensureUniqueSku(candidateSku, slugRef.current, comb);

        return {
          id: claimCount === 0 && bestMatch.id ? bestMatch.id : createEditorId(),
          selectedOptions: comb,
          sku,
          barcode: claimCount === 0 ? (bestMatch.barcode ?? "") : "",
          price: bestMatch.price || defaultRow?.price || variantRows[0]?.price || "",
          compareAtPrice: bestMatch.compareAtPrice || "",
          stockQuantity: "0",
          availableForSale: bestMatch.availableForSale ?? true,
        };
      }

      if (defaultRow && index === 0) {
        return {
          ...defaultRow,
          selectedOptions: comb,
          sku: ensureUniqueSku(defaultRow.sku, slugRef.current, comb),
        };
      }

      const sku = ensureUniqueSku(generatedVariantSku(slugRef.current, comb), slugRef.current, comb);
      return {
        id: createEditorId(),
        selectedOptions: comb,
        sku,
        barcode: "",
        price: defaultRow?.price || variantRows[0]?.price || "",
        compareAtPrice: defaultRow?.compareAtPrice || variantRows[0]?.compareAtPrice || "",
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
    generatedOptionSignature.current = variantOptionSignature(options);
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
    generatedOptionSignature.current = variantOptionSignature([]);
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
  const handleImageSelection = async (event: React.ChangeEvent<HTMLInputElement>, kind: "gallery" | "description") => {
    const files = Array.from(event.currentTarget.files || []);
    event.currentTarget.value = "";
    if (!files.length) return;
    if (kind === "gallery" && images.length + galleryPendingImages.length + files.length > 20) {
      setError("Bir üründe en fazla 20 görsel olabilir.");
      return;
    }
    if (kind === "description" && descriptionImages.length + descriptionPendingImages.length + files.length > 12) {
      setError("Açıklamada en fazla 12 görsel olabilir.");
      return;
    }

    setProcessingImages(true);
    setError(null);
    try {
      const blobs = await Promise.all(files.map((file) => convertImageToWebp(file)));
      const startIndex = kind === "gallery"
        ? images.length + galleryPendingImages.length
        : descriptionImages.length + descriptionPendingImages.length;
      const { uploadUrls } = await runAdminAction<{ uploadUrls: string[] }>("product.image-upload-urls", {
        count: blobs.length,
      });
      const nextImages: PendingImage[] = blobs.map((blob, index) => {
        const id = createEditorId();
        const fileName = productImageFileName(title || slugRef.current || "urun", startIndex + index);
        const previewUrl = URL.createObjectURL(blob);
        previewUrls.current.push(previewUrl);
        const uploadPromise = (async () => {
          try {
            const storageId = await uploadWebpToStorage(uploadUrls[index], blob);
            setPendingImages((current) => current.map((item) => item.id === id
              ? { ...item, status: "uploaded", storageId }
              : item));
            return storageId;
          } catch (cause) {
            console.error(cause);
            setPendingImages((current) => current.map((item) => item.id === id
              ? { ...item, status: "error" }
              : item));
            return null;
          }
        })();
        return { id, blob, fileName, previewUrl, kind, status: "uploading" as const, uploadPromise };
      });
      setPendingImages((current) => [...current, ...nextImages]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Görsel yüklenemedi.");
    }
    setProcessingImages(false);
  };

  const discardPendingImage = (image: PendingImage) => {
    if (image.storageId) {
      void runAdminAction("product.image-discard", { storageId: image.storageId }).catch(() => {});
    } else if (image.uploadPromise) {
      void image.uploadPromise.then((storageId) => {
        if (storageId) void runAdminAction("product.image-discard", { storageId }).catch(() => {});
      });
    }
  };

  const removePendingImage = (image: PendingImage) => {
    URL.revokeObjectURL(image.previewUrl);
    previewUrls.current = previewUrls.current.filter((url) => url !== image.previewUrl);
    setPendingImages((current) => current.filter((item) => item.id !== image.id));
    discardPendingImage(image);
  };

  const removeDescriptionImage = (storageId: string) => {
    setDescriptionImages((current) => current.filter((image) => image.storageId !== storageId));
  };

  const handleExit = async () => {
    const state = exitStateRef.current;
    if (state && !state.saved) {
      const handled = await flushExitState(state);
      if (handled) {
        savedRef.current = true;
        if (exitStateRef.current) exitStateRef.current.saved = true;
      }
    }
    onCancel();
  };

  const save = async (event?: React.SyntheticEvent<HTMLFormElement>, publishStatusOverride?: boolean) => {
    if (event) event.preventDefault();
    const targetAvailableForSale = publishStatusOverride !== undefined ? publishStatusOverride : availableForSale;
    const activeVariantRows = variantRows;
    const activeOptions = variantOptions.map((option) => ({
      id: option.id,
      name: option.name.trim(),
      values: option.values.map((v) => v.trim()).filter(Boolean),
    }));
    if (!slugRef.current.trim()) {
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
    if (variantOptionSignature(activeOptions) !== generatedOptionSignature.current) {
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
      const compareAtPrice = draft.compareAtPrice.trim().replace(",", ".");
      if (compareAtPrice && (!/^\d+(?:[.,]\d{1,2})?$/.test(draft.compareAtPrice.trim()) || Number(compareAtPrice) <= Number(draft.price.trim().replace(",", ".")))) {
        setError("Liste fiyatı satış fiyatından büyük ve geçerli bir tutar olmalı.");
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
    if (images.length + galleryPendingImages.length > 20) {
      setError("Bir üründe en fazla 20 görsel olabilir.");
      return;
    }
    setSaving(true);
    setError(null);
    const input = {
      ...(product ? { id: product._id } : {}),
      title: title.trim(),
      slug: slugRef.current.trim(),
      categorySlug,
      description: description.trim(),
      descriptionImageStorageIds: descriptionImages.map((image) => image.storageId),
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
          ...(variant.compareAtPrice.trim() ? { compareAtPrice: variant.compareAtPrice.trim().replace(",", ".") } : {}),
          stockQuantity: Number(variant.stockQuantity),
          availableForSale: variant.availableForSale,
        };
      }),
    };

    try {
      const uploadedImages = await resolveUploadedImages(pendingImages);
      await runAdminAction(product ? "product.update" : "product.create", {
        ...input,
        descriptionImageStorageIds: [
          ...input.descriptionImageStorageIds,
          ...uploadedImages.flatMap((image) => image.kind === "description" ? [image.storageId] : []),
        ],
        images: imagesPayload([...images, ...uploadedImages.filter((image) => image.kind === "gallery")]),
      });
      savedRef.current = true;
      if (exitStateRef.current) exitStateRef.current.saved = true;
      onSaved();

    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ürün kaydedilemedi.");
    }
    setSaving(false);
  };

  return (
    <div className="scheme-dark w-full text-foreground">
      <form onSubmit={save} className="space-y-5">
        <div className="space-y-5">
          <ProductImagesSection
            images={images}
            title={title}
            saving={saving}
            processingImages={processingImages}
            uploadingCount={uploadingCount}
            uploadedCount={uploadedCount}
            failedCount={failedCount}
            galleryPendingImages={galleryPendingImages}
            variantOptions={variantOptions}
            moveImage={moveImage}
            movePendingImage={movePendingImage}
            removePendingImage={removePendingImage}
            handleImageSelection={handleImageSelection}
            setImages={setImages}
            setPendingImages={setPendingImages}
          />
          <section aria-label="Ürün Bilgileri" className="rounded-2xl border border-border bg-card/70 p-4 sm:p-6">
            <div className="space-y-5">
              <h2 className="text-sm font-semibold text-foreground">Ürün Bilgileri</h2>
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="product-title" className="text-xs font-medium text-muted-foreground">Ürün adı <span className="text-destructive">*</span></Label>
                  <Input id="product-title" name="title" autoComplete="off" required minLength={2} maxLength={140} placeholder="Ürün adı" value={title} onChange={(event) => {
                    const nextTitle = event.target.value;
                    setTitle(nextTitle);
                    slugRef.current = slugify(nextTitle);
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

          <ProductAttributesSection
            categoryAttributes={categoryAttributes}
            attributeValues={attributeValues}
            setAttributeValues={setAttributeValues}
            categorySlug={categorySlug}
          />

              {product ? (
                <label className="flex cursor-pointer items-center justify-between gap-3 border-t border-border pt-4">
                  <span className="flex min-w-0 items-center gap-2">
                    <GlobeAltIcon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">Mağazada yayınla</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">Kapalıyken ürün mağazada satışa sunulmaz.</span>
                    </span>
                  </span>
                  <input type="checkbox" name="availableForSale" checked={availableForSale} onChange={(event) => setAvailableForSale(event.target.checked)} className="size-5 shrink-0 accent-foreground" />
                </label>
              ) : null}
            </div>
          </section>

          <ProductVariantsSection
            variantOptions={variantOptions}
            setVariantOptions={setVariantOptions}
            addVariantOption={addVariantOption}
            removeVariantOption={removeVariantOption}
            generateVariantRows={generateVariantRows}
            variantRows={variantRows}
            updateVariant={updateVariant}
            removeVariant={removeVariant}
            selectionKey={selectionKey}
          />

          <ProductDescriptionSection
            description={description}
            setDescription={setDescription}
            processingImages={processingImages}
            saving={saving}
            descriptionImageLimitReached={descriptionImageLimitReached}
            descriptionImages={descriptionImages}
            descriptionPendingImages={descriptionPendingImages}
            handleImageSelection={handleImageSelection}
            removeDescriptionImage={removeDescriptionImage}
            removePendingImage={removePendingImage}
          />
        </div>

        {error && <AdminNotice kind="error">{error}</AdminNotice>}
        <div className="sticky bottom-0 z-20 -mx-4 flex items-center gap-3 border-t border-border bg-background/95 px-4 py-2.5 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" role="status">
            {saving ? (pendingImages.length ? "Görseller yükleniyor…" : "Kaydediliyor…") : error ? "Bilgileri kontrol edin" : ""}
          </span>
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
            {product ? (
              <>
                <Button type="button" variant="ghost" size="icon" onClick={() => void handleExit()} aria-label="Vazgeç" title="Vazgeç" className="text-muted-foreground [&_svg]:size-5">
                  <XMarkIcon aria-hidden="true" />
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
                <Button type="button" variant="ghost" size="icon" onClick={() => void handleExit()} aria-label="Vazgeç" title="Vazgeç" className="text-muted-foreground [&_svg]:size-5">
                  <XMarkIcon aria-hidden="true" />
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
  return (
    <div className="scheme-dark w-full text-foreground">
      <ProductEditorData productId={productId} />
    </div>
  );
}

function ProductEditorData({ productId }: { productId?: string }) {
  const router = useRouter();
  const { data: productData, loading: productsLoading, error: productsError } = useAdminResource<{ product: Product | null }>("product", productId ? { id: productId } : {});
  const { data: categories, loading: categoriesLoading, error: categoriesError } = useAdminResource<Category[]>("categories");
  const product = productData?.product ?? null;
  const loading = categoriesLoading || (Boolean(productId) && productsLoading);
  const error = categoriesError || (productId && productsError) || null;

  if (loading) return <AdminLoading label="Ürün formu" variant="form-content" />;
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
