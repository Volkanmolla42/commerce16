import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { orderEmailEventValidator } from "./emails/events";
import { ORDER_STATUS_KEYS, ORDER_PAYMENT_STATUS_KEYS, BILLING_TYPE_KEYS } from "../lib/orders";

const attributeTemplateFields = {
  label: v.string(),
  type: v.union(v.literal("text"), v.literal("number"), v.literal("select"), v.literal("multiselect"), v.literal("boolean")),
  unit: v.optional(v.string()), options: v.optional(v.array(v.string())), required: v.boolean(),
};

// Sipariş durumları lib/orders.ts'teki tek kaynaktan türetilir; yeni durum orada tanımlanır.
const orderStatusValidator = v.union(...ORDER_STATUS_KEYS.map((key) => v.literal(key)));
const orderPaymentStatusValidator = v.union(...ORDER_PAYMENT_STATUS_KEYS.map((key) => v.literal(key)));
const billingTypeValidator = v.union(...BILLING_TYPE_KEYS.map((key) => v.literal(key)));

export const productsTable = defineTable({
  slug: v.string(),
  title: v.string(),
  priceValue: v.number(),
  soldCount: v.optional(v.number()),
  availableForSale: v.boolean(),
  attributes: v.optional(v.array(v.object({
    key: v.string(),
    value: v.union(v.string(), v.number(), v.boolean(), v.array(v.string())),
  }))),
  categorySlug: v.optional(v.string()),
  description: v.optional(v.string()),
  descriptionImageStorageIds: v.optional(v.array(v.id("_storage"))),
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
    compareAtPrice: v.optional(v.string()),
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
  .searchIndex("search_catalog", { searchField: "title", filterFields: ["availableForSale", "categorySlug"] });

export default defineSchema({
  ...authTables,

  products: productsTable,

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

  promotions: defineTable({
    title: v.string(),
    type: v.union(
      v.literal("cart_percentage"),
      v.literal("buy_x_get_y"),
      v.literal("category_free_shipping"),
    ),
    categorySlug: v.optional(v.string()),
    productId: v.optional(v.string()),
    percentage: v.optional(v.number()),
    buyQuantity: v.optional(v.number()),
    payQuantity: v.optional(v.number()),
    minSubtotalKurus: v.optional(v.number()),
    isActive: v.boolean(),
  }).index("by_active", ["isActive"]),

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
    promotionDiscountKurus: v.optional(v.number()),
    promotionTitle: v.optional(v.string()),
    freeShippingPromotionTitle: v.optional(v.string()),
    status: orderStatusValidator,
    paymentStatus: orderPaymentStatusValidator,
    paidAt: v.optional(v.number()),
    shippedAt: v.optional(v.number()),
    deliveredAt: v.optional(v.number()),
    carrier: v.optional(v.string()),
    trackingNumber: v.optional(v.string()),
    trackingUrl: v.optional(v.string()),
    analyticsSessionId: v.optional(v.string()),
    accessToken: v.optional(v.string()),
    shippingAddress: v.optional(v.string()),
    billingType: v.optional(billingTypeValidator),
    companyName: v.optional(v.string()),
    taxOffice: v.optional(v.string()),
    taxNumber: v.optional(v.string()),
    billingAddress: v.optional(v.string()),
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
      termsVersion: v.optional(v.string()),
    })),
    paymentMethod: v.optional(v.union(
      v.literal("cash_on_delivery"),
      v.literal("bank_transfer"),
      v.literal("paytr")
    )),
    paymentMethodTitle: v.optional(v.string()),
    paymentFee: v.optional(v.number()),
    shippingFee: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_payment_status", ["paymentStatus"])
    .index("by_status_and_payment_status", ["status", "paymentStatus"])
    .index("by_status_and_payment_status_and_paymentMethod", ["status", "paymentStatus", "paymentMethod"])
    .index("by_customerEmail", ["customerEmail"])
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
  })
    .index("by_session_id", ["sessionId"])
    .index("by_visitor_id", ["visitorId"])
    .index("by_started_at", ["startedAt"]),

  orderEmailEvents: defineTable({
    orderId: v.id("orders"),
    event: orderEmailEventValidator,
    status: v.union(
      v.literal("processing"),
      v.literal("sent"),
      v.literal("failed"),
      v.literal("not_configured"),
      v.literal("review"),
    ),
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
    lastActivityAt: v.number(),
    expiresAt: v.number(),
    emailSentAt: v.optional(v.number()),
  })
    .index("by_session_key", ["sessionKey"])
    .index("by_order", ["orderId"])
    .index("by_unsubscribe_token", ["unsubscribeToken"])
    .index("by_restore_token", ["restoreToken"])
    .index("by_expires_at", ["expiresAt"]),

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
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    announcement: v.optional(v.string()),
    isOpen: v.optional(v.boolean()),
    lowStockThreshold: v.optional(v.number()),
    newBadgeDays: v.optional(v.number()),
    freeShippingThreshold: v.optional(v.number()),
    shippingFee: v.optional(v.number()),
    shippingCutoffHour: v.optional(v.number()),
    shippingEstimate: v.optional(v.string()),
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
    .index("by_user_and_slug", ["userId", "productSlug"])
    .index("by_product_slug", ["productSlug"]),

  legalAcceptances: defineTable({
    userId: v.id("users"),
    termsVersion: v.string(),
    privacyVersion: v.string(),
    acceptedAt: v.number(),
  }).index("by_user", ["userId"]),

  passwordChangeCodes: defineTable({
    userId: v.id("users"),
    codeHash: v.string(),
    expiresAt: v.number(),
    attempts: v.number(),
  }).index("by_userId", ["userId"]),

  restockSubscriptions: defineTable({
    email: v.string(),
    productId: v.id("products"),
    variantId: v.optional(v.string()),
    status: v.union(v.literal("pending"), v.literal("sending"), v.literal("notified"), v.literal("cancelled")),
    unsubscribeToken: v.string(),
    consentVersion: v.optional(v.string()),
    consentedAt: v.optional(v.number()),
    consentSource: v.optional(v.string()),
  })
    .index("by_product_and_variant", ["productId", "variantId"])
    .index("by_product_and_variant_and_status", ["productId", "variantId", "status"])
    .index("by_email_and_product", ["email", "productId"])
    .index("by_email_and_product_and_variant_and_status", ["email", "productId", "variantId", "status"])
    .index("by_unsubscribe_token", ["unsubscribeToken"])
    .index("by_status", ["status"]),

  lowStockAlerts: defineTable({
    productId: v.id("products"),
    variantId: v.optional(v.string()),
    stockQuantity: v.number(),
    threshold: v.number(),
    sentAt: v.number(),
  })
    .index("by_product_and_variant", ["productId", "variantId"]),

  contactMessages: defineTable({
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    subject: v.string(),
    message: v.string(),
    status: v.union(v.literal("new"), v.literal("read"), v.literal("replied")),
    consentVersion: v.optional(v.string()),
    consentedAt: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_email", ["email"]),

  emailLogs: defineTable({
    templateKey: v.string(),
    recipient: v.string(),
    subject: v.string(),
    htmlBody: v.optional(v.string()),
    textBody: v.optional(v.string()),
    status: v.union(v.literal("sent"), v.literal("failed")),
    resendId: v.optional(v.string()),
    error: v.optional(v.string()),
    metadata: v.optional(v.any()),
  })
    .index("by_recipient", ["recipient"])
    .index("by_template_key", ["templateKey"])
    .index("by_status", ["status"]),

  paymentSettings: defineTable({
    key: v.literal("payment"),
    cashOnDelivery: v.object({
      enabled: v.boolean(),
      fee: v.number(),
      description: v.string(),
    }),
    bankTransfer: v.object({
      enabled: v.boolean(),
      description: v.string(),
      accounts: v.array(v.object({
        id: v.string(),
        bankName: v.string(),
        accountHolder: v.string(),
        iban: v.string(),
      })),
    }),
    paytr: v.object({
      enabled: v.boolean(),
      testMode: v.boolean(),
      merchantId: v.optional(v.string()),
      merchantKey: v.optional(v.string()),
      merchantSalt: v.optional(v.string()),
      description: v.string(),
    }),
    updatedAt: v.optional(v.string()),
  }).index("by_key", ["key"]),

  productQuestions: defineTable({
    productId: v.id("products"),
    userId: v.id("users"),
    question: v.string(),
    answer: v.optional(v.string()),
    answeredAt: v.optional(v.number()),
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
  })
    .index("by_product_and_status", ["productId", "status"])
    .index("by_status", ["status"]),

  reviews: defineTable({
    productId: v.id("products"),
    userId: v.optional(v.id("users")),
    orderId: v.optional(v.id("orders")),
    authorName: v.string(),
    rating: v.number(),
    title: v.optional(v.string()),
    content: v.string(),
    isVerifiedPurchase: v.boolean(),
    status: v.union(v.literal("approved"), v.literal("pending"), v.literal("rejected")),
  })
    .index("by_product", ["productId"])
    .index("by_product_and_status", ["productId", "status"])
    .index("by_user", ["userId"])
    .index("by_user_and_product", ["userId", "productId"])
    .index("by_order", ["orderId"])
    .index("by_order_and_product", ["orderId", "productId"])
    .index("by_status", ["status"]),

  orderFeedback: defineTable({
    orderId: v.id("orders"),
    userId: v.id("users"),
    customerName: v.string(),
    customerEmail: v.string(),
    storeRating: v.number(),
    deliveryRating: v.optional(v.number()),
    comment: v.optional(v.string()),
  })
    .index("by_order", ["orderId"])
    .index("by_user", ["userId"]),
});
