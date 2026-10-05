import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,

  products: defineTable({
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
  })
    .index("by_slug", ["slug"])
    .index("by_available", ["availableForSale"])
    .index("by_category", ["categorySlug"]),

  categories: defineTable({
    slug: v.string(),
    title: v.string(),
    description: v.string(),
    path: v.string(),
    seo: v.object({
      title: v.string(),
      description: v.string(),
    }),
    updatedAt: v.string(),
  }).index("by_slug", ["slug"]),

  orders: defineTable({
    userId: v.optional(v.id("users")),
    customerEmail: v.string(),
    customerName: v.string(),
    customerPhone: v.optional(v.string()),
    items: v.array(
      v.object({
        productId: v.string(),
        variantId: v.optional(v.string()),
        title: v.string(),
        quantity: v.number(),
        price: v.string(),
        image: v.optional(v.string()),
      })
    ),
    total: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("paid"),
      v.literal("shipped"),
      v.literal("delivered"),
      v.literal("cancelled")
    ),
    shippingAddress: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),

  pages: defineTable({
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
  }).index("by_slug", ["slug"]),

  addresses: defineTable({
    userId: v.id("users"),
    title: v.string(),
    fullName: v.string(),
    phone: v.string(),
    city: v.string(),
    district: v.string(),
    addressLine1: v.string(),
    addressLine2: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    isDefault: v.boolean(),
  }).index("by_userId", ["userId"]),
});
