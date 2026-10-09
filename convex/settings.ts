import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { assertAdminApiSecret } from "./adminAuth";

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
    const next = {
      storeName,
      slogan: clean(args.slogan, 140),
      logoStorageId: args.logoStorageId,
      phone: clean(args.phone, 40),
      email,
      address: clean(args.address, 300),
      announcement: clean(args.announcement, 160),
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
