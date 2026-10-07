import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import schema from "./schema";
import { assertAdminApiSecret } from "./adminAuth";
import type { CategoryAttributeDefinition } from "../lib/catalog/attributes";

const storedCategoryValidator = schema.doc("categories");
const categoryValidator = storedCategoryValidator.omit("seo");
const categoryInputValidator = categoryValidator.omit("_id", "_creationTime", "updatedAt", "path");
const categoryWithImageValidator = categoryValidator.extend({
  imageUrl: v.union(v.string(), v.null()),
});

function categoryWithoutLegacySeo(category: typeof storedCategoryValidator.type) {
  const result = { ...category };
  delete result.seo;
  result.attributes = result.attributes?.map(({ key, label, type, unit, options, required }) => ({
    key,
    label,
    type,
    ...(unit ? { unit } : {}),
    ...(options ? { options } : {}),
    required,
  }));
  return result;
}

function categoryAttributesWithoutLegacyFilter(attributes: CategoryAttributeDefinition[] | undefined) {
  return attributes?.map(({ key, label, type, unit, options, required }) => ({
    key,
    label,
    type,
    ...(unit ? { unit } : {}),
    ...(options ? { options } : {}),
    required,
  }));
}

function validateCategoryAttributes(attributes: CategoryAttributeDefinition[] | undefined) {
  if (!attributes) return;
  if (attributes.length > 30) throw new Error("Kategoriye en fazla 30 özellik eklenebilir.");
  const keys = new Set<string>();
  const labels = new Set<string>();
  for (const attribute of attributes) {
    if (!/^[a-z][a-z0-9-]{0,39}$/.test(attribute.key) || !attribute.label.trim() || attribute.label.length > 80) {
      throw new Error("Kategori özellik adını ve anahtarını kontrol edin.");
    }
    const normalizedLabel = attribute.label.trim().toLocaleLowerCase("tr-TR");
    if (keys.has(attribute.key) || labels.has(normalizedLabel)) throw new Error("Özellik adları birbirinden farklı olmalı.");
    keys.add(attribute.key);
    labels.add(normalizedLabel);
    const options = attribute.options ?? [];
    if (options.length > 100 || options.some((option) => !option.trim())) throw new Error("Özellik seçenekleri geçersiz.");
    if (attribute.type !== "select" && attribute.type !== "multiselect" && options.length > 0) {
      throw new Error("Seçenekler yalnızca seçim listelerinde kullanılabilir.");
    }
    if ((attribute.type === "select" || attribute.type === "multiselect") && options.length === 0) {
      throw new Error("Seçim listesi türündeki özellikler için en az bir seçenek girmelisiniz.");
    }
    if (attribute.type === "number" && attribute.unit && attribute.unit.length > 20) throw new Error("Ölçü birimi 20 karakteri aşamaz.");
    if (attribute.type !== "number" && attribute.unit) throw new Error("Ölçü birimi yalnızca sayısal özelliklerde kullanılabilir.");
    if (new Set(options.map((option) => option.trim().toLocaleLowerCase("tr-TR"))).size !== options.length) {
      throw new Error("Özellik seçenekleri birbirinden farklı olmalı.");
    }
  }
}

export const list = query({
  args: {},
  returns: v.array(categoryWithImageValidator),
  handler: async (ctx) => {
    const categories = await ctx.db.query("categories").take(100);
    return await Promise.all(categories.map(async (category) => ({
      ...categoryWithoutLegacySeo(category),
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
    const result = [];
    for (const category of categories) {
      if (category.seo !== undefined) await ctx.db.patch(category._id, { seo: undefined });
      result.push({
        ...categoryWithoutLegacySeo(category),
        imageUrl: category.imageStorageId
          ? await ctx.storage.getUrl(category.imageStorageId)
          : null,
      });
    }
    return result;
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
    return category ? categoryWithoutLegacySeo(category) : null;
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
    validateCategoryAttributes(category.attributes);
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
      attributes: categoryAttributesWithoutLegacyFilter(category.attributes),
      path: `/search/${category.slug}`,
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
    validateCategoryAttributes(rest.attributes);

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

    if (rest.slug && rest.slug !== current.slug) {
      let cursor: string | null = null;
      let isDone = false;
      while (!isDone) {
        const page = await ctx.db.query("products")
          .withIndex("by_category", (q) => q.eq("categorySlug", current.slug))
          .paginate({ numItems: 100, cursor });
        for (const product of page.page) {
          await ctx.db.patch(product._id, {
            categorySlug: rest.slug,
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
      ...(rest.attributes ? { attributes: categoryAttributesWithoutLegacyFilter(rest.attributes) } : {}),
      ...(rest.slug ? { path: `/search/${rest.slug}` } : {}),
      seo: undefined,
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
