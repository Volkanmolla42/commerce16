import { query, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import type { Doc } from "./_generated/dataModel";
import { v } from "convex/values";
import schema, { productsTable } from "./schema";
import { insertCatalogProduct, patchCatalogProduct, deleteCatalogProduct } from "./catalogModel";
import { assertAdminApiSecret } from "./adminAuth";
import { resolveLowStockThreshold } from "./settings";
import { isVariantSellable } from "../lib/catalog/variants";
import { catalogSearchQuery } from "../lib/catalog/smart-search";
import {
  normalizeVariantSkus,
  syncProductSkus,
  validateProductSkus,
} from "./productSkus";
import { resolvePublicImages } from "./productMedia";
import {
  productImageValidator,
  productOptionValidator,
  productVariantValidator,
} from "./productShape";

// Varyant stoğu ürün dokümanı içinde olduğu için indekslenemez; uyarı listesi sınırlı tarama ile üretilir.
const LOW_STOCK_SCAN_LIMIT = 500;

const productDocumentValidator = schema.doc("products");
const productInputValidator = productsTable.validator.omit(
  "updatedAt", "priceValue",
);
const adminStoredImageValidator = v.object({
  storageId: v.id("_storage"), fileName: v.string(), url: v.union(v.string(), v.null()),
  selectedOptions: v.optional(v.array(v.object({ name: v.string(), value: v.string() }))),
});
const productValidator = v.object({
  id: v.string(),
  slug: v.string(),
  title: v.string(),
  price: v.string(),
  availableForSale: v.boolean(),
  attributes: productDocumentValidator.fields.attributes,
  categorySlug: v.optional(v.string()),
  description: v.optional(v.string()),
  descriptionImages: v.optional(v.array(v.object({ url: v.string() }))),
  images: v.array(productImageValidator),
  options: v.optional(v.array(productOptionValidator)),
  variants: v.array(productVariantValidator),
  _creationTime: v.number(),
  soldCount: v.number(),
  inStock: v.boolean(),
  updatedAt: v.string(),
});
const sitemapProductValidator = v.object({ slug: v.string(), updatedAt: v.string() });

const adminProductValidator = productDocumentValidator.omit("priceValue")
  .extend({
    images: v.array(adminStoredImageValidator),
    descriptionImages: v.array(v.object({
      storageId: v.id("_storage"),
      url: v.union(v.string(), v.null()),
    })),
  });

import { deleteUnreferencedStorage, normalizeProductMediaLinks, toStorefrontProduct, validateProductAttributes, validateProductImages, validateProductVariantsAndOptions, withAdminMediaUrls } from "./products/helpers";

export const getByIdAdmin = query({
  args: { adminSecret: v.string(), id: v.id("products") },
  returns: v.union(adminProductValidator, v.null()),
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);
    const product = await ctx.db.get("products", args.id);
    if (!product) return null;
    return await withAdminMediaUrls(ctx, product);
  },
});

export const existingSlugsAdmin = query({
  args: { adminSecret: v.string(), slugs: v.array(v.string()) },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);
    if (args.slugs.length > 1000) throw new Error("En fazla 1000 ürün adresi kontrol edilebilir.");
    const unique = [...new Set(args.slugs)];
    const found = await Promise.all(unique.map(async (slug) => {
      const product = await ctx.db
        .query("products")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first();
      return product ? slug : null;
    }));
    return found.filter((slug): slug is string => slug !== null);
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
    return await Promise.all(items.map((item) => toStorefrontProduct(ctx, item)));
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

export const listForGoogleShoppingFeed = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(productValidator),
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("products")
      .withIndex("by_available", (q) => q.eq("availableForSale", true))
      .order("desc")
      .paginate(args.paginationOpts);
    const page = await Promise.all(result.page.map((item) => toStorefrontProduct(ctx, item)));
    return {
      ...result,
      page,
    };
  },
});

const exportProductValidator = v.object({
  slug: v.string(),
  title: v.string(),
  categorySlug: v.optional(v.string()),
  description: v.optional(v.string()),
  availableForSale: v.boolean(),
  options: v.array(v.object({
    id: v.string(),
    name: v.string(),
    values: v.array(v.string()),
  })),
  variants: v.array(v.object({
    id: v.string(),
    title: v.string(),
    sku: v.optional(v.string()),
    barcode: v.optional(v.string()),
    price: v.string(),
    compareAtPrice: v.optional(v.string()),
    stockQuantity: v.number(),
    selectedOptions: v.array(v.object({ name: v.string(), value: v.string() })),
  })),
  imageUrls: v.array(v.string()),
  updatedAt: v.string(),
});

export const listForExportAdmin = query({
  args: {
    adminSecret: v.string(),
    cursor: v.union(v.string(), v.null()),
    limit: v.optional(v.number()),
  },
  returns: paginationResultValidator(exportProductValidator),
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);
    const result = await ctx.db
      .query("products")
      .order("desc")
      .paginate({ numItems: Math.min(args.limit ?? 250, 500), cursor: args.cursor });
    const page = await Promise.all(result.page.map(async (item) => {
      const imageUrls = (await resolvePublicImages(ctx, item.images)).map((image) => image.url);
      return {
        slug: item.slug,
        title: item.title,
        categorySlug: item.categorySlug,
        description: item.description,
        availableForSale: item.availableForSale,
        options: item.options,
        variants: item.variants.map((v) => ({
          id: v.id,
          title: v.title,
          sku: v.sku,
          barcode: v.barcode,
          price: v.price,
          compareAtPrice: v.compareAtPrice,
          stockQuantity: v.stockQuantity,
          selectedOptions: v.selectedOptions,
        })),
        imageUrls,
        updatedAt: item.updatedAt,
      };
    }));
    return {
      ...result,
      page,
    };
  },
});

const importProductInputValidator = v.object({
  slug: v.string(),
  title: v.string(),
  categorySlug: v.optional(v.string()),
  description: v.optional(v.string()),
  availableForSale: v.boolean(),
  attributes: v.optional(v.array(v.object({
    key: v.string(),
    value: v.union(v.string(), v.number(), v.boolean(), v.array(v.string())),
  }))),
  options: v.array(v.object({
    id: v.string(),
    name: v.string(),
    values: v.array(v.string()),
  })),
  variants: v.array(v.object({
    id: v.string(),
    title: v.string(),
    availableForSale: v.optional(v.boolean()),
    sku: v.optional(v.string()),
    barcode: v.optional(v.string()),
    price: v.string(),
    compareAtPrice: v.optional(v.string()),
    stockQuantity: v.number(),
    selectedOptions: v.array(v.object({ name: v.string(), value: v.string() })),
  })),
  images: v.optional(v.array(v.object({
    storageId: v.id("_storage"),
    fileName: v.string(),
    selectedOptions: v.optional(v.array(v.object({ name: v.string(), value: v.string() }))),
  }))),
});

export const importBatchAdmin = mutation({
  args: {
    adminSecret: v.string(),
    products: v.array(importProductInputValidator),
  },
  returns: v.object({
    total: v.number(),
    created: v.number(),
    updated: v.number(),
    errors: v.array(v.object({
      slug: v.string(),
      error: v.string(),
    })),
  }),
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);
    let created = 0;
    let updated = 0;
    const errors: Array<{ slug: string; error: string }> = [];

    for (const item of args.products) {
      try {
        const existing = await ctx.db
          .query("products")
          .withIndex("by_slug", (q) => q.eq("slug", item.slug))
          .first();

        const productData = {
          ...item,
          ...(item.attributes === undefined && existing?.attributes
            ? { attributes: existing.attributes }
            : {}),
          images: item.images ?? [],
          variants: item.variants.map((v) => ({
            ...v,
            availableForSale: v.availableForSale ?? (v.stockQuantity > 0),
          })),
        };
        const normalized = normalizeVariantSkus(productData);
        await validateProductSkus(ctx, existing?._id ?? null, normalized);
        validateProductVariantsAndOptions(normalized);
        await validateProductAttributes(ctx, normalized);

        const updatedAt = new Date().toISOString();

        if (existing) {
          const nextImages = item.images && item.images.length > 0 ? item.images : existing.images;
          await validateProductImages(ctx, nextImages, normalized.options, normalized.variants);

          await syncProductSkus(ctx, existing._id, normalized);
          await patchCatalogProduct(ctx, existing, {
            ...normalized,
            images: nextImages,
            updatedAt,
          });
          updated++;
        } else {
          await validateProductImages(ctx, normalized.images, normalized.options, normalized.variants);
          const productId = await insertCatalogProduct(ctx, {
            ...normalized,
            images: normalized.images,
            updatedAt,
          });
          await syncProductSkus(ctx, productId, normalized);
          created++;
        }
      } catch (cause) {
        errors.push({
          slug: item.slug,
          error: cause instanceof Error ? cause.message : "Ürün aktarılırken hata oluştu.",
        });
      }
    }

    return {
      total: args.products.length,
      created,
      updated,
      errors,
    };
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

function toLowVariants(variants: Doc<"products">["variants"], threshold: number) {
  return variants
    .filter((variant) => variant.stockQuantity <= threshold)
    .map((variant) => ({
      id: variant.id,
      title: variant.title,
      ...(variant.sku ? { sku: variant.sku } : {}),
      stockQuantity: variant.stockQuantity,
    }));
}

export const listStockAdmin = query({
  args: {
    adminSecret: v.string(),
    query: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(stockProductValidator).extend({
    threshold: v.number(),
  }),
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);
    const threshold = await resolveLowStockThreshold(ctx);
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
      threshold,
    };
  },
});

export const lowStockAdmin = query({
  args: {
    adminSecret: v.string(),
  },
  returns: v.object({
    threshold: v.number(),
    productCount: v.number(),
    variantCount: v.number(),
    truncated: v.boolean(),
    page: v.array(stockProductValidator),
  }),
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);
    const threshold = await resolveLowStockThreshold(ctx);

    const products = await ctx.db.query("products").order("desc").take(LOW_STOCK_SCAN_LIMIT);
    const page = products.flatMap((product) => {
      const variants = toLowVariants(product.variants, threshold);
      return variants.length === 0
        ? []
        : [{ productId: product._id, title: product.title, slug: product.slug, variants }];
    });

    return {
      threshold,
      productCount: page.length,
      variantCount: page.reduce((sum, product) => sum + product.variants.length, 0),
      truncated: products.length === LOW_STOCK_SCAN_LIMIT,
      page,
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
    return product?.availableForSale ? await toStorefrontProduct(ctx, product) : null;
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
    const variants = product.variants ?? [];
    const hasInStockVariants = variants.some(isVariantSellable);
    return {
      availableForSale: product.availableForSale && hasInStockVariants,
      variants: variants.map((variant) => ({
        id: variant.id,
        availableForSale: isVariantSellable(variant),
      })),
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
      if (product?.availableForSale) products.push(await toStorefrontProduct(ctx, product));
    }
    return products;
  },
});

export const getByIds = query({
  args: { ids: v.array(v.string()) },
  returns: v.array(productValidator),
  handler: async (ctx, { ids }) => {
    if (ids.length > 100) throw new Error("En fazla 100 ürün aynı anda yüklenebilir.");
    const products = [];
    for (const rawId of new Set(ids)) {
      const id = ctx.db.normalizeId("products", rawId);
      if (!id) continue;
      const product = await ctx.db.get(id);
      if (product?.availableForSale) products.push(await toStorefrontProduct(ctx, product));
    }
    return products;
  },
});

export const validateCart = query({
  args: {
    items: v.array(v.object({
      productId: v.id("products"),
      variantId: v.optional(v.string()),
    })),
  },
  returns: v.array(v.object({
    productId: v.id("products"),
    variantId: v.optional(v.string()),
    available: v.boolean(),
    stockQuantity: v.number(),
    title: v.string(),
  })),
  handler: async (ctx, { items }) => {
    if (items.length > 100) throw new Error("En fazla 100 ürün kontrol edilebilir.");
    const results = [];
    for (const item of items) {
      const product = await ctx.db.get(item.productId);
      if (!product || !product.availableForSale) {
        results.push({
          productId: item.productId,
          variantId: item.variantId,
          available: false,
          stockQuantity: 0,
          title: product?.title ?? "Ürün",
        });
        continue;
      }
      const variants = product.variants ?? [];
      const variant = item.variantId
        ? variants.find((candidate) => candidate.id === item.variantId)
        : (variants.length === 1 ? variants[0] : undefined);
      if (!variant) {
        results.push({
          productId: item.productId,
          variantId: item.variantId,
          available: false,
          stockQuantity: 0,
          title: product.title,
        });
        continue;
      }
      const isAvailable = isVariantSellable(variant);
      results.push({
        productId: item.productId,
        variantId: item.variantId,
        available: isAvailable,
        stockQuantity: Math.max(0, variant.stockQuantity),
        title: variant.selectedOptions.length
          ? `${product.title} (${variant.selectedOptions.map((o) => o.value).join(", ")})`
          : product.title,
      });
    }
    return results;
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
    const media = normalizeProductMediaLinks(normalizedProduct);
    const existing = await ctx.db
      .query("products")
      .withIndex("by_slug", (q) => q.eq("slug", normalizedProduct.slug))
      .first();
    if (existing) throw new Error("Bu ürün adresi zaten kullanılıyor.");

    const updatedAt = new Date().toISOString();
    const productId = await insertCatalogProduct(ctx, {
      ...normalizedProduct,
      ...(media.descriptionImageStorageIds !== undefined ? { descriptionImageStorageIds: media.descriptionImageStorageIds } : {}),
      updatedAt,
    });
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
    const media = normalizeProductMediaLinks(next);
    const nextDescriptionImageStorageIds = rest.descriptionImageStorageIds ?? current.descriptionImageStorageIds ?? [];
    const removedDescriptionImageStorageIds = (current.descriptionImageStorageIds ?? [])
      .filter((storageId) => !nextDescriptionImageStorageIds.includes(storageId));

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
      ...(media.descriptionImageStorageIds !== undefined ? { descriptionImageStorageIds: media.descriptionImageStorageIds } : {}),
      updatedAt: new Date().toISOString(),
    });
    await deleteUnreferencedStorage(ctx, removedDescriptionImageStorageIds);

    // Stok artışı olan veya yeniden satışa açılan varyantlar için Gelince Haber Ver bildirimini tetikle
    if (next.availableForSale) {
      for (const nextVariant of next.variants) {
        const prevVariant = current.variants?.find((v) => v.id === nextVariant.id);
        const prevStock = prevVariant?.stockQuantity ?? 0;
        const nextStock = nextVariant.stockQuantity ?? 0;
        const prevSellable = prevVariant ? isVariantSellable(prevVariant) : false;
        const nextSellable = isVariantSellable(nextVariant);

        if ((!prevSellable || prevStock <= 0) && nextSellable && nextStock > 0) {
          await ctx.scheduler.runAfter(0, internal.restock.triggerRestockCheck, {
            productId: id,
            variantId: nextVariant.id,
          });
        }
      }
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
    const descriptionImageStorageIds = product
      ? (product.descriptionImageStorageIds ?? []).filter(
        (storageId) => !product.images.some((image) => image.storageId === storageId),
      )
      : [];
    if (product) {
      // Sipariş geçmişindeki görsel URL'leri ürün silindikten sonra da çalışmalı; galeri blob'ları korunur.
      const reviews = await ctx.db.query("reviews")
        .withIndex("by_product", (q) => q.eq("productId", args.id))
        .take(500);
      for (const review of reviews) await ctx.db.delete(review._id);

      const questions = await ctx.db.query("productQuestions")
        .withIndex("by_product_and_status", (q) => q.eq("productId", args.id))
        .take(500);
      for (const question of questions) await ctx.db.delete(question._id);

      const restockSubscriptions = await ctx.db.query("restockSubscriptions")
        .withIndex("by_product_and_variant", (q) => q.eq("productId", args.id))
        .take(500);
      for (const subscription of restockSubscriptions) await ctx.db.delete(subscription._id);

      const lowStockAlerts = await ctx.db.query("lowStockAlerts")
        .withIndex("by_product_and_variant", (q) => q.eq("productId", args.id))
        .take(500);
      for (const alert of lowStockAlerts) await ctx.db.delete(alert._id);

      const favorites = await ctx.db.query("favorites")
        .withIndex("by_product_slug", (q) => q.eq("productSlug", product.slug))
        .take(500);
      for (const favorite of favorites) await ctx.db.delete(favorite._id);

      const registry = await ctx.db.query("productSkus")
        .withIndex("by_product", (q) => q.eq("productId", args.id))
        .take(101);
      for (const entry of registry) await ctx.db.delete(entry._id);
    }
    if (product) await deleteCatalogProduct(ctx, product);
    await deleteUnreferencedStorage(ctx, descriptionImageStorageIds);
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

export const generateImageUploadUrls = mutation({
  args: {
    adminSecret: v.string(),
    count: v.number(),
  },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);
    if (!Number.isInteger(args.count) || args.count < 1 || args.count > 20) {
      throw new Error("Geçersiz görsel sayısı.");
    }
    const urls: string[] = [];
    for (let i = 0; i < args.count; i++) {
      urls.push(await ctx.storage.generateUploadUrl());
    }
    return urls;
  },
});

export const discardImageUpload = mutation({
  args: {
    adminSecret: v.string(),
    storageId: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);
    for await (const product of ctx.db.query("products")) {
      if (product.images.some((image) => image.storageId === args.storageId) ||
        (product.descriptionImageStorageIds ?? []).some((storageId) => storageId === args.storageId)) {
        return null;
      }
    }
    await ctx.storage.delete(args.storageId);
    return null;
  },
});

