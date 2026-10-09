import type { Id } from "../../convex/_generated/dataModel";
import { parseCategoryAttributes } from "../catalog/attributes";

type UnknownRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function stringValue(value: unknown, label: string) {
  if (typeof value !== "string") throw new Error(`${label} alanı zorunludur.`);
  return value.trim();
}

function optionalString(value: unknown, label: string) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new Error(`${label} geçersiz.`);
  return value.trim();
}

function stringArray(value: unknown, label: string) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${label} alanı geçersiz.`);
  }
  return value.map((item) => item.trim()).filter(Boolean);
}

function productAttributesValue(value: unknown) {
  if (!Array.isArray(value) || value.length > 30) throw new Error("Ürün özellikleri geçersiz.");
  const attributes = value.map((item) => {
    if (!isRecord(item) || typeof item.key !== "string") throw new Error("Ürün özelliği geçersiz.");
    if (typeof item.value !== "string" && typeof item.value !== "number" && typeof item.value !== "boolean") {
      throw new Error("Ürün özelliğinin değeri geçersiz.");
    }
    if (typeof item.value === "number" && !Number.isFinite(item.value)) throw new Error("Ürün özelliğinin sayısal değeri geçersiz.");
    if (typeof item.value === "string" && item.value.length > 500) throw new Error("Ürün özelliği 500 karakteri aşamaz.");
    return { key: stringValue(item.key, "Özellik anahtarı"), value: item.value };
  });
  if (new Set(attributes.map((attribute) => attribute.key)).size !== attributes.length) {
    throw new Error("Ürün özellikleri tekrarlanamaz.");
  }
  return attributes;
}

function storageImagesValue(value: unknown) {
  if (!Array.isArray(value)) throw new Error("Yüklenen görseller geçersiz.");
  if (value.length > 20) throw new Error("Bir üründe en fazla 20 görsel olabilir.");
  return value.map((item) => {
    if (!isRecord(item)) throw new Error("Yüklenen görsel kaydı geçersiz.");
    const fileName = stringValue(item.fileName, "Görsel adı");
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*\.webp$/.test(fileName)) {
      throw new Error("Görsel adı SEO uyumlu WebP dosya adı olmalı.");
    }
    return {
      storageId: stringValue(item.storageId, "Görsel kimliği") as Id<"_storage">,
      fileName,
    };
  });
}

function priceValue(value: unknown, label: string) {
  const price = stringValue(value, label);
  const amount = Number(price);
  if (!/^\d+(?:\.\d{1,2})?$/.test(price) || !Number.isFinite(amount) || amount > 1_000_000_000) {
    throw new Error(`${label} geçerli bir tutar olmalı.`);
  }
  return amount.toFixed(2);
}

function productMetadataText(value: unknown, label: string) {
  const text = optionalString(value, label) ?? "";
  if (text.length > 80) throw new Error(`${label} 80 karakteri aşamaz.`);
  return text;
}

function productVatRateValue(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  const rate = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(rate) || rate < 0 || rate > 100 || Math.round(rate * 100) !== rate * 100) {
    throw new Error("KDV oranı 0 ile 100 arasında, en fazla iki ondalık basamaklı olmalı.");
  }
  return rate;
}

function productSkuValue(value: unknown) {
  const sku = optionalString(value, "SKU");
  if (sku && !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(sku)) {
    throw new Error("SKU 64 karakteri aşmamalı ve harf, rakam, nokta, alt çizgi veya tire içermeli.");
  }
  return sku;
}

function productStockQuantityValue(value: unknown) {
  if (value === null || value === "") return null;
  const quantity = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isSafeInteger(quantity) || quantity < 0) {
    throw new Error("Stok adedi sıfır veya daha büyük bir tam sayı olmalı.");
  }
  return quantity;
}

function productOptionsValue(value: unknown) {
  if (!Array.isArray(value)) throw new Error("Varyant seçenekleri geçersiz.");
  const options = value.map((item) => {
    if (!isRecord(item)) throw new Error("Varyant seçeneği geçersiz.");
    const name = stringValue(item.name, "Seçenek adı");
    return {
      id: stringValue(item.id, "Seçenek kimliği"),
      name,
      ...(item.attributeKey === undefined ? {} : { attributeKey: stringValue(item.attributeKey, "Kategori özelliği") }),
      values: stringArray(item.values, "Seçenek değerleri"),
    };
  });
  if (options.length > 3) throw new Error("En fazla 3 varyant seçeneği eklenebilir.");
  if (options.some((option) => !option.name || option.name.length > 40)) throw new Error("Seçenek adı 1-40 karakter olmalı.");
  if (new Set(options.map((option) => option.name.toLocaleLowerCase("tr-TR"))).size !== options.length) {
    throw new Error("Varyant seçeneklerinin adları birbirinden farklı olmalı.");
  }
  if (options.some((option) => option.values.length === 0 || new Set(option.values.map((entry) => entry.toLocaleLowerCase("tr-TR"))).size !== option.values.length)) {
    throw new Error("Her varyant seçeneğine farklı değerler eklenmeli.");
  }
  return options;
}

function productVariantsValue(value: unknown) {
  if (!Array.isArray(value)) throw new Error("Ürün varyantları geçersiz.");
  if (value.length > 100) throw new Error("Bir üründe en fazla 100 varyant olabilir.");
  return value.map((item) => {
    if (!isRecord(item)) throw new Error("Ürün varyantı geçersiz.");
    if (typeof item.availableForSale !== "boolean") throw new Error("Varyant satış durumu geçersiz.");
    if (!Array.isArray(item.selectedOptions)) throw new Error("Varyant seçenekleri geçersiz.");
    const selectedOptions = item.selectedOptions.map((selected) => {
      if (!isRecord(selected)) throw new Error("Varyant seçimi geçersiz.");
      return {
        name: stringValue(selected.name, "Seçenek adı"),
        ...(selected.attributeKey === undefined ? {} : { attributeKey: stringValue(selected.attributeKey, "Kategori özelliği") }),
        value: stringValue(selected.value, "Seçenek değeri"),
      };
    });
    const vatRate = productVatRateValue(item.vatRate);
    return {
      id: stringValue(item.id, "Varyant kimliği"),
      title: stringValue(item.title, "Varyant başlığı"),
      availableForSale: item.availableForSale,
      stockQuantity: productStockQuantityValue(item.stockQuantity),
      selectedOptions,
      ...(item.price === undefined || item.price === null || item.price === ""
        ? {}
        : { price: priceValue(item.price, "Varyant fiyatı") }),
      sku: productSkuValue(item.sku),
      ...(vatRate === undefined ? {} : { vatRate }),
    };
  });
}

function validateProductVariants(
  options: ReturnType<typeof productOptionsValue>,
  variants: ReturnType<typeof productVariantsValue>,
) {
  const combinationCount = options.reduce((count, option) => count * option.values.length, 1);
  if (combinationCount > 100) throw new Error("Bir üründe en fazla 100 varyant kombinasyonu olabilir.");
  if (options.length === 0 && variants.length !== 1) throw new Error("Seçeneksiz ürün tek bir SKU içermeli.");
  if (options.length > 0 && variants.length === 0) throw new Error("En az bir satılabilir varyant kombinasyonu ekleyin.");
  const combinations = new Set<string>();
  const skus = new Set<string>();
  for (const variant of variants) {
    const sku = productSkuValue(variant.sku);
    if (!sku) throw new Error("Her varyant için ayrı bir SKU girin.");
    if (variant.stockQuantity == null) throw new Error("Her varyant için stok adedi girin.");
    const normalizedSku = sku.toLocaleUpperCase("en-US");
    if (skus.has(normalizedSku)) throw new Error("Her varyantın SKU kodu birbirinden farklı olmalı.");
    skus.add(normalizedSku);
    if (variant.selectedOptions.length !== options.length || new Set(variant.selectedOptions.map((selected) => selected.name.toLocaleLowerCase("tr-TR"))).size !== options.length) throw new Error("Varyant seçenekleri eksik.");
    for (const selected of variant.selectedOptions) {
      const option = options.find((candidate) => candidate.name === selected.name);
      if (!option?.values.includes(selected.value)) throw new Error("Varyant değeri tanımlı seçeneklerle eşleşmiyor.");
    }
    const key = JSON.stringify([...variant.selectedOptions].sort((a, b) => a.name.localeCompare(b.name)));
    if (combinations.has(key)) throw new Error("Aynı varyant kombinasyonu birden fazla eklenemez.");
    combinations.add(key);
  }
}

export function parseProductInput(input: Record<string, unknown>) {
  const options = productOptionsValue(input.options);
  const variants = productVariantsValue(input.variants);
  const price = priceValue(input.price, "Fiyat");
  const images = stringArray(input.images, "Görsel adresleri");
  const storageImages = storageImagesValue(input.storageImages);
  const attributes = Object.hasOwn(input, "attributes") ? productAttributesValue(input.attributes) : undefined;
  if (images.length + storageImages.length > 20) throw new Error("Bir üründe en fazla 20 görsel olabilir.");
  validateProductVariants(options, variants);
  return {
    title: stringValue(input.title, "Ürün adı"),
    slug: stringValue(input.slug, "Ürün adresi"),
    price,
    availableForSale: input.availableForSale === true,
    images, storageImages, options, variants,
    ...(attributes ? { attributes } : {}),
    ...(Object.hasOwn(input, "brand") ? { brand: productMetadataText(input.brand, "Marka") } : {}),
    ...(Object.hasOwn(input, "material") ? { material: productMetadataText(input.material, "Materyal") } : {}),
    categorySlug: optionalString(input.categorySlug, "Kategori") || "",
  };
}

export function parseCategoryInput(input: Record<string, unknown>) {
  const slug = stringValue(input.slug, "Kategori adresi");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error("Kategori adresi yalnızca küçük harf, rakam ve tire içerebilir.");
  }
  return {
    title: stringValue(input.title, "Kategori adı"),
    slug,
    description: input.description === undefined ? "" : stringValue(input.description, "Açıklama"),
    ...(Object.hasOwn(input, "attributes") ? { attributes: parseCategoryAttributes(input.attributes) } : {}),
    ...(Object.hasOwn(input, "imageStorageId")
      ? {
          imageStorageId: input.imageStorageId === null
            ? null
            : stringValue(input.imageStorageId, "Kategori görseli kimliği") as Id<"_storage">,
        }
      : {}),
  };
}

