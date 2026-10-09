import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import schema from "./schema";
import { assertAdminApiSecret } from "./adminAuth";
import { parseCategoryAttributes } from "../lib/catalog/attributes";
import { patchCatalogProduct } from "./catalogModel";

const categoryValidator = schema.doc("categories");
const categoryInputValidator = categoryValidator.omit("_id", "_creationTime", "updatedAt");
const categoryWithImageValidator = categoryValidator.extend({
  imageUrl: v.union(v.string(), v.null()),
});

export const list = query({
  args: {},
  returns: v.array(categoryWithImageValidator),
  handler: async (ctx) => {
    const categories = await ctx.db.query("categories").take(100);
    return await Promise.all(categories.map(async (category) => ({
      ...category,
      imageUrl: category.imageStorageId
        ? await ctx.storage.getUrl(category.imageStorageId)
        : null,
    })));
  },
});

export const listAdmin = mutation({
  args: { adminSecret: v.string() },
  returns: v.array(categoryWithImageValidator),
  handler: async (ctx, { adminSecret }) => {
    assertAdminApiSecret(adminSecret);
    const categories = await ctx.db.query("categories").take(100);
    return await Promise.all(categories.map(async (category) => ({
      ...category,
      imageUrl: category.imageStorageId ? await ctx.storage.getUrl(category.imageStorageId) : null,
    })));
  },
});

export const getBySlug = query({
  args: {
    slug: v.string(),
  },
  returns: v.union(categoryValidator, v.null()),
  handler: async (ctx, args) => {
    const category = await ctx.db
      .query("categories")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    return category;
  },
});

export const create = mutation({
  args: {
    adminSecret: v.string(),
    ...categoryInputValidator.fields,
  },
  returns: v.id("categories"),
  handler: async (ctx, args) => {
    const { adminSecret, ...category } = args;
    assertAdminApiSecret(adminSecret);
    if (category.attributes) category.attributes = parseCategoryAttributes(category.attributes);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(category.slug)) {
      throw new Error("Kategori adresi yalnızca küçük harf, rakam ve tire içerebilir.");
    }
    const existing = await ctx.db
      .query("categories")
      .withIndex("by_slug", (q) => q.eq("slug", category.slug))
      .first();
    if (existing) throw new Error("Bu kategori adresi zaten kullanılıyor.");

    if (category.imageStorageId) {
      const image = await ctx.db.system.get("_storage", category.imageStorageId);
      if (!image || !image.contentType?.startsWith("image/") || image.size > 8 * 1024 * 1024) {
        throw new Error("Kategori görseli geçersiz veya 8 MB sınırını aşıyor.");
      }
    }

    const updatedAt = new Date().toISOString();
    return await ctx.db.insert("categories", {
      ...category,
      attributes: category.attributes,
      updatedAt,
    });
  },
});

export const update = mutation({
  args: {
    adminSecret: v.string(),
    id: v.id("categories"),
    ...categoryInputValidator.partial().fields,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { adminSecret, id, ...rest } = args;
    assertAdminApiSecret(adminSecret);
    const current = await ctx.db.get(id);
    if (!current) throw new Error("Kategori bulunamadı.");
    if (rest.attributes) rest.attributes = parseCategoryAttributes(rest.attributes);
    const nextSlug = rest.slug ?? current.slug;
    const slugChanged = nextSlug !== current.slug;
    const nextAttributeKeys = new Set((rest.attributes ?? current.attributes ?? []).map((attribute) => attribute.key));
    const removedAttributeKeys = new Set(
      (current.attributes ?? [])
        .filter((attribute) => !nextAttributeKeys.has(attribute.key))
        .map((attribute) => attribute.key),
    );

    if (rest.slug && rest.slug !== current.slug) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(rest.slug)) {
        throw new Error("Kategori adresi yalnızca küçük harf, rakam ve tire içerebilir.");
      }
      const duplicate = await ctx.db
        .query("categories")
        .withIndex("by_slug", (q) => q.eq("slug", rest.slug!))
        .first();
      if (duplicate) throw new Error("Bu kategori adresi zaten kullanılıyor.");
    }

    if (slugChanged || removedAttributeKeys.size > 0) {
      let cursor: string | null = null;
      let isDone = false;
      while (!isDone) {
        const page = await ctx.db.query("products")
          .withIndex("by_category", (q) => q.eq("categorySlug", current.slug))
          .paginate({ numItems: 100, cursor });
        for (const product of page.page) {
          const attributes = product.attributes ?? [];
          const nextAttributes = removedAttributeKeys.size > 0
            ? attributes.filter((attribute) => !removedAttributeKeys.has(attribute.key))
            : attributes;
          const attributesChanged = nextAttributes.length !== attributes.length;
          if (!slugChanged && !attributesChanged) continue;

          await patchCatalogProduct(ctx, product, {
            ...(slugChanged ? { categorySlug: nextSlug } : {}),
            ...(attributesChanged ? { attributes: nextAttributes } : {}),
            updatedAt: new Date().toISOString(),
          });
        }
        cursor = page.continueCursor;
        isDone = page.isDone;
      }
    }

    const imageChanged = Object.hasOwn(rest, "imageStorageId") && rest.imageStorageId !== current.imageStorageId;
    if (imageChanged && rest.imageStorageId) {
      const image = await ctx.db.system.get("_storage", rest.imageStorageId);
      if (!image || !image.contentType?.startsWith("image/") || image.size > 8 * 1024 * 1024) {
        throw new Error("Kategori görseli geçersiz veya 8 MB sınırını aşıyor.");
      }
    }

    await ctx.db.patch(id, {
      ...rest,
      updatedAt: new Date().toISOString(),
    });
    if (imageChanged && current.imageStorageId) {
      const remainingReference = await ctx.db.query("categories")
        .withIndex("by_image_storage", (q) => q.eq("imageStorageId", current.imageStorageId!))
        .first();
      if (!remainingReference) await ctx.storage.delete(current.imageStorageId);
    }
    return null;
  },
});

export const remove = mutation({
  args: {
    adminSecret: v.string(),
    id: v.id("categories"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);
    const category = await ctx.db.get(args.id);
    if (!category) throw new Error("Kategori bulunamadı.");

    const assignedProduct = await ctx.db
      .query("products")
      .withIndex("by_category", (q) => q.eq("categorySlug", category.slug))
      .first();
    if (assignedProduct) {
      throw new Error("Bu kategori ürünlerde kullanılıyor. Önce ürünleri başka kategoriye taşı.");
    }

    if (category.imageStorageId) {
      const imageReferences = await ctx.db.query("categories")
        .withIndex("by_image_storage", (q) => q.eq("imageStorageId", category.imageStorageId!))
        .take(2);
      if (imageReferences.length === 1 && imageReferences[0]._id === category._id) {
        await ctx.storage.delete(category.imageStorageId);
      }
    }
    await ctx.db.delete(args.id);
    return null;
  },
});

export const generateImageUploadUrl = mutation({
  args: { adminSecret: v.string() },
  returns: v.string(),
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);
    return await ctx.storage.generateUploadUrl();
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
    const categoryReference = await ctx.db.query("categories")
      .withIndex("by_image_storage", (q) => q.eq("imageStorageId", args.storageId))
      .first();
    if (!categoryReference) await ctx.storage.delete(args.storageId);
    return null;
  },
});
