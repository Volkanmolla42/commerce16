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
    storageImages: v.optional(
      v.array(
        v.object({
          storageId: v.id("_storage"),
          fileName: v.string(),
        })
      )
    ),
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

  storeSettings: defineTable({
    key: v.literal("store"),
    storeName: v.string(),
    slogan: v.optional(v.string()),
    logoStorageId: v.optional(v.union(v.id("_storage"), v.null())),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.optional(v.string()),
    announcement: v.optional(v.string()),
    seoTitle: v.optional(v.string()),
    seoDescription: v.optional(v.string()),
    isOpen: v.optional(v.boolean()),
    updatedAt: v.string(),
  }).index("by_key", ["key"]),

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

  favorites: defineTable({
    userId: v.id("users"),
    productSlug: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_slug", ["userId", "productSlug"]),
});
