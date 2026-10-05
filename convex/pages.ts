import { query } from "./_generated/server";
import { v } from "convex/values";

const pageValidator = v.object({
  _id: v.id("pages"),
  _creationTime: v.number(),
  title: v.string(),
  slug: v.string(),
  body: v.string(),
  bodySummary: v.string(),
  seo: v.optional(
    v.object({
      title: v.string(),
      description: v.string(),
    })
  ),
  updatedAt: v.string(),
});

export const list = query({
  args: {},
  returns: v.array(pageValidator),
  handler: async (ctx) => {
    return await ctx.db.query("pages").take(50);
  },
});

export const getBySlug = query({
  args: {
    slug: v.string(),
  },
  returns: v.union(pageValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("pages")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
  },
});
