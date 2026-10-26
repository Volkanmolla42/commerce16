import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { TableNames } from "./_generated/dataModel";
import { v } from "convex/values";
import { assertAdminApiSecret } from "./adminAuth";
import { DEFAULT_LOW_STOCK_THRESHOLD, MAX_LOW_STOCK_THRESHOLD } from "../lib/catalog/low-stock";
import { DEFAULT_NEW_BADGE_DAYS, MAX_NEW_BADGE_DAYS } from "../lib/catalog/new-badge";

const settingsShape = v.object({
  phone: v.string(),
  email: v.string(),
  announcement: v.string(),
  lowStockThreshold: v.number(),
  newBadgeDays: v.number(),
  freeShippingThreshold: v.number(),
  shippingFee: v.number(),
  shippingCutoffHour: v.number(),
  shippingEstimate: v.string(),
});

function withDefaults(settings?: {
  phone?: string;
  email?: string;
  announcement?: string;
  lowStockThreshold?: number;
  newBadgeDays?: number;
  freeShippingThreshold?: number;
  shippingFee?: number;
  shippingCutoffHour?: number;
  shippingEstimate?: string;
} | null) {
  return {
    phone: settings?.phone ?? "",
    email: settings?.email ?? "",
    announcement: settings?.announcement ?? "",
    lowStockThreshold: settings?.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD,
    newBadgeDays: settings?.newBadgeDays ?? DEFAULT_NEW_BADGE_DAYS,
    freeShippingThreshold: settings?.freeShippingThreshold ?? 0,
    shippingFee: settings?.shippingFee ?? 0,
    shippingCutoffHour: settings?.shippingCutoffHour ?? 0,
    shippingEstimate: settings?.shippingEstimate ?? "",
  };
}

// Düşük stok eşiği mağaza ayarından okunur; ayarlanmadıysa varsayılana düşer.
export async function resolveLowStockThreshold(ctx: QueryCtx | MutationCtx) {
  const settings = await ctx.db
    .query("storeSettings")
    .withIndex("by_key", (q) => q.eq("key", "store"))
    .unique();
  return settings?.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD;
}

export async function readStoreSettings(ctx: QueryCtx | MutationCtx) {
  const settings = await ctx.db
    .query("storeSettings")
    .withIndex("by_key", (q) => q.eq("key", "store"))
    .unique();
  return withDefaults(settings);
}

export const getStoreSettings = query({
  args: {},
  returns: settingsShape,
  handler: async (ctx) => await readStoreSettings(ctx),
});

export const getBadgeSettings = query({
  args: {},
  returns: v.object({ newBadgeDays: v.number(), lowStockThreshold: v.number() }),
  handler: async (ctx) => {
    const settings = await readStoreSettings(ctx);
    return { newBadgeDays: settings.newBadgeDays, lowStockThreshold: settings.lowStockThreshold };
  },
});

function clean(value: string, max: number) {
  const text = value.trim();
  if (text.length > max) throw new Error(`Alan ${max} karakteri aşamaz.`);
  return text;
}

export const updateStoreSettings = mutation({
  args: {
    adminSecret: v.string(),
    phone: v.string(),
    email: v.string(),
    announcement: v.string(),
    lowStockThreshold: v.number(),
    newBadgeDays: v.optional(v.number()),
    freeShippingThreshold: v.optional(v.number()),
    shippingFee: v.optional(v.number()),
    shippingCutoffHour: v.optional(v.number()),
    shippingEstimate: v.optional(v.string()),
  },
  returns: settingsShape,
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);

    const email = clean(args.email, 120);
    if (email && !email.includes("@")) throw new Error("E-posta adresi geçersiz.");
    if (!Number.isSafeInteger(args.lowStockThreshold) || args.lowStockThreshold < 0 || args.lowStockThreshold > MAX_LOW_STOCK_THRESHOLD) {
      throw new Error(`Düşük stok eşiği 0 ile ${MAX_LOW_STOCK_THRESHOLD} arasında tam sayı olmalı.`);
    }
    const newBadgeDays = args.newBadgeDays ?? DEFAULT_NEW_BADGE_DAYS;
    if (!Number.isSafeInteger(newBadgeDays) || newBadgeDays < 0 || newBadgeDays > MAX_NEW_BADGE_DAYS) {
      throw new Error(`Yeni ürün rozeti süresi 0 ile ${MAX_NEW_BADGE_DAYS} gün arasında tam sayı olmalı.`);
    }
    const shippingCutoffHour = args.shippingCutoffHour ?? 0;
    if (!Number.isSafeInteger(shippingCutoffHour) || shippingCutoffHour < 0 || shippingCutoffHour > 23) {
      throw new Error("Kargo kesim saati 0 ile 23 arasında tam sayı olmalı.");
    }
    const shippingEstimate = clean(args.shippingEstimate ?? "", 80);
    const next = {
      phone: clean(args.phone, 40),
      email,
      announcement: clean(args.announcement, 160),
      lowStockThreshold: args.lowStockThreshold,
      newBadgeDays,
      freeShippingThreshold: Math.max(0, args.freeShippingThreshold ?? 0),
      shippingFee: Math.max(0, args.shippingFee ?? 0),
      shippingCutoffHour,
      shippingEstimate,
    };

    const existing = await ctx.db
      .query("storeSettings")
      .withIndex("by_key", (q) => q.eq("key", "store"))
      .unique();

    if (existing) {
      await ctx.db.replace(existing._id, {
        key: "store",
        ...next,
      });
    } else {
      await ctx.db.insert("storeSettings", {
        key: "store",
        ...next,
      });
    }

    return withDefaults(next);
  },
});

export const resetAllData = mutation({
  args: { adminSecret: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);

    const tables: TableNames[] = [
      "products",
      "catalogStats",
      "catalogFacetValues",
      "categories",
      "categoryAttributePresets",
      "coupons",
      "promotions",
      "orders",
      "analyticsSessions",
      "orderEmailEvents",
      "productSkus",
      "abandonedCarts",
      "activeCarts",
      "storeSettings",
      "addresses",
      "favorites",
      "passwordChangeCodes",
      "restockSubscriptions",
      "lowStockAlerts",
      "contactMessages",
      "emailLogs",
      "paymentSettings",
      "productQuestions",
      "reviews",
      "orderFeedback",
      "users",
      "authSessions",
      "authAccounts",
      "authRefreshTokens",
      "authVerificationCodes",
      "authVerifiers",
      "authRateLimits",
    ];

    for (const tableName of tables) {
      const rows = await ctx.db.query(tableName).collect();
      for (const row of rows) {
        await ctx.db.delete(row._id);
      }
    }

    const storageFiles = await ctx.db.system.query("_storage").collect();
    for (const file of storageFiles) {
      try {
        await ctx.storage.delete(file._id);
      } catch {
        // Silinmiş veya erişilemeyen dosyalar gözardı edilir
      }
    }

    return null;
  },
});

