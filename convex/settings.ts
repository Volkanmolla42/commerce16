import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { assertAdminApiSecret } from "./adminAuth";

const defaultStoreName = "Mağaza";
const maxShippingAmountKurus = 100_000_000;

function shippingQuote(feeKurus: number, thresholdKurus: number | null, subtotalKurus: number) {
  const freeShipping = thresholdKurus !== null && subtotalKurus >= thresholdKurus;
  return {
    shippingCostKurus: feeKurus > 0 && freeShipping ? 0 : feeKurus,
    freeShippingRemainingKurus: thresholdKurus === null ? null : Math.max(0, thresholdKurus - subtotalKurus),
  };
}

const settingsShape = v.object({
  storeName: v.string(),
  slogan: v.string(),
  logoUrl: v.string(),
  logoStorageId: v.union(v.id("_storage"), v.null()),
  phone: v.string(),
  email: v.string(),
  address: v.string(),
  announcement: v.string(),
  shippingCutoffMinutes: v.union(v.number(), v.null()),
  shippingDays: v.array(v.number()),
  shippingFeeKurus: v.number(),
  freeShippingThresholdKurus: v.union(v.number(), v.null()),
  isOpen: v.boolean(),
});

function withDefaults(settings?: {
  storeName?: string;
  slogan?: string;
  logoStorageId?: Id<"_storage"> | null;
  phone?: string;
  email?: string;
  address?: string;
  announcement?: string;
  shippingCutoffMinutes?: number | null;
  shippingDays?: number[];
  shippingFeeKurus?: number;
  freeShippingThresholdKurus?: number | null;
  isOpen?: boolean;
} | null) {
  return {
    storeName: settings?.storeName ?? defaultStoreName,
    slogan: settings?.slogan ?? "",
    logoUrl: "",
    logoStorageId: settings?.logoStorageId ?? null,
    phone: settings?.phone ?? "",
    email: settings?.email ?? "",
    address: settings?.address ?? "",
    announcement: settings?.announcement ?? "",
    shippingCutoffMinutes: settings?.shippingCutoffMinutes ?? null,
    shippingDays: settings?.shippingDays ?? [],
    shippingFeeKurus: settings?.shippingFeeKurus ?? 0,
    freeShippingThresholdKurus: settings?.freeShippingThresholdKurus ?? null,
    isOpen: settings?.isOpen ?? true,
  };
}

export const getStoreSettings = query({
  args: {},
  returns: settingsShape,
  handler: async (ctx) => {
    const settings = await ctx.db
      .query("storeSettings")
      .withIndex("by_key", (q) => q.eq("key", "store"))
      .unique();

    const base = withDefaults(settings);
    if (settings?.logoStorageId) {
      base.logoUrl = (await ctx.storage.getUrl(settings.logoStorageId)) ?? "";
    }
    return base;
  },
});

export const getCheckoutShippingQuote = query({
  args: { subtotalKurus: v.number() },
  returns: v.object({
    shippingCostKurus: v.number(),
    configuredShippingFeeKurus: v.number(),
    freeShippingThresholdKurus: v.union(v.number(), v.null()),
    freeShippingRemainingKurus: v.union(v.number(), v.null()),
  }),
  handler: async (ctx, { subtotalKurus }) => {
    if (!Number.isSafeInteger(subtotalKurus) || subtotalKurus < 0 || subtotalKurus > Number.MAX_SAFE_INTEGER - maxShippingAmountKurus) {
      throw new Error("Sepet tutarı geçersiz.");
    }
    const settings = await ctx.db.query("storeSettings").withIndex("by_key", (q) => q.eq("key", "store")).unique();
    const feeKurus = settings?.shippingFeeKurus ?? 0;
    const thresholdKurus = settings?.freeShippingThresholdKurus ?? null;
    const quote = shippingQuote(feeKurus, thresholdKurus, subtotalKurus);
    return {
      ...quote,
      configuredShippingFeeKurus: feeKurus,
      freeShippingThresholdKurus: thresholdKurus,
    };
  },
});

export const getShippingPromiseSettings = query({
  args: {},
  returns: v.object({
    shippingCutoffMinutes: v.union(v.number(), v.null()),
    shippingDays: v.array(v.number()),
  }),
  handler: async (ctx) => {
    const settings = await ctx.db
      .query("storeSettings")
      .withIndex("by_key", (q) => q.eq("key", "store"))
      .unique();
    return {
      shippingCutoffMinutes: settings?.shippingCutoffMinutes ?? null,
      shippingDays: settings?.shippingDays ?? [],
    };
  },
});

function clean(value: string, max: number) {
  const text = value.trim();
  if (text.length > max) {
    throw new Error(`Alan ${max} karakteri aşamaz.`);
  }
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
    shippingCutoffMinutes: v.union(v.number(), v.null()),
    shippingDays: v.array(v.number()),
    shippingFeeKurus: v.number(),
    freeShippingThresholdKurus: v.union(v.number(), v.null()),
    isOpen: v.boolean(),
  },
  returns: settingsShape,
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);

    const storeName = args.storeName.trim();
    if (storeName.length < 2 || storeName.length > 80) {
      throw new Error("Mağaza adı 2 ile 80 karakter arasında olmalı.");
    }
    const email = clean(args.email, 120);
    if (email && !email.includes("@")) {
      throw new Error("E-posta adresi geçersiz.");
    }
    if (args.logoStorageId) {
      const metadata = await ctx.db.system.get("_storage", args.logoStorageId);
      if (!metadata || !metadata.contentType?.startsWith("image/") || metadata.size <= 0) {
        throw new Error("Logo görseli bulunamadı.");
      }
    }
    if (args.shippingCutoffMinutes !== null &&
      (!Number.isSafeInteger(args.shippingCutoffMinutes) || args.shippingCutoffMinutes < 0 || args.shippingCutoffMinutes >= 24 * 60)) {
      throw new Error("Kargo kesim saati geçerli değil.");
    }
    if (args.shippingDays.some((day) => !Number.isSafeInteger(day) || day < 0 || day > 6) ||
      new Set(args.shippingDays).size !== args.shippingDays.length) {
      throw new Error("Kargo günlerini kontrol edin.");
    }
    if (args.shippingCutoffMinutes !== null && args.shippingDays.length === 0) {
      throw new Error("Kargo saati ayarlamak için en az bir kargo günü seçin.");
    }
    if (!Number.isSafeInteger(args.shippingFeeKurus) || args.shippingFeeKurus < 0 || args.shippingFeeKurus > maxShippingAmountKurus) {
      throw new Error("Sabit kargo ücreti 0 ile 1.000.000 TL arasında olmalı.");
    }
    if (args.freeShippingThresholdKurus !== null &&
      (!Number.isSafeInteger(args.freeShippingThresholdKurus) || args.freeShippingThresholdKurus < 0 || args.freeShippingThresholdKurus > maxShippingAmountKurus)) {
      throw new Error("Ücretsiz kargo limiti 0 ile 1.000.000 TL arasında olmalı.");
    }
    const next = {
      storeName,
      slogan: clean(args.slogan, 140),
      logoStorageId: args.logoStorageId,
      phone: clean(args.phone, 40),
      email,
      address: clean(args.address, 300),
      announcement: clean(args.announcement, 160),
      shippingCutoffMinutes: args.shippingCutoffMinutes,
      shippingDays: args.shippingDays,
      shippingFeeKurus: args.shippingFeeKurus,
      freeShippingThresholdKurus: args.freeShippingThresholdKurus,
      isOpen: args.isOpen,
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
        updatedAt: new Date().toISOString(),
      });
    } else {
      await ctx.db.insert("storeSettings", {
        key: "store",
        ...next,
        updatedAt: new Date().toISOString(),
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
