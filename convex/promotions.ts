import { v } from "convex/values";
import { assertAdminApiSecret } from "./adminAuth";
import { mutation, query, type MutationCtx } from "./_generated/server";
import schema from "./schema";

const promotionValidator = schema.doc("promotions");
const promotionTypeValidator = v.union(
  v.literal("cart_percentage"),
  v.literal("buy_x_get_y"),
  v.literal("category_free_shipping"),
);

const promotionFields = {
  title: v.string(),
  type: promotionTypeValidator,
  categorySlug: v.optional(v.string()),
  productId: v.optional(v.string()),
  percentage: v.optional(v.number()),
  buyQuantity: v.optional(v.number()),
  payQuantity: v.optional(v.number()),
  minSubtotalKurus: v.optional(v.number()),
  isActive: v.boolean(),
};

async function assertCategory(ctx: MutationCtx, slug: string) {
  const category = await ctx.db.query("categories").withIndex("by_slug", (q) => q.eq("slug", slug)).unique();
  if (!category) throw new Error("Seçilen kategori bulunamadı.");
}

async function normalizeTargetProductId(ctx: MutationCtx, value: string) {
  const productId = ctx.db.normalizeId("products", value);
  if (!productId) throw new Error("Seçilen ürün bulunamadı.");
  const product = await ctx.db.get(productId);
  if (!product) throw new Error("Seçilen ürün bulunamadı.");
  return String(product._id);
}

export const listActive = query({
  args: {},
  returns: v.array(v.object({
    id: v.string(),
    title: v.string(),
    type: promotionTypeValidator,
    categorySlug: v.optional(v.string()),
    productId: v.optional(v.string()),
    percentage: v.optional(v.number()),
    buyQuantity: v.optional(v.number()),
    payQuantity: v.optional(v.number()),
    minSubtotalKurus: v.optional(v.number()),
  })),
  handler: async (ctx) => {
    const rows = await ctx.db.query("promotions").withIndex("by_active", (q) => q.eq("isActive", true)).take(50);
    return rows.map((rule) => ({
      id: rule._id,
      title: rule.title,
      type: rule.type,
      ...(rule.categorySlug !== undefined ? { categorySlug: rule.categorySlug } : {}),
      ...(rule.productId !== undefined ? { productId: rule.productId } : {}),
      ...(rule.percentage !== undefined ? { percentage: rule.percentage } : {}),
      ...(rule.buyQuantity !== undefined ? { buyQuantity: rule.buyQuantity } : {}),
      ...(rule.payQuantity !== undefined ? { payQuantity: rule.payQuantity } : {}),
      ...(rule.minSubtotalKurus !== undefined ? { minSubtotalKurus: rule.minSubtotalKurus } : {}),
    }));
  },
});

export const listAdmin = query({
  args: { adminSecret: v.string() },
  returns: v.array(promotionValidator),
  handler: async (ctx, { adminSecret }) => {
    assertAdminApiSecret(adminSecret);
    return await ctx.db.query("promotions").order("desc").take(200);
  },
});

export const create = mutation({
  args: { adminSecret: v.string(), ...promotionFields },
  returns: v.id("promotions"),
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);
    const title = args.title.trim();
    if (title.length < 2 || title.length > 80) throw new Error("Kampanya adı 2 ile 80 karakter arasında olmalı.");
    const minSubtotalKurus = args.type === "category_free_shipping" ? undefined : args.minSubtotalKurus;
    if (minSubtotalKurus !== undefined && (!Number.isSafeInteger(minSubtotalKurus) || minSubtotalKurus < 0)) {
      throw new Error("Asgari sepet tutarı geçersiz.");
    }
    const categorySlug = args.type === "cart_percentage"
      ? undefined
      : args.categorySlug?.trim() || undefined;
    const productId = args.productId?.trim()
      ? await normalizeTargetProductId(ctx, args.productId.trim())
      : undefined;
    if (categorySlug && productId) throw new Error("Kategori ve ürün aynı anda hedeflenemez.");
    if (args.type === "category_free_shipping" && !categorySlug && !productId) {
      throw new Error("Kargo bedava kampanyası için kategori veya ürün seçin.");
    }
    if (categorySlug) await assertCategory(ctx, categorySlug);

    const percentage = args.type === "cart_percentage" ? args.percentage : undefined;
    if (args.type === "cart_percentage" &&
      (percentage === undefined || !Number.isSafeInteger(percentage) || percentage < 1 || percentage > 90)) {
      throw new Error("Yüzde indirimi 1 ile 90 arasında tam sayı olmalı.");
    }
    const buyQuantity = args.type === "buy_x_get_y" ? args.buyQuantity : undefined;
    const payQuantity = args.type === "buy_x_get_y" ? args.payQuantity : undefined;
    if (args.type === "buy_x_get_y" &&
      (buyQuantity === undefined || payQuantity === undefined ||
        !Number.isSafeInteger(buyQuantity) || !Number.isSafeInteger(payQuantity) ||
        buyQuantity < 2 || buyQuantity > 10 || payQuantity < 1 || payQuantity >= buyQuantity)) {
      throw new Error("Kampanya adetleri geçersiz.");
    }

    return await ctx.db.insert("promotions", {
      title,
      type: args.type,
      ...(categorySlug !== undefined ? { categorySlug } : {}),
      ...(productId !== undefined ? { productId } : {}),
      ...(percentage !== undefined ? { percentage } : {}),
      ...(buyQuantity !== undefined ? { buyQuantity } : {}),
      ...(payQuantity !== undefined ? { payQuantity } : {}),
      ...(minSubtotalKurus !== undefined ? { minSubtotalKurus } : {}),
      isActive: args.isActive,
    });
  },
});

export const disable = mutation({
  args: { adminSecret: v.string(), id: v.id("promotions") },
  returns: v.null(),
  handler: async (ctx, { adminSecret, id }) => {
    assertAdminApiSecret(adminSecret);
    const rule = await ctx.db.get(id);
    if (!rule) throw new Error("Kampanya bulunamadı.");
    await ctx.db.patch(id, { isActive: false });
    return null;
  },
});
