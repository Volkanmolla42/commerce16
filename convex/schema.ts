import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

const attributeTemplateFields = {
  label: v.string(),
  type: v.union(v.literal("text"), v.literal("number"), v.literal("select"), v.literal("multiselect"), v.literal("boolean")),
  unit: v.optional(v.string()), options: v.optional(v.array(v.string())), required: v.boolean(),
};

export default defineSchema({
  ...authTables,

  products: defineTable({
    slug: v.string(),
    title: v.string(),
    priceValue: v.number(),
    availableForSale: v.boolean(),
    attributes: v.optional(v.array(v.object({
      key: v.string(),
      value: v.union(v.string(), v.number(), v.boolean(), v.array(v.string())),
    }))),
    categorySlug: v.optional(v.string()),
    images: v.array(v.object({
      storageId: v.id("_storage"),
      fileName: v.string(),
      selectedOptions: v.optional(v.array(v.object({ name: v.string(), value: v.string() }))), // Empty means shared by all variants.
    })),
    options: v.array(v.object({
      id: v.string(),
      name: v.string(),
      values: v.array(v.string()),
    })),
    variants: v.array(v.object({
      id: v.string(),
      title: v.string(),
      availableForSale: v.boolean(),
      selectedOptions: v.array(v.object({ name: v.string(), value: v.string() })),
      price: v.string(),
      stockQuantity: v.number(),
      sku: v.optional(v.string()),
      barcode: v.optional(v.string()),
    })),
    updatedAt: v.string(),
  })
    .index("by_slug", ["slug"])
    .index("by_available", ["availableForSale"])
    .index("by_category", ["categorySlug"])
    .index("by_available_and_category", ["availableForSale", "categorySlug"])
    .index("by_priceValue", ["priceValue"])
    .index("by_category_and_priceValue", ["categorySlug", "priceValue"])
    .index("by_available_and_priceValue", ["availableForSale", "priceValue"])
    .index("by_available_and_category_and_priceValue", ["availableForSale", "categorySlug", "priceValue"])
    .searchIndex("search_catalog", { searchField: "title", filterFields: ["availableForSale", "categorySlug"] }),

  catalogStats: defineTable({
    key: v.string(), total: v.number(), active: v.number(),
  }).index("by_key", ["key"]),

  catalogFacetValues: defineTable({
    categorySlug: v.string(), key: v.string(), value: v.string(),
    numericValue: v.optional(v.number()), count: v.number(),
  }).index("by_category_and_key_and_value", ["categorySlug", "key", "value"])
    .index("by_category_and_key_and_numericValue", ["categorySlug", "key", "numericValue"]),

  categories: defineTable({
    slug: v.string(),
    title: v.string(),
    description: v.string(),
    imageStorageId: v.optional(v.union(v.id("_storage"), v.null())),
    attributes: v.optional(v.array(v.object({
      key: v.string(),
      ...attributeTemplateFields,
    }))),
    updatedAt: v.string(),
  })
    .index("by_slug", ["slug"])
    .index("by_image_storage", ["imageStorageId"]),

  categoryAttributePresets: defineTable({
    ...attributeTemplateFields,
    normalizedLabel: v.string(),
  }).index("by_normalized_label", ["normalizedLabel"])
    .searchIndex("search_label", { searchField: "normalizedLabel" }),

  coupons: defineTable({
    code: v.string(),
    discountType: v.union(v.literal("percentage"), v.literal("fixed")),
    discountValue: v.number(),
    minOrderAmountKurus: v.optional(v.number()),
    maxDiscountKurus: v.optional(v.number()),
    usageLimit: v.optional(v.number()),
    usedCount: v.number(),
    expiresAt: v.optional(v.number()),
    isActive: v.boolean(),
  }).index("by_code", ["code"]),

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
        sku: v.optional(v.string()),
        image: v.optional(v.string()),
      })
    ),
    total: v.string(),
    couponId: v.optional(v.id("coupons")),
    couponCode: v.optional(v.string()),
    couponDiscountKurus: v.optional(v.number()),
    couponReserved: v.optional(v.boolean()),
    couponRedeemed: v.optional(v.boolean()),
    status: v.union(
      v.literal("pending"),
      v.literal("paid"),
      v.literal("cancelled")
    ),
    paidAt: v.optional(v.number()),
    analyticsSessionId: v.optional(v.string()),
    shippingAddress: v.optional(v.string()),
    legalAcceptance: v.optional(v.object({
      acceptedAt: v.number(),
      distanceSalesAgreement: v.object({
        title: v.string(),
        version: v.string(),
        body: v.string(),
      }),
      preInformationForm: v.object({
        title: v.string(),
        version: v.string(),
        body: v.string(),
      }),
    })),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_analytics_session_id", ["analyticsSessionId"]),

  analyticsSessions: defineTable({
    sessionId: v.string(),
    visitorId: v.string(),
    startedAt: v.number(),
    source: v.string(),
    medium: v.string(),
    campaign: v.optional(v.string()),
    pageViews: v.number(),
    productViews: v.number(),
    addedToCart: v.boolean(),
    checkoutStarted: v.boolean(),
    lastRoute: v.optional(v.string()),
  })
    .index("by_session_id", ["sessionId"])
    .index("by_visitor_id", ["visitorId"])
    .index("by_started_at", ["startedAt"]),

  analyticsPurchases: defineTable({
    orderId: v.id("orders"),
    sessionId: v.string(),
    visitorId: v.string(),
    customerKey: v.string(),
    source: v.string(),
    medium: v.string(),
    campaign: v.optional(v.string()),
    amountCents: v.number(),
    paidAt: v.number(),
  })
    .index("by_order_id", ["orderId"])
    .index("by_paid_at", ["paidAt"])
    .index("by_visitor_id", ["visitorId"]),

  orderEmailEvents: defineTable({
    orderId: v.id("orders"),
    event: v.literal("payment_confirmation"),
    status: v.union(
      v.literal("processing"),
      v.literal("sent"),
      v.literal("failed"),
      v.literal("not_configured"),
      v.literal("review"),
    ),
    idempotencyKey: v.string(),
    error: v.optional(v.string()),
    leaseUntil: v.optional(v.number()),
  })
    .index("by_order_and_event", ["orderId", "event"]),

  productSkus: defineTable({
    sku: v.string(),
    productId: v.id("products"),
    variantId: v.optional(v.string()),
  })
    .index("by_sku", ["sku"])
    .index("by_product", ["productId"]),

  abandonedCarts: defineTable({
    sessionKey: v.string(),
    items: v.array(v.object({
      productId: v.string(),
      variantId: v.optional(v.string()),
      quantity: v.number(),
    })),
    email: v.optional(v.string()),
    emailConsent: v.boolean(),
    emailConsentedAt: v.optional(v.number()),
    emailOptedOutAt: v.optional(v.number()),
    consentCopyVersion: v.string(),
    status: v.union(
      v.literal("active"),
      v.literal("sending"),
      v.literal("sent"),
      v.literal("converted"),
      v.literal("unsubscribed"),
      v.literal("failed"),
      v.literal("expired"),
    ),
    orderId: v.optional(v.id("orders")),
    unsubscribeToken: v.string(),
    restoreToken: v.string(),
    notificationId: v.string(),
    reminderScheduled: v.boolean(),
    lastActivityAt: v.number(),
    expiresAt: v.number(),
    emailSentAt: v.optional(v.number()),
  })
    .index("by_session_key", ["sessionKey"])
    .index("by_order", ["orderId"])
    .index("by_unsubscribe_token", ["unsubscribeToken"])
    .index("by_restore_token", ["restoreToken"]),

  activeCarts: defineTable({
    sessionKey: v.string(),
    items: v.array(v.object({
      productId: v.id("products"),
      variantId: v.optional(v.string()),
      quantity: v.number(),
    })),
    updatedAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_session_key", ["sessionKey"])
    .index("by_updated_at", ["updatedAt"])
    .index("by_expires_at", ["expiresAt"]),

  storeSettings: defineTable({
    key: v.literal("store"),
    storeName: v.string(),
    slogan: v.optional(v.string()),
    logoStorageId: v.optional(v.union(v.id("_storage"), v.null())),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.optional(v.string()),
    announcement: v.optional(v.string()),
    isOpen: v.optional(v.boolean()),
    updatedAt: v.optional(v.string()),
  }).index("by_key", ["key"]),

  addresses: defineTable({
    userId: v.id("users"),
    title: v.string(),
    fullName: v.string(),
    phone: v.string(),
    city: v.string(),
    district: v.string(),
    provinceId: v.string(),
    districtId: v.string(),
    addressLine1: v.string(),
    isDefault: v.boolean(),
  }).index("by_userId", ["userId"]),

  favorites: defineTable({
    userId: v.id("users"),
    productSlug: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_slug", ["userId", "productSlug"]),

});
