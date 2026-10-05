import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { assertAdminApiSecret } from "./adminAuth";

const defaultStoreName = "Mağaza";

export const getStoreSettings = query({
  args: {},
  returns: v.object({ storeName: v.string() }),
  handler: async (ctx) => {
    const settings = await ctx.db
      .query("storeSettings")
      .withIndex("by_key", (q) => q.eq("key", "store"))
      .unique();

    return { storeName: settings?.storeName ?? defaultStoreName };
  },
});

export const updateStoreName = mutation({
  args: {
    adminSecret: v.string(),
    storeName: v.string(),
  },
  returns: v.object({ storeName: v.string() }),
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);

    const storeName = args.storeName.trim();
    if (storeName.length < 2 || storeName.length > 80) {
      throw new Error("Mağaza adı 2 ile 80 karakter arasında olmalı.");
    }

    const existing = await ctx.db
      .query("storeSettings")
      .withIndex("by_key", (q) => q.eq("key", "store"))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        storeName,
        updatedAt: new Date().toISOString(),
      });
    } else {
      await ctx.db.insert("storeSettings", {
        key: "store",
        storeName,
        updatedAt: new Date().toISOString(),
      });
    }

    return { storeName };
  },
});
