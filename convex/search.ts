import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { normalizeSearchText } from "../lib/catalog/smart-search";

export const record = mutation({
  args: { query: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const display = args.query.trim().replace(/\s+/g, " ");
    if (display.length < 2 || display.length > 60) return null;
    const normalized = normalizeSearchText(display);
    if (!normalized) return null;
    const existing = await ctx.db
      .query("searchQueries")
      .withIndex("by_normalized", (q) => q.eq("normalized", normalized))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        query: display,
        count: existing.count + 1,
      });
    } else {
      const stored = await ctx.db.query("searchQueries").take(501);
      if (stored.length >= 500) return null;
      await ctx.db.insert("searchQueries", {
        query: display,
        normalized,
        count: 1,
      });
    }
    return null;
  },
});

export const popular = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.object({ query: v.string() })),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 5, 1), 10);
    const rows = await ctx.db
      .query("searchQueries")
      .withIndex("by_count", (q) => q.gte("count", 2))
      .order("desc")
      .take(limit);
    return rows.map(({ query }) => ({ query }));
  },
});
