import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const categoryValidator = v.object({
  _id: v.id("categories"),
  _creationTime: v.number(),
  slug: v.string(),
  title: v.string(),
  description: v.string(),
  path: v.string(),
  seo: v.object({
    title: v.string(),
    description: v.string(),
  }),
  updatedAt: v.string(),
});

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
    slug: v.string(),
    title: v.string(),
    description: v.string(),
    path: v.string(),
    seo: v.object({
      title: v.string(),
      description: v.string(),
    }),
  },
  returns: v.id("categories"),
  handler: async (ctx, args) => {
    const updatedAt = new Date().toISOString();
    return await ctx.db.insert("categories", {
      ...args,
      updatedAt,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("categories"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    path: v.optional(v.string()),
    seo: v.optional(
      v.object({
        title: v.string(),
        description: v.string(),
      })
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { id, ...rest } = args;
    await ctx.db.patch(id, {
      ...rest,
      updatedAt: new Date().toISOString(),
    });
    return null;
  },
});

export const remove = mutation({
  args: {
    id: v.id("categories"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return null;
  },
});
