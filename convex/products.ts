import { query, mutation } from "./_generated/server";
import { paginationResultValidator } from "convex/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import schema from "./schema";
import { insertCatalogProduct, patchCatalogProduct, deleteCatalogProduct, withoutCatalogMetadata } from "./catalogModel";
import { assertAdminApiSecret } from "./adminAuth";
import { internal } from "./_generated/api";
import {
  normalizeProductSkus,
  normalizeSku,
  recordInitialInventory,
  recordInventoryMovement,
  syncSkuRegistry,
} from "./inventory";

const productDocumentValidator = schema.doc("products");
const productInputValidator = productDocumentValidator.omit(
  "_id", "_creationTime", "updatedAt", "priceValue", "searchText",
);
const adminStoredImageValidator = v.object({
  storageId: v.id("_storage"), fileName: v.string(), url: v.union(v.string(), v.null()),
});
const productValidator = productDocumentValidator.omit(
  "storageImages", "priceValue", "searchText",
);
const sitemapProductValidator = v.object({ slug: v.string(), updatedAt: v.string() });

const adminProductValidator = productValidator.extend({
  storageImages: v.array(adminStoredImageValidator),
});

function productHasAvailableStock(product: Pick<Doc<"products">, "availableForSale" | "stockQuantity" | "variants">) {
  if (!product.availableForSale) return false;
  const variants = product.variants ?? [];
  if (variants.length > 0) {
    return variants.some((variant) => {
      const stockQuantity = variant.stockQuantity ?? product.stockQuantity;
      return variant.availableForSale && (stockQuantity == null || stockQuantity > 0);
    });
  }
  return product.stockQuantity == null || product.stockQuantity > 0;
}

function validateVatRate(rate?: number | null, label = "KDV oranı") {
  if (rate == null) return;
  if (!Number.isFinite(rate) || rate < 0 || rate > 100 || Math.round(rate * 100) !== rate * 100) {
    throw new Error(`${label} 0 ile 100 arasında ve en fazla iki ondalık basamaklı olmalı.`);
  }
}

function validateStockQuantity(quantity?: number | null, label = "Stok adedi", required = false) {
  if (quantity == null) {
    if (required) throw new Error(`${label} girilmesi zorunludur.`);
    return;
  }
  if (!Number.isSafeInteger(quantity) || quantity < 0) {
    throw new Error(`${label} sıfır veya daha büyük bir tam sayı olmalı.`);
  }
}

function normalizeKey(value: string) {
  return value.trim().toLocaleLowerCase("tr-TR");
}

function validateProductOptions(options: NonNullable<Doc<"products">["options"]>) {
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

function variantCombinationKey(selectedOptions: { name: string; value: string }[]) {
  return JSON.stringify(
    [...selectedOptions]
      .map((opt) => ({ name: normalizeKey(opt.name), value: opt.value.trim() }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  );
}

function validateProductVariants(
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

  for (const variant of variants) {
    validateVatRate(variant.vatRate, "Varyant KDV oranı");
    validateStockQuantity(variant.stockQuantity, "Varyant stok adedi", true);

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

function validateProductInventoryAndVariants(product: Pick<Doc<"products">, "stockQuantity" | "variants" | "options" | "vatRate">) {
  validateVatRate(product.vatRate);
  validateStockQuantity(product.stockQuantity);
  const options = product.options ?? [];
  const variants = product.variants ?? [];
  validateProductOptions(options);
  validateProductVariants(variants, options);
}


async function recordStockChanges(
  ctx: MutationCtx,
  productId: Id<"products">,
  previous: Doc<"products">,
  next: Doc<"products">,
) {
  const productDelta = (next.stockQuantity ?? 0) - (previous.stockQuantity ?? 0);
  if (productDelta !== 0) {
    await recordInventoryMovement(ctx, {
      productId,
      productTitle: next.title,
      sku: normalizeSku(next.sku) ?? `PRODUCT-${productId}`,
      quantityDelta: productDelta,
      reason: "manual_adjustment",
    });
  }

  const previousVariants = new Map((previous.variants ?? []).map((variant) => [variant.id, variant]));
  const nextVariants = new Map((next.variants ?? []).map((variant) => [variant.id, variant]));
  for (const variantId of new Set([...previousVariants.keys(), ...nextVariants.keys()])) {
    const oldVariant = previousVariants.get(variantId);
    const newVariant = nextVariants.get(variantId);
    const delta = (newVariant?.stockQuantity ?? 0) - (oldVariant?.stockQuantity ?? 0);
    if (delta === 0) continue;
    await recordInventoryMovement(ctx, {
      productId,
      productTitle: next.title,
      variantId,
      sku: normalizeSku(newVariant?.sku ?? oldVariant?.sku) ?? `VARIANT-${productId}-${variantId}`,
      quantityDelta: delta,
      reason: "manual_adjustment",
    });
  }
}

function getRestockTargets(previous: Doc<"products">, next: Doc<"products">) {
  const targets: string[] = [];
  const productInventoryChanged = previous.stockQuantity !== next.stockQuantity ||
    previous.availableForSale !== next.availableForSale;
  const nextVariants = next.variants ?? [];

  if (nextVariants.length > 0) {
    for (const variant of nextVariants) {
      const previousVariant = previous.variants?.find((candidate) => candidate.id === variant.id);
      const nextQuantity = variant.stockQuantity ?? next.stockQuantity;
      const previousQuantity = previousVariant?.stockQuantity ?? previous.stockQuantity;
      const nextAvailable = next.availableForSale && variant.availableForSale && (nextQuantity == null || nextQuantity > 0);
      const wasAvailable = Boolean(previousVariant && previous.availableForSale && previousVariant.availableForSale &&
        (previousQuantity == null || previousQuantity > 0));
      const inventoryChanged = previousVariant?.stockQuantity !== variant.stockQuantity ||
        (variant.stockQuantity == null && productInventoryChanged);
      const saleStatusChanged = previous.availableForSale !== next.availableForSale ||
        previousVariant?.availableForSale !== variant.availableForSale;
      if (nextAvailable && (!wasAvailable || inventoryChanged || saleStatusChanged)) targets.push(variant.id);
    }
    return targets;
  }

  if (productHasAvailableStock(next) && (!productHasAvailableStock(previous) || productInventoryChanged)) {
    targets.push("");
  }
  return targets;
}

async function withPublicImageUrls(ctx: QueryCtx, product: Doc<"products">) {
  const storageImages = product.storageImages ?? [];
  const storageUrls = await Promise.all(
    storageImages.map(({ storageId }) => ctx.storage.getUrl(storageId)),
  );
  return {
    _id: product._id,
    _creationTime: product._creationTime,
    slug: product.slug,
    title: product.title,
    price: product.price,
    sku: product.sku,
    availableForSale: productHasAvailableStock(product),
    stockQuantity: product.stockQuantity ?? null,
    brand: product.brand,
    material: product.material,
    attributes: product.attributes,
    categorySlug: product.categorySlug,
    images: [...product.images, ...storageUrls.filter((url): url is string => Boolean(url))],
    options: product.options,
    variants: product.variants?.map((variant) => {
      const stockQuantity = variant.stockQuantity ?? product.stockQuantity ?? null;
      return {
        ...variant,
        availableForSale: product.availableForSale && variant.availableForSale && (stockQuantity == null || stockQuantity > 0),
        stockQuantity,
      };
    }),
    updatedAt: product.updatedAt,
  };
}

async function validateProductAttributes(
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

async function validateStoredImages(
  ctx: MutationCtx,
  images: { storageId: Id<"_storage">; fileName: string }[],
) {
  const storageIds = new Set<string>();
  for (const image of images) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*\.webp$/.test(image.fileName)) {
      throw new Error("Görsel adı SEO uyumlu WebP dosya adı olmalı.");
    }
    if (storageIds.has(image.storageId)) {
      throw new Error("Aynı görsel birden fazla eklenemez.");
    }
    storageIds.add(image.storageId);

    const metadata = await ctx.db.system.get("_storage", image.storageId);
    if (!metadata || metadata.contentType !== "image/webp" || metadata.size <= 0) {
      throw new Error("Yalnızca WebP formatındaki yüklenmiş görseller eklenebilir.");
    }
  }
}

export const getByIdAdmin = query({
  args: { adminSecret: v.string(), id: v.id("products") },
  returns: v.union(adminProductValidator, v.null()),
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);
    const product = await ctx.db.get("products", args.id);
    if (!product) return null;
    return { ...withoutCatalogMetadata(product), storageImages: await Promise.all((product.storageImages ?? []).map(async (image) => ({
      ...image, url: await ctx.storage.getUrl(image.storageId),
    }))) };
  },
});

export const list = query({
  args: {
    limit: v.optional(v.number()),
    categorySlug: v.optional(v.string()),
  },
  returns: v.array(productValidator),
  handler: async (ctx, args) => {
    if (args.limit !== undefined && !Number.isFinite(args.limit)) throw new Error("Ürün limiti geçerli bir sayı olmalı.");
    const limit = args.limit === undefined ? 50 : Math.max(1, Math.min(100, Math.trunc(args.limit)));
    const items = args.categorySlug === undefined
      ? await ctx.db.query("products").withIndex("by_available", (q) => q.eq("availableForSale", true)).take(limit)
      : await ctx.db.query("products").withIndex("by_available_and_category", (q) =>
          q.eq("availableForSale", true).eq("categorySlug", args.categorySlug)).take(limit);
    return await Promise.all(items.map((item) => withPublicImageUrls(ctx, item)));
  },
});

export const listForSitemap = query({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: paginationResultValidator(sitemapProductValidator),
  handler: async (ctx, { cursor }) => {
    const result = await ctx.db.query("products")
      .withIndex("by_available", (q) => q.eq("availableForSale", true))
      .order("asc")
      .paginate({ numItems: 100, cursor });
    return {
      ...result,
      page: result.page.map(({ slug, updatedAt }) => ({ slug, updatedAt })),
    };
  },
});

export const listAllAdmin = query({
  args: {
    adminSecret: v.string(),
  },
  returns: v.array(adminProductValidator),
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);
    const items = await ctx.db.query("products").order("desc").take(100);
    return await Promise.all(items.map(async (item) => ({
        ...withoutCatalogMetadata(item),
        storageImages: await Promise.all((item.storageImages ?? []).map(async (image) => ({
          ...image,
          url: await ctx.storage.getUrl(image.storageId),
        }))),
      })));
  },
});

export const getBySlug = query({
  args: {
    slug: v.string(),
  },
  returns: v.union(productValidator, v.null()),
  handler: async (ctx, args) => {
    const product = await ctx.db
      .query("products")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    return product?.availableForSale ? await withPublicImageUrls(ctx, product) : null;
  },
});

export const getAvailability = query({
  args: { productId: v.id("products") },
  returns: v.union(
    v.object({
      availableForSale: v.boolean(),
      productEnabledForSale: v.boolean(),
      stockQuantity: v.union(v.number(), v.null()),
      variants: v.array(v.object({
        id: v.string(),
        enabledForSale: v.boolean(),
        availableForSale: v.boolean(),
        stockQuantity: v.union(v.number(), v.null()),
      })),
    }),
    v.null(),
  ),
  handler: async (ctx, { productId }) => {
    const product = await ctx.db.get(productId);
    if (!product) return null;
    return {
      availableForSale: productHasAvailableStock(product),
      productEnabledForSale: product.availableForSale,
      stockQuantity: product.stockQuantity ?? null,
      variants: (product.variants ?? []).map((variant) => {
        const stockQuantity = variant.stockQuantity ?? product.stockQuantity ?? null;
        return {
          id: variant.id,
          enabledForSale: variant.availableForSale,
          availableForSale: product.availableForSale && variant.availableForSale && (stockQuantity == null || stockQuantity > 0),
          stockQuantity,
        };
      }),
    };
  },
});

export const getBySlugs = query({
  args: { slugs: v.array(v.string()) },
  returns: v.array(productValidator),
  handler: async (ctx, { slugs }) => {
    if (slugs.length > 100) throw new Error("En fazla 100 ürün aynı anda görüntülenebilir.");

    const products = [];
    for (const slug of new Set(slugs)) {
      const product = await ctx.db
        .query("products")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first();
      if (product?.availableForSale) products.push(await withPublicImageUrls(ctx, product));
    }
    return products;
  },
});

export const getByIds = query({
  args: { ids: v.array(v.id("products")) },
  returns: v.array(productValidator),
  handler: async (ctx, { ids }) => {
    if (ids.length > 100) throw new Error("En fazla 100 ürün aynı anda yüklenebilir.");
    const products = [];
    for (const id of new Set(ids)) {
      const product = await ctx.db.get(id);
      if (product?.availableForSale) products.push(await withPublicImageUrls(ctx, product));
    }
    return products;
  },
});

export const create = mutation({
  args: {
    adminSecret: v.string(),
    ...productInputValidator.fields,
  },
  returns: v.id("products"),
  handler: async (ctx, args) => {
    const { adminSecret, ...input } = args;
    const product = { ...input };
    delete product.sku;
    delete product.stockQuantity;
    assertAdminApiSecret(adminSecret);
    const normalizedProduct = normalizeProductSkus(product);
    validateProductInventoryAndVariants(normalizedProduct);
    await validateProductAttributes(ctx, normalizedProduct);
    const storageImages = normalizedProduct.storageImages ?? [];
    await validateStoredImages(ctx, storageImages);
    const existing = await ctx.db
      .query("products")
      .withIndex("by_slug", (q) => q.eq("slug", normalizedProduct.slug))
      .first();
    if (existing) throw new Error("Bu ürün adresi zaten kullanılıyor.");

    const updatedAt = new Date().toISOString();
    const productId = await insertCatalogProduct(ctx, { ...normalizedProduct, storageImages, updatedAt });
    await syncSkuRegistry(ctx, productId, normalizedProduct);
    await recordInitialInventory(ctx, productId, normalizedProduct);
    return productId;
  },
});

export const update = mutation({
  args: {
    adminSecret: v.string(),
    id: v.id("products"),
    ...productInputValidator.partial().fields,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { adminSecret, id, storageImages, ...rest } = args;
    assertAdminApiSecret(adminSecret);
    const current = await ctx.db.get(id);
    if (!current) throw new Error("Ürün bulunamadı");
    const next = normalizeProductSkus({ ...current, ...rest, sku: undefined, stockQuantity: undefined });
    validateProductInventoryAndVariants(next);
    await validateProductAttributes(ctx, next);

    const nextStorageImages = storageImages ?? current.storageImages ?? [];
    await validateStoredImages(ctx, nextStorageImages);

    if (rest.slug && rest.slug !== current.slug) {
      const duplicate = await ctx.db
        .query("products")
        .withIndex("by_slug", (q) => q.eq("slug", rest.slug!))
        .first();
      if (duplicate) throw new Error("Bu ürün adresi zaten kullanılıyor.");
    }

    await syncSkuRegistry(ctx, id, next);
    await patchCatalogProduct(ctx, current, {
      ...rest,
      vatRate: undefined,
      sku: undefined,
      stockQuantity: undefined,
      variants: next.variants,
      storageImages: nextStorageImages,
      updatedAt: new Date().toISOString(),
    });
    await recordStockChanges(ctx, id, current, next);
    for (const variantId of getRestockTargets(current, next)) {
      await ctx.scheduler.runAfter(0, internal.restockNotifications.processRestock, { productId: id, variantId });
    }
    return null;
  },
});

export const remove = mutation({
  args: {
    adminSecret: v.string(),
    id: v.id("products"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);
    const product = await ctx.db.get(args.id);
    if (product) {
      for (const sku of [
        { sku: product.sku ?? `PRODUCT-${product._id}`, quantity: product.stockQuantity ?? 0 },
        ...(product.variants ?? []).map((variant) => ({
          sku: variant.sku ?? `VARIANT-${product._id}-${variant.id}`,
          quantity: variant.stockQuantity ?? 0,
          variantId: variant.id,
        })),
      ]) {
        if (sku.quantity <= 0) continue;
        await recordInventoryMovement(ctx, {
          productId: product._id,
          productTitle: product.title,
          ...("variantId" in sku && sku.variantId ? { variantId: sku.variantId } : {}),
          sku: normalizeSku(sku.sku)!,
          quantityDelta: -sku.quantity,
          reason: "product_removed",
        });
      }
      const registry = await ctx.db.query("inventorySkuRegistry")
        .withIndex("by_product", (q) => q.eq("productId", args.id))
        .take(101);
      for (const entry of registry) await ctx.db.delete(entry._id);
    }
    if (product) await deleteCatalogProduct(ctx, product);
    await ctx.scheduler.runAfter(0, internal.restockNotifications.deleteForProduct, { productId: args.id });
    return null;
  },
});

export const generateImageUploadUrl = mutation({
  args: {
    adminSecret: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);
    return await ctx.storage.generateUploadUrl();
  },
});

export const getImageUrl = query({
  args: {
    adminSecret: v.string(),
    storageId: v.id("_storage"),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);
    return await ctx.storage.getUrl(args.storageId);
  },
});
