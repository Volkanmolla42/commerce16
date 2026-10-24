import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { normalizeSku } from "../productSkus";
import { resolveDescriptionImages } from "../productMedia";
import { toProductBase } from "../productShape";
import { withoutCatalogMetadata } from "../catalogModel";

export function normalizeKey(value: string) {
  return value.trim().toLocaleLowerCase("tr-TR");
}

export function validateProductOptions(options: NonNullable<Doc<"products">["options"]>) {
  if (options.length > 3) {
    throw new Error("Bir ürüne en fazla 3 varyasyon seçeneği eklenebilir.");
  }
  const optionNames = new Set<string>();
  for (const option of options) {
    const trimmedName = option.name.trim();
    if (!trimmedName || trimmedName.length > 40 || option.values.length === 0) {
      throw new Error("Her varyasyon seçeneği için geçerli bir ad ve en az bir değer girin.");
    }
    const normalizedName = normalizeKey(trimmedName);
    if (optionNames.has(normalizedName)) {
      throw new Error("Varyasyon seçenek adları birbirinden farklı olmalı.");
    }
    optionNames.add(normalizedName);

    const valueSet = new Set(option.values.map(normalizeKey));
    if (valueSet.size !== option.values.length) {
      throw new Error(`"${option.name}" seçeneği için değerler birbirinden farklı olmalı.`);
    }
  }

  const expectedCombinations = options.reduce((count, option) => count * option.values.length, 1);
  if (expectedCombinations > 100) {
    throw new Error("Bir üründe en fazla 100 varyant kombinasyonu olabilir.");
  }
}

export function variantCombinationKey(selectedOptions: { name: string; value: string }[]) {
  return JSON.stringify(
    [...selectedOptions]
      .map((opt) => ({ name: normalizeKey(opt.name), value: opt.value.trim() }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  );
}

export function validateProductVariants(
  variants: NonNullable<Doc<"products">["variants"]>,
  options: NonNullable<Doc<"products">["options"]>,
) {
  if (variants.length === 0) {
    throw new Error("Ürün en az bir satılabilir birim (SKU) içermeli.");
  }
  if (options.length === 0 && variants.length !== 1) {
    throw new Error("Varyasyonsuz ürün tek bir SKU içermeli.");
  }
  if (variants.length > 100) {
    throw new Error("Bir üründe en fazla 100 varyant olabilir.");
  }

  const skus = new Set<string>();
  const combinations = new Set<string>();
  const variantIds = new Set<string>();

  for (const variant of variants) {
    const variantId = variant.id.trim();
    if (!variantId) throw new Error("Her varyantın benzersiz bir kimliği olmalı.");
    if (variantIds.has(variantId)) throw new Error("Aynı varyant kimliği birden fazla kullanılamaz.");
    variantIds.add(variantId);

    if (!Number.isSafeInteger(variant.stockQuantity) || variant.stockQuantity < 0) {
      throw new Error("Her varyant için sıfır veya daha büyük tam sayı stok girin.");
    }
    const priceInCents = Math.round(Number(variant.price) * 100);
    if (!/^\d+(?:\.\d{1,2})?$/.test(variant.price) || !Number.isSafeInteger(priceInCents) || priceInCents < 0) {
      throw new Error("Her varyant için geçerli bir satış fiyatı girin.");
    }
    if (variant.compareAtPrice !== undefined) {
      const compareAtCents = Math.round(Number(variant.compareAtPrice) * 100);
      if (!/^\d+(?:\.\d{1,2})?$/.test(variant.compareAtPrice) || !Number.isSafeInteger(compareAtCents) || compareAtCents <= priceInCents) {
        throw new Error("Liste fiyatı satış fiyatından büyük ve geçerli bir tutar olmalı.");
      }
    }
    const sku = normalizeSku(variant.sku);
    if (!sku) throw new Error("Her varyant için ayrı bir SKU girin.");
    if (skus.has(sku)) throw new Error("Her varyantın SKU kodu benzersiz olmalı.");
    skus.add(sku);

    if (variant.barcode && (typeof variant.barcode !== "string" || variant.barcode.length > 64)) {
      throw new Error("Barkod en fazla 64 karakter olabilir.");
    }

    if (variant.selectedOptions.length !== options.length) {
      throw new Error("Varyantın seçenek değerleri eksik.");
    }

    for (const selected of variant.selectedOptions) {
      const targetOption = options.find((opt) => normalizeKey(opt.name) === normalizeKey(selected.name));
      if (!targetOption || !targetOption.values.includes(selected.value)) {
        throw new Error(`Varyant değeri "${selected.value}" tanımlı seçeneklerle eşleşmiyor.`);
      }
    }

    const key = variantCombinationKey(variant.selectedOptions);
    if (combinations.has(key)) {
      throw new Error("Aynı varyant kombinasyonu birden fazla eklenemez.");
    }
    combinations.add(key);
  }
}

export function validateProductVariantsAndOptions(product: Pick<Doc<"products">, "variants" | "options">) {
  const options = product.options ?? [];
  const variants = product.variants ?? [];
  validateProductOptions(options);
  validateProductVariants(variants, options);
}

export async function toStorefrontProduct(ctx: QueryCtx, product: Doc<"products">) {
  const base = await toProductBase(ctx, product);
  const descriptionImages = await resolveDescriptionImages(ctx, product.descriptionImageStorageIds);
  const availableForSale = product.availableForSale && base.variants.some((variant) => variant.availableForSale);
  return {
    ...base,
    availableForSale,
    inStock: availableForSale,
    attributes: product.attributes,
    description: product.description,
    descriptionImages,
  };
}

export function normalizeProductMediaLinks(product: Pick<Doc<"products">, "descriptionImageStorageIds">) {
  const descriptionImageStorageIds = product.descriptionImageStorageIds
    ? [...new Set(product.descriptionImageStorageIds)]
    : undefined;
  return { descriptionImageStorageIds };
}

export async function deleteUnreferencedStorage(ctx: MutationCtx, storageIds: Id<"_storage">[]) {
  if (storageIds.length === 0) return;
  const referenced = new Set<string>();
  for (const product of await ctx.db.query("products").take(200)) {
    for (const image of product.images) referenced.add(image.storageId);
    for (const storageId of product.descriptionImageStorageIds ?? []) referenced.add(storageId);
  }
  for (const category of await ctx.db.query("categories").take(200)) {
    if (category.imageStorageId) referenced.add(category.imageStorageId);
  }
  for (const storageId of storageIds) {
    if (referenced.has(storageId)) continue;
    if (await ctx.db.system.get("_storage", storageId)) {
      await ctx.storage.delete(storageId);
    }
  }
}

export async function withAdminMediaUrls(ctx: QueryCtx, product: Doc<"products">) {
  return {
    ...withoutCatalogMetadata(product),
    images: await Promise.all(product.images.map(async (image) => ({
      ...image,
      url: await ctx.storage.getUrl(image.storageId),
    }))),
    descriptionImages: await Promise.all((product.descriptionImageStorageIds ?? []).map(async (storageId) => ({
      storageId,
      url: await ctx.storage.getUrl(storageId),
    }))),
  };
}

export async function validateProductAttributes(
  ctx: MutationCtx,
  product: Pick<Doc<"products">, "categorySlug" | "attributes">,
) {
  const values = product.attributes ?? [];
  const categorySlug = product.categorySlug;
  if (!categorySlug) {
    if (values.length > 0) throw new Error("Ürün özellikleri için kategori seçin.");
    return;
  }

  const category = await ctx.db.query("categories")
    .withIndex("by_slug", (q) => q.eq("slug", categorySlug))
    .first();
  if (!category) throw new Error("Ürün kategorisi bulunamadı.");

  const definitions = category.attributes ?? [];
  const submitted = new Map(values.map((attribute) => [attribute.key, attribute.value]));
  if (submitted.size !== values.length || values.some((attribute) => !/^[a-z][a-z0-9-]{0,39}$/.test(attribute.key) || !definitions.some((definition) => definition.key === attribute.key))) {
    throw new Error("Ürün özellikleri seçilen kategoriyle eşleşmiyor.");
  }

  for (const definition of definitions) {
    const value = submitted.get(definition.key);
    if (value === undefined || value === "") {
      if (definition.required) throw new Error(`${definition.label} alanı zorunludur.`);
      continue;
    }
    if (definition.type === "number" && (typeof value !== "number" || !Number.isFinite(value))) {
      throw new Error(`${definition.label} sayısal bir değer olmalı.`);
    }
    if (definition.type === "text" && typeof value !== "string") {
      throw new Error(`${definition.label} metin değeri olmalı.`);
    }
    if (definition.type === "select") {
      if (typeof value !== "string") {
        throw new Error(`${definition.label} metin değeri olmalı.`);
      }
      if (definition.options && definition.options.length > 0 && !definition.options.includes(value)) {
        throw new Error(`${definition.label} için geçerli bir seçenek belirleyin.`);
      }
    }
    if (definition.type === "multiselect") {
      if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
        throw new Error(`${definition.label} bir seçenek listesi olmalı.`);
      }
      if (definition.required && value.length === 0) {
        throw new Error(`${definition.label} alanı zorunludur.`);
      }
      if (new Set(value).size !== value.length) {
        throw new Error(`${definition.label} içinde yinelenen seçenek olamaz.`);
      }
      if (definition.options && definition.options.length > 0) {
        const allowed = new Set(definition.options);
        if (value.some((item) => !allowed.has(item))) {
          throw new Error(`${definition.label} için yalnızca tanımlı seçenekler seçilebilir.`);
        }
      }
    }
    if (definition.type === "boolean" && typeof value !== "boolean") {
      throw new Error(`${definition.label} evet veya hayır olarak seçilmeli.`);
    }
  }
}

export async function validateProductImages(
  ctx: MutationCtx,
  images: { storageId: Id<"_storage">; fileName: string; selectedOptions?: { name: string; value: string }[] }[],
  options: Doc<"products">["options"],
  variants: Doc<"products">["variants"],
) {
  const availableOptions = options;
  const availableVariants = variants;
  const storageIds = new Set<string>();
  for (const image of images) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*\.webp$/.test(image.fileName)) {
      throw new Error("Görsel adı SEO uyumlu WebP dosya adı olmalı.");
    }
    if (storageIds.has(image.storageId)) {
      throw new Error("Aynı görsel birden fazla eklenemez.");
    }
    storageIds.add(image.storageId);

    const scope = image.selectedOptions ?? [];
    if (new Set(scope.map(({ name }) => normalizeKey(name))).size !== scope.length ||
      scope.some(({ name, value }) => !availableOptions.some((option) => normalizeKey(option.name) === normalizeKey(name) && option.values.includes(value))) ||
      !availableVariants.some((variant) => scope.every(({ name, value }) => variant.selectedOptions.some((selected) => normalizeKey(selected.name) === normalizeKey(name) && selected.value === value)))) {
      throw new Error("Görsel kapsamı geçerli bir varyant seçeneğiyle eşleşmiyor.");
    }

    const metadata = await ctx.db.system.get("_storage", image.storageId);
    if (!metadata || metadata.contentType !== "image/webp" || metadata.size <= 0) {
      throw new Error("Yalnızca WebP formatındaki yüklenmiş görseller eklenebilir.");
    }
  }
}
