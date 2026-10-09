import { query, mutation } from "./_generated/server";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import schema from "./schema";
import { insertCatalogProduct, patchCatalogProduct, deleteCatalogProduct, withoutCatalogMetadata } from "./catalogModel";
import { assertAdminApiSecret } from "./adminAuth";
import { getProductPriceRange } from "../lib/catalog/variants";
import { catalogSearchQuery } from "../lib/catalog/smart-search";
import {
  normalizeVariantSkus,
  normalizeSku,
  syncProductSkus,
} from "./productSkus";

const productDocumentValidator = schema.doc("products");
const productInputValidator = productDocumentValidator.omit(
  "_id", "_creationTime", "updatedAt", "priceValue",
);
const adminStoredImageValidator = v.object({
  storageId: v.id("_storage"), fileName: v.string(), url: v.union(v.string(), v.null()),
  selectedOptions: v.optional(v.array(v.object({ name: v.string(), value: v.string() }))),
});
const publicImageValidator = v.object({
  url: v.string(), selectedOptions: v.optional(v.array(v.object({ name: v.string(), value: v.string() }))),
});
const publicVariantValidator = v.object({
  id: v.string(),
  title: v.string(),
  availableForSale: v.boolean(),
  selectedOptions: v.array(v.object({ name: v.string(), value: v.string() })),
  price: v.string(),
  sku: v.optional(v.string()),
  barcode: v.optional(v.string()),
});
const productValidator = productDocumentValidator.omit(
  "images", "variants", "priceValue",
).extend({ price: v.string(), images: v.array(publicImageValidator), variants: v.array(publicVariantValidator) });
const sitemapProductValidator = v.object({ slug: v.string(), updatedAt: v.string() });

const adminProductValidator = productDocumentValidator.omit("priceValue")
  .extend({ images: v.array(adminStoredImageValidator) });

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
    if (!Number.isSafeInteger(variant.stockQuantity) || variant.stockQuantity < 0) {
      throw new Error("Her varyant için sıfır veya daha büyük tam sayı stok girin.");
    }
    const priceInCents = Math.round(Number(variant.price) * 100);
    if (!/^\d+(?:\.\d{1,2})?$/.test(variant.price) || !Number.isSafeInteger(priceInCents) || priceInCents < 0) {
      throw new Error("Her varyant için geçerli bir satış fiyatı girin.");
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

function validateProductVariantsAndOptions(product: Pick<Doc<"products">, "variants" | "options">) {
  const options = product.options ?? [];
  const variants = product.variants ?? [];
  validateProductOptions(options);
  validateProductVariants(variants, options);
}

async function withPublicImageUrls(ctx: QueryCtx, product: Doc<"products">) {
  const images = await Promise.all(product.images.map(async ({ storageId, selectedOptions }) => {
    const url = await ctx.storage.getUrl(storageId);
    return url ? { url, ...(selectedOptions ? { selectedOptions } : {}) } : null;
  }));
  return {
    _id: product._id,
    _creationTime: product._creationTime,
    slug: product.slug,
    title: product.title,
    price: getProductPriceRange(product).min,
    availableForSale: product.availableForSale,
    attributes: product.attributes,
    categorySlug: product.categorySlug,
    images: images.filter((image): image is NonNullable<typeof image> => Boolean(image)),
    options: product.options,
    variants: product.variants.map((variant) => {
      const { stockQuantity, ...publicVariant } = variant;
      void stockQuantity;
      return publicVariant;
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

async function validateProductImages(
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

export const getByIdAdmin = query({
  args: { adminSecret: v.string(), id: v.id("products") },
  returns: v.union(adminProductValidator, v.null()),
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);
    const product = await ctx.db.get("products", args.id);
    if (!product) return null;
    return { ...withoutCatalogMetadata(product), images: await Promise.all(product.images.map(async (image) => ({
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
        images: await Promise.all(item.images.map(async (image) => ({
          ...image,
          url: await ctx.storage.getUrl(image.storageId),
        }))),
      })));
  },
});

const stockProductValidator = v.object({
  productId: v.id("products"),
  title: v.string(),
  slug: v.string(),
  variants: v.array(v.object({
    id: v.string(),
    title: v.string(),
    sku: v.optional(v.string()),
    stockQuantity: v.number(),
  })),
});

export const listStockAdmin = query({
  args: {
    adminSecret: v.string(),
    query: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(stockProductValidator),
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);
    if (args.paginationOpts.numItems < 1 || args.paginationOpts.numItems > 24) {
      throw new Error("Stok sayfa boyutu 1-24 arasında olmalı.");
    }

    const search = catalogSearchQuery(args.query);
    const result = args.query.trim() && !search
      ? { page: [], isDone: true, continueCursor: "" }
      : await (search
        ? ctx.db.query("products").withSearchIndex("search_catalog", (q) => q.search("title", search))
        : ctx.db.query("products").order("desc")
      ).paginate(args.paginationOpts);

    return {
      ...result,
      page: result.page.map((product) => ({
        productId: product._id,
        title: product.title,
        slug: product.slug,
        variants: product.variants.map((variant) => ({
          id: variant.id,
          title: variant.title,
          ...(variant.sku ? { sku: variant.sku } : {}),
          stockQuantity: variant.stockQuantity,
        })),
      })),
    };
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
      variants: v.array(v.object({
        id: v.string(),
        availableForSale: v.boolean(),
      })),
    }),
    v.null(),
  ),
  handler: async (ctx, { productId }) => {
    const product = await ctx.db.get(productId);
    if (!product) return null;
    return {
      availableForSale: product.availableForSale,
      variants: (product.variants ?? []).map(({ id, availableForSale }) => ({ id, availableForSale })),
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
    assertAdminApiSecret(adminSecret);
    const normalizedProduct = normalizeVariantSkus(product);
    validateProductVariantsAndOptions(normalizedProduct);
    await validateProductAttributes(ctx, normalizedProduct);
    await validateProductImages(ctx, normalizedProduct.images, normalizedProduct.options, normalizedProduct.variants);
    const existing = await ctx.db
      .query("products")
      .withIndex("by_slug", (q) => q.eq("slug", normalizedProduct.slug))
      .first();
    if (existing) throw new Error("Bu ürün adresi zaten kullanılıyor.");

    const updatedAt = new Date().toISOString();
    const productId = await insertCatalogProduct(ctx, { ...normalizedProduct, updatedAt });
    await syncProductSkus(ctx, productId, normalizedProduct);
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
    const { adminSecret, id, ...rest } = args;
    assertAdminApiSecret(adminSecret);
    const current = await ctx.db.get(id);
    if (!current) throw new Error("Ürün bulunamadı");
    const next = normalizeVariantSkus({ ...current, ...rest });
    validateProductVariantsAndOptions(next);
    await validateProductAttributes(ctx, next);

    const nextImages = rest.images ?? current.images;
    await validateProductImages(ctx, nextImages, next.options, next.variants);

    if (rest.slug && rest.slug !== current.slug) {
      const duplicate = await ctx.db
        .query("products")
        .withIndex("by_slug", (q) => q.eq("slug", rest.slug!))
        .first();
      if (duplicate) throw new Error("Bu ürün adresi zaten kullanılıyor.");
    }

    await syncProductSkus(ctx, id, next);
    await patchCatalogProduct(ctx, current, {
      ...rest,
      variants: next.variants,
      images: nextImages,
      updatedAt: new Date().toISOString(),
    });
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
      const registry = await ctx.db.query("productSkus")
        .withIndex("by_product", (q) => q.eq("productId", args.id))
        .take(101);
      for (const entry of registry) await ctx.db.delete(entry._id);
    }
    if (product) await deleteCatalogProduct(ctx, product);
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
