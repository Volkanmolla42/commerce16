import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const productValidator = v.object({
  _id: v.id("products"),
  _creationTime: v.number(),
  slug: v.string(),
  title: v.string(),
  price: v.string(),
  availableForSale: v.boolean(),
  categorySlug: v.optional(v.string()),
  images: v.array(v.string()),
  options: v.optional(
    v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        values: v.array(v.string()),
      })
    )
  ),
  variants: v.optional(
    v.array(
      v.object({
        id: v.string(),
        title: v.string(),
        availableForSale: v.boolean(),
        selectedOptions: v.array(
          v.object({
            name: v.string(),
            value: v.string(),
          })
        ),
        price: v.string(),
      })
    )
  ),
  seo: v.optional(
    v.object({
      title: v.string(),
      description: v.string(),
    })
  ),
  updatedAt: v.string(),
});

export const list = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(productValidator),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const items = await ctx.db
      .query("products")
      .withIndex("by_available", (q) => q.eq("availableForSale", true))
      .take(limit);
    return items;
  },
});

export const listAllAdmin = query({
  args: {},
  returns: v.array(productValidator),
  handler: async (ctx) => {
    return await ctx.db.query("products").order("desc").take(100);
  },
});

export const getBySlug = query({
  args: {
    slug: v.string(),
  },
  returns: v.union(productValidator, v.null()),
  handler: async (ctx, args) => {
    const product = await ctx.db
      .query("products")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    return product;
  },
});

export const create = mutation({
  args: {
    slug: v.string(),
    title: v.string(),
    price: v.string(),
    availableForSale: v.boolean(),
    categorySlug: v.optional(v.string()),
    images: v.array(v.string()),
    options: v.optional(
      v.array(
        v.object({
          id: v.string(),
          name: v.string(),
          values: v.array(v.string()),
        })
      )
    ),
    variants: v.optional(
      v.array(
        v.object({
          id: v.string(),
          title: v.string(),
          availableForSale: v.boolean(),
          selectedOptions: v.array(
            v.object({
              name: v.string(),
              value: v.string(),
            })
          ),
          price: v.string(),
        })
      )
    ),
    seo: v.optional(
      v.object({
        title: v.string(),
        description: v.string(),
      })
    ),
  },
  returns: v.id("products"),
  handler: async (ctx, args) => {
    const updatedAt = new Date().toISOString();
    return await ctx.db.insert("products", {
      ...args,
      updatedAt,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("products"),
    slug: v.optional(v.string()),
    title: v.optional(v.string()),
    price: v.optional(v.string()),
    availableForSale: v.optional(v.boolean()),
    categorySlug: v.optional(v.string()),
    images: v.optional(v.array(v.string())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { id, ...rest } = args;
    const current = await ctx.db.get(id);
    if (!current) throw new Error("Ürün bulunamadı");

    await ctx.db.patch(id, {
      ...rest,
      updatedAt: new Date().toISOString(),
    });
    return null;
  },
});

export const remove = mutation({
  args: {
    id: v.id("products"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return null;
  },
});
