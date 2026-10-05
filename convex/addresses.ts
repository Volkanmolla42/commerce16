import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getMyAddresses = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const addresses = await ctx.db
      .query("addresses")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    // Varsayılan adres en başta olacak şekilde sırala
    return addresses.sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0));
  },
});

export const addAddress = mutation({
  args: {
    title: v.string(),
    fullName: v.string(),
    phone: v.string(),
    city: v.string(),
    district: v.string(),
    addressLine1: v.string(),
    addressLine2: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    isDefault: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Giriş yapmanız gerekmektedir.");

    const existing = await ctx.db
      .query("addresses")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    const isFirstAddress = existing.length === 0;
    const shouldBeDefault = args.isDefault || isFirstAddress;

    if (shouldBeDefault) {
      for (const addr of existing) {
        if (addr.isDefault) {
          await ctx.db.patch(addr._id, { isDefault: false });
        }
      }
    }

    const addressId = await ctx.db.insert("addresses", {
      userId,
      title: args.title,
      fullName: args.fullName,
      phone: args.phone,
      city: args.city,
      district: args.district,
      addressLine1: args.addressLine1,
      addressLine2: args.addressLine2,
      postalCode: args.postalCode,
      isDefault: shouldBeDefault,
    });

    return addressId;
  },
});

export const updateAddress = mutation({
  args: {
    addressId: v.id("addresses"),
    title: v.string(),
    fullName: v.string(),
    phone: v.string(),
    city: v.string(),
    district: v.string(),
    addressLine1: v.string(),
    addressLine2: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    isDefault: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Giriş yapmanız gerekmektedir.");

    const address = await ctx.db.get(args.addressId);
    if (!address || address.userId !== userId) {
      throw new Error("Adres bulunamadı veya yetkiniz yok.");
    }

    if (args.isDefault && !address.isDefault) {
      const existing = await ctx.db
        .query("addresses")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();

      for (const addr of existing) {
        if (addr._id !== args.addressId && addr.isDefault) {
          await ctx.db.patch(addr._id, { isDefault: false });
        }
      }
    }

    await ctx.db.patch(args.addressId, {
      title: args.title,
      fullName: args.fullName,
      phone: args.phone,
      city: args.city,
      district: args.district,
      addressLine1: args.addressLine1,
      addressLine2: args.addressLine2,
      postalCode: args.postalCode,
      isDefault: args.isDefault,
    });

    return null;
  },
});

export const deleteAddress = mutation({
  args: {
    addressId: v.id("addresses"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Giriş yapmanız gerekmektedir.");

    const address = await ctx.db.get(args.addressId);
    if (!address || address.userId !== userId) {
      throw new Error("Adres bulunamadı veya yetkiniz yok.");
    }

    const wasDefault = address.isDefault;
    await ctx.db.delete(args.addressId);

    // Eğer silinen adres varsayılansa ve başka adres varsa, birini varsayılan yap
    if (wasDefault) {
      const remaining = await ctx.db
        .query("addresses")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();

      if (remaining) {
        await ctx.db.patch(remaining._id, { isDefault: true });
      }
    }

    return null;
  },
});

export const setDefaultAddress = mutation({
  args: {
    addressId: v.id("addresses"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Giriş yapmanız gerekmektedir.");

    const address = await ctx.db.get(args.addressId);
    if (!address || address.userId !== userId) {
      throw new Error("Adres bulunamadı veya yetkiniz yok.");
    }

    const all = await ctx.db
      .query("addresses")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    for (const addr of all) {
      const shouldBe = addr._id === args.addressId;
      if (addr.isDefault !== shouldBe) {
        await ctx.db.patch(addr._id, { isDefault: shouldBe });
      }
    }

    return null;
  },
});
