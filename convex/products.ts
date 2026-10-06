import { query, mutation } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import schema from "./schema";
import { assertAdminApiSecret } from "./adminAuth";

const productDocumentValidator = schema.doc("products");
const productInputValidator = productDocumentValidator.omit("_id", "_creationTime", "updatedAt");
const adminStoredImageValidator = v.object({
  storageId: v.id("_storage"), fileName: v.string(), url: v.union(v.string(), v.null()),
});
const productValidator = productDocumentValidator.omit("storageImages");

const adminProductValidator = productValidator.extend({
  storageImages: v.array(adminStoredImageValidator),
});

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
    availableForSale: product.availableForSale,
    categorySlug: product.categorySlug,
    images: [...product.images, ...storageUrls.filter((url): url is string => Boolean(url))],
    options: product.options,
    variants: product.variants,
    seo: product.seo,
    updatedAt: product.updatedAt,
  };
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
      : await ctx.db.query("products").withIndex("by_category", (q) => q.eq("categorySlug", args.categorySlug))
          .filter((q) => q.eq(q.field("availableForSale"), true)).take(limit);
    return await Promise.all(items.map((item) => withPublicImageUrls(ctx, item)));
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
      ...item,
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
    return product ? await withPublicImageUrls(ctx, product) : null;
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
      if (product) products.push(await withPublicImageUrls(ctx, product));
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
    const { adminSecret, ...product } = args;
    assertAdminApiSecret(adminSecret);
    const storageImages = product.storageImages ?? [];
    await validateStoredImages(ctx, storageImages);
    const existing = await ctx.db
      .query("products")
      .withIndex("by_slug", (q) => q.eq("slug", product.slug))
      .first();
    if (existing) throw new Error("Bu ürün adresi zaten kullanılıyor.");

    const updatedAt = new Date().toISOString();
    return await ctx.db.insert("products", { ...product, storageImages, updatedAt });
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

    const nextStorageImages = storageImages ?? current.storageImages ?? [];
    await validateStoredImages(ctx, nextStorageImages);

    if (rest.slug && rest.slug !== current.slug) {
      const duplicate = await ctx.db
        .query("products")
        .withIndex("by_slug", (q) => q.eq("slug", rest.slug!))
        .first();
      if (duplicate) throw new Error("Bu ürün adresi zaten kullanılıyor.");
    }

    await ctx.db.patch(id, {
      ...rest,
      storageImages: nextStorageImages,
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
    await ctx.db.delete(args.id);
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
