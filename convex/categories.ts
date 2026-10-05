import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import schema from "./schema";
import { assertAdminApiSecret } from "./adminAuth";

const categoryValidator = schema.doc("categories");
const categoryInputValidator = categoryValidator.omit("_id", "_creationTime", "updatedAt");

export const list = query({
  args: {},
  returns: v.array(categoryValidator),
  handler: async (ctx) => {
    return await ctx.db.query("categories").take(100);
  },
});

export const getBySlug = query({
  args: {
    slug: v.string(),
  },
  returns: v.union(categoryValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("categories")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
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
    const existing = await ctx.db
      .query("categories")
      .withIndex("by_slug", (q) => q.eq("slug", category.slug))
      .first();
    if (existing) throw new Error("Bu kategori adresi zaten kullanılıyor.");

    const updatedAt = new Date().toISOString();
    return await ctx.db.insert("categories", { ...category, updatedAt });
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

    if (rest.slug && rest.slug !== current.slug) {
      const assignedProduct = await ctx.db.query("products").withIndex("by_category", (q) => q.eq("categorySlug", current.slug)).first();
      if (assignedProduct) throw new Error("Kullanılan kategorinin adresi değiştirilemez. Önce ürünleri başka kategoriye taşı.");
      const duplicate = await ctx.db
        .query("categories")
        .withIndex("by_slug", (q) => q.eq("slug", rest.slug!))
        .first();
      if (duplicate) throw new Error("Bu kategori adresi zaten kullanılıyor.");
    }

    await ctx.db.patch(id, {
      ...rest,
      updatedAt: new Date().toISOString(),
    });
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

    await ctx.db.delete(args.id);
    return null;
  },
});
