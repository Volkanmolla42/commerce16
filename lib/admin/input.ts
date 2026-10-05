import type { Id } from "../../convex/_generated/dataModel";
import { sanitizeCmsHtml } from "../content/sanitize-cms-html";

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

function productOptionsValue(value: unknown) {
  if (!Array.isArray(value)) throw new Error("Varyant seçenekleri geçersiz.");
  const options = value.map((item) => {
    if (!isRecord(item)) throw new Error("Varyant seçeneği geçersiz.");
    return {
      id: stringValue(item.id, "Seçenek kimliği"),
      name: stringValue(item.name, "Seçenek adı"),
      values: stringArray(item.values, "Seçenek değerleri"),
    };
  });
  if (options.length > 3) throw new Error("En fazla 3 varyant seçeneği eklenebilir.");
  if (new Set(options.map((option) => option.name.toLocaleLowerCase("tr-TR"))).size !== options.length) {
    throw new Error("Varyant seçeneklerinin adları birbirinden farklı olmalı.");
  }
  if (options.some((option) => option.values.length === 0 || new Set(option.values).size !== option.values.length)) {
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
        value: stringValue(selected.value, "Seçenek değeri"),
      };
    });
    return {
      id: stringValue(item.id, "Varyant kimliği"),
      title: stringValue(item.title, "Varyant başlığı"),
      availableForSale: item.availableForSale,
      selectedOptions,
      price: priceValue(item.price, "Varyant fiyatı"),
    };
  });
}

function validateProductVariants(
  options: ReturnType<typeof productOptionsValue>,
  variants: ReturnType<typeof productVariantsValue>,
) {
  const combinationCount = options.reduce((count, option) => count * option.values.length, options.length ? 1 : 0);
  if (combinationCount > 100) throw new Error("Bir üründe en fazla 100 varyant kombinasyonu olabilir.");
  if (variants.length !== combinationCount) throw new Error("Varyant kombinasyonları seçeneklerle eşleşmiyor.");
  const combinations = new Set<string>();
  for (const variant of variants) {
    if (variant.selectedOptions.length !== options.length || new Set(variant.selectedOptions.map((selected) => selected.name)).size !== options.length) throw new Error("Varyant seçenekleri eksik.");
    for (const selected of variant.selectedOptions) {
      const option = options.find((candidate) => candidate.name === selected.name);
      if (!option?.values.includes(selected.value)) throw new Error("Varyant değeri tanımlı seçeneklerle eşleşmiyor.");
    }
    const key = JSON.stringify([...variant.selectedOptions].sort((a, b) => a.name.localeCompare(b.name)));
    if (combinations.has(key)) throw new Error("Aynı varyant kombinasyonu birden fazla eklenemez.");
    combinations.add(key);
  }
}

function seoValue(value: unknown) {
  if (value === undefined || value === null) return undefined;
  if (!isRecord(value)) throw new Error("SEO bilgileri geçersiz.");
  return {
    title: stringValue(value.title, "SEO başlığı"),
    description: stringValue(value.description, "SEO açıklaması"),
  };
}

export function parseProductInput(input: Record<string, unknown>) {
  const options = productOptionsValue(input.options);
  const variants = productVariantsValue(input.variants);
  const images = stringArray(input.images, "Görsel adresleri");
  const storageImages = storageImagesValue(input.storageImages);
  if (images.length + storageImages.length > 20) throw new Error("Bir üründe en fazla 20 görsel olabilir.");
  validateProductVariants(options, variants);
  return {
    title: stringValue(input.title, "Ürün adı"),
    slug: stringValue(input.slug, "Ürün adresi"),
    price: priceValue(input.price, "Fiyat"),
    availableForSale: input.availableForSale === true,
    images, storageImages, options, variants,
    categorySlug: optionalString(input.categorySlug, "Kategori") || "",
    seo: seoValue(input.seo) || { title: "", description: "" },
  };
}

export function parseCategoryInput(input: Record<string, unknown>) {
  const seo = seoValue(input.seo);
  if (!seo) throw new Error("SEO bilgileri zorunludur.");
  return {
    title: stringValue(input.title, "Kategori adı"),
    slug: stringValue(input.slug, "Kategori adresi"),
    description: stringValue(input.description, "Açıklama"),
    path: stringValue(input.path, "Kategori yolu"),
    seo,
  };
}

export function parsePageInput(input: Record<string, unknown>) {
  const body = stringValue(input.body, "Sayfa içeriği");
  if (body.length > 100_000) throw new Error("Sayfa içeriği 100.000 karakteri aşamaz.");
  const seo = seoValue(input.seo);
  return {
    title: stringValue(input.title, "Sayfa başlığı"),
    slug: stringValue(input.slug, "Sayfa adresi"),
    body: sanitizeCmsHtml(body),
    bodySummary: stringValue(input.bodySummary, "Arama sonucu açıklaması"),
    ...(seo ? { seo } : {}),
  };
}
