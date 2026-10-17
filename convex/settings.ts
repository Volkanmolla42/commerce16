import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { assertAdminApiSecret } from "./adminAuth";
import { DEFAULT_LOW_STOCK_THRESHOLD, MAX_LOW_STOCK_THRESHOLD } from "../lib/catalog/low-stock";
import { DEFAULT_NEW_BADGE_DAYS, MAX_NEW_BADGE_DAYS } from "../lib/catalog/new-badge";

const defaultStoreName = "Mağaza";

const settingsShape = v.object({
  storeName: v.string(),
  slogan: v.string(),
  logoUrl: v.string(),
  logoStorageId: v.union(v.id("_storage"), v.null()),
  phone: v.string(),
  email: v.string(),
  address: v.string(),
  announcement: v.string(),
  isOpen: v.boolean(),
  lowStockThreshold: v.number(),
  newBadgeDays: v.number(),
  freeShippingThreshold: v.number(),
  shippingFee: v.number(),
  shippingCutoffHour: v.number(),
  shippingEstimate: v.string(),
});

function withDefaults(settings?: {
  storeName?: string;
  slogan?: string;
  logoStorageId?: Id<"_storage"> | null;
  phone?: string;
  email?: string;
  address?: string;
  announcement?: string;
  isOpen?: boolean;
  lowStockThreshold?: number;
  newBadgeDays?: number;
  freeShippingThreshold?: number;
  shippingFee?: number;
  shippingCutoffHour?: number;
  shippingEstimate?: string;
} | null) {
  return {
    storeName: settings?.storeName?.trim() || defaultStoreName,
    slogan: settings?.slogan ?? "",
    logoUrl: "",
    logoStorageId: settings?.logoStorageId ?? null,
    phone: settings?.phone ?? "",
    email: settings?.email ?? "",
    address: settings?.address ?? "",
    announcement: settings?.announcement ?? "",
    isOpen: settings?.isOpen ?? true,
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
  handler: async (ctx) => {
    const base = await readStoreSettings(ctx);
    if (base.logoStorageId) {
      base.logoUrl = (await ctx.storage.getUrl(base.logoStorageId)) ?? "";
    }
    return base;
  },
});

export const getBadgeSettings = query({
  args: {},
  returns: v.object({ newBadgeDays: v.number() }),
  handler: async (ctx) => {
    const settings = await readStoreSettings(ctx);
    return { newBadgeDays: settings.newBadgeDays };
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
    storeName: v.string(),
    slogan: v.string(),
    logoStorageId: v.union(v.id("_storage"), v.null()),
    phone: v.string(),
    email: v.string(),
    address: v.string(),
    announcement: v.string(),
    isOpen: v.boolean(),
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

    const storeName = args.storeName.trim();
    if (storeName.length < 2 || storeName.length > 80) {
      throw new Error("Mağaza adı 2 ile 80 karakter arasında olmalı.");
    }
    const email = clean(args.email, 120);
    if (email && !email.includes("@")) throw new Error("E-posta adresi geçersiz.");
    if (args.logoStorageId) {
      const metadata = await ctx.db.system.get("_storage", args.logoStorageId);
      if (!metadata || !metadata.contentType?.startsWith("image/") || metadata.size <= 0) {
        throw new Error("Logo görseli bulunamadı.");
      }
    }
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
      storeName,
      slogan: clean(args.slogan, 140),
      logoStorageId: args.logoStorageId,
      phone: clean(args.phone, 40),
      email,
      address: clean(args.address, 300),
      announcement: clean(args.announcement, 160),
      isOpen: args.isOpen,
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
      if (existing.logoStorageId && existing.logoStorageId !== args.logoStorageId) {
        await ctx.storage.delete(existing.logoStorageId);
      }
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

    return {
      ...withDefaults(next),
      logoUrl: args.logoStorageId
        ? ((await ctx.storage.getUrl(args.logoStorageId)) ?? "")
        : "",
    };
  },
});
