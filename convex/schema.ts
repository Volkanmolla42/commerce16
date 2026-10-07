import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,

  products: defineTable({
    slug: v.string(),
    title: v.string(),
    price: v.string(),
    sku: v.optional(v.string()),
    vatRate: v.optional(v.number()),
    compareAtPriceKurus: v.optional(v.union(v.number(), v.null())),
    availableForSale: v.boolean(),
    stockQuantity: v.optional(v.union(v.number(), v.null())),
    brand: v.optional(v.string()),
    material: v.optional(v.string()),
    attributes: v.optional(v.array(v.object({
      key: v.string(),
      value: v.union(v.string(), v.number(), v.boolean(), v.array(v.string())),
    }))),
    // Legacy catalog rating. New code derives ratings from verified reviews.
    rating: v.optional(v.number()),
    categorySlug: v.optional(v.string()),
    // Legacy curated recommendations. New code derives recommendations from catalog and order data.
    complementaryProductIds: v.optional(v.array(v.id("products"))),
    upsellProductIds: v.optional(v.array(v.id("products"))),
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
          // Omitted variant prices inherit the product's base price.
          price: v.optional(v.string()),
          sku: v.optional(v.string()),
          barcode: v.optional(v.string()),
          vatRate: v.optional(v.number()),
          compareAtPriceKurus: v.optional(v.union(v.number(), v.null())),
          stockQuantity: v.optional(v.union(v.number(), v.null())),
          storageImageId: v.optional(v.union(v.id("_storage"), v.null())),
        })
      )
    ),
    // Legacy field stays optional while the admin product list removes it from existing rows.
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
    parentId: v.optional(v.union(v.id("categories"), v.null())),
    imageStorageId: v.optional(v.union(v.id("_storage"), v.null())),
    attributes: v.optional(v.array(v.object({
      key: v.string(),
      label: v.string(),
      type: v.union(
        v.literal("text"),
        v.literal("number"),
        v.literal("select"),
        v.literal("multiselect"),
        v.literal("boolean")
      ),
      unit: v.optional(v.string()),
      options: v.optional(v.array(v.string())),
      required: v.boolean(),
      filterable: v.optional(v.boolean()),
    }))),
    // Legacy field stays optional while admin listing removes it from existing rows.
    seo: v.optional(v.object({
      title: v.string(),
      description: v.string(),
    })),
    updatedAt: v.string(),
  })
    .index("by_slug", ["slug"])
    .index("by_parent", ["parentId"])
    .index("by_image_storage", ["imageStorageId"]),

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
    createdAt: v.number(),
    updatedAt: v.number(),
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
        vatRate: v.optional(v.number()),
        image: v.optional(v.string()),
        stockTracked: v.optional(v.boolean()),
        stockTracking: v.optional(v.union(v.literal("product"), v.literal("variant"))),
      })
    ),
    total: v.string(),
    shippingCostKurus: v.optional(v.number()),
    couponId: v.optional(v.id("coupons")),
    couponCode: v.optional(v.string()),
    couponDiscountKurus: v.optional(v.number()),
    couponReserved: v.optional(v.boolean()),
    couponRedeemed: v.optional(v.boolean()),
    refundedKurus: v.optional(v.number()),
    refundedItems: v.optional(v.array(v.object({ itemIndex: v.number(), quantity: v.number(), amountKurus: v.number() }))),
    status: v.union(
      v.literal("pending"),
      v.literal("paid"),
      v.literal("shipped"),
      v.literal("delivered"),
      v.literal("cancelled")
    ),
    paidAt: v.optional(v.number()),
    inventoryReserved: v.optional(v.boolean()),
    reservationExpiresAt: v.optional(v.number()),
    analyticsSessionId: v.optional(v.string()),
    checkoutIpEncrypted: v.optional(v.string()),
    shippingAddress: v.optional(v.string()),
    city: v.optional(v.string()),
    district: v.optional(v.string()),
    provinceId: v.optional(v.string()),
    districtId: v.optional(v.string()),
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
    invoiceRecipient: v.optional(v.object({
      type: v.union(v.literal("individual"), v.literal("business")),
      businessTitle: v.optional(v.string()),
      taxNumber: v.optional(v.string()),
      taxOffice: v.optional(v.string()),
    })),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_user_and_status", ["userId", "status"])
    .index("by_analytics_session_id", ["analyticsSessionId"]),

  analyticsSessions: defineTable({
    sessionId: v.string(),
    visitorId: v.string(),
    startedAt: v.number(),
    lastSeenAt: v.number(),
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
    .index("by_visitor_id", ["visitorId"])
    .index("by_source_and_paid_at", ["source", "paidAt"]),

  analyticsMarketingSpend: defineTable({
    month: v.string(),
    source: v.string(),
    campaign: v.string(),
    amountCents: v.number(),
    updatedAt: v.number(),
  })
    .index("by_month", ["month"])
    .index("by_month_and_source_and_campaign", ["month", "source", "campaign"]),

  invoiceRecords: defineTable({
    orderId: v.id("orders"),
    provider: v.union(v.literal("adapter"), v.literal("parasut")),
    status: v.union(
      v.literal("queued"),
      v.literal("processing"),
      v.literal("issued"),
      v.literal("failed"),
      v.literal("not_configured"),
      v.literal("review"),
    ),
    documentType: v.optional(v.union(v.literal("e_fatura"), v.literal("e_arsiv"))),
    providerReference: v.optional(v.string()),
    providerInvoiceId: v.optional(v.string()),
    trackableJobId: v.optional(v.string()),
    documentUrl: v.optional(v.string()),
    error: v.optional(v.string()),
    attempts: v.number(),
    updatedAt: v.number(),
  })
    .index("by_order", ["orderId"])
    .index("by_status", ["status"]),

  orderEmailEvents: defineTable({
    orderId: v.id("orders"),
    event: v.union(v.literal("payment_confirmation"), v.literal("shipping_update")),
    status: v.union(
      v.literal("processing"),
      v.literal("sent"),
      v.literal("failed"),
      v.literal("not_configured"),
      v.literal("review"),
    ),
    idempotencyKey: v.string(),
    providerEmailId: v.optional(v.string()),
    error: v.optional(v.string()),
    attempts: v.number(),
    leaseUntil: v.optional(v.number()),
    sentAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_order_and_event", ["orderId", "event"])
    .index("by_status", ["status"]),

  providerTokens: defineTable({
    provider: v.literal("parasut"),
    encryptedAccessToken: v.optional(v.string()),
    encryptedRefreshToken: v.string(),
    accessTokenExpiresAt: v.optional(v.number()),
    refreshLeaseUntil: v.optional(v.number()),
    refreshLeaseId: v.optional(v.string()),
    nextRequestAt: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_provider", ["provider"]),

  inventorySkuRegistry: defineTable({
    sku: v.string(),
    productId: v.id("products"),
    variantId: v.optional(v.string()),
  })
    .index("by_sku", ["sku"])
    .index("by_product", ["productId"]),

  inventoryReservations: defineTable({
    orderId: v.id("orders"),
    productId: v.id("products"),
    variantId: v.optional(v.string()),
    sku: v.string(),
    quantity: v.number(),
    status: v.union(v.literal("reserved"), v.literal("committed"), v.literal("released")),
    expiresAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_order", ["orderId"])
    .index("by_status_and_expiry", ["status", "expiresAt"]),

  inventoryMovements: defineTable({
    productId: v.id("products"),
    productTitle: v.string(),
    variantId: v.optional(v.string()),
    sku: v.string(),
    quantityDelta: v.number(),
    reason: v.union(
      v.literal("initial_stock"),
      v.literal("manual_adjustment"),
      v.literal("order_reservation"),
      v.literal("reservation_release"),
      v.literal("product_removed"),
    ),
    orderId: v.optional(v.id("orders")),
    createdAt: v.number(),
  })
    .index("by_product", ["productId", "createdAt"])
    .index("by_order", ["orderId"])
    .index("by_created_at", ["createdAt"]),

  checkoutPayments: defineTable({
    orderId: v.id("orders"),
    provider: v.union(v.literal("iyzico"), v.literal("paytr")),
    status: v.union(
      v.literal("initializing"),
      v.literal("pending"),
      v.literal("review"),
      v.literal("paid"),
      v.literal("failed"),
    ),
    conversationId: v.string(),
    token: v.optional(v.string()),
    merchantOid: v.optional(v.string()),
    paymentId: v.optional(v.string()),
    paymentPageUrl: v.optional(v.string()),
    emailHash: v.optional(v.string()),
    riskScore: v.optional(v.number()),
    riskDecision: v.optional(v.union(v.literal("allow"), v.literal("review"), v.literal("blocked"))),
    riskReasons: v.optional(v.array(v.string())),
    fraudStatus: v.optional(v.union(v.literal(-1), v.literal(0), v.literal(1))),
    expiresAt: v.number(),
  })
    .index("by_order", ["orderId"])
    .index("by_token", ["token"])
    .index("by_merchant_oid", ["merchantOid"])
    .index("by_email_hash", ["emailHash"])
    .index("by_status_and_expiry", ["status", "expiresAt"]),

  refunds: defineTable({
    orderId: v.id("orders"),
    paymentId: v.id("checkoutPayments"),
    provider: v.union(v.literal("iyzico"), v.literal("paytr")),
    idempotencyKey: v.string(),
    status: v.union(v.literal("pending"), v.literal("succeeded"), v.literal("failed"), v.literal("review")),
    amountKurus: v.number(),
    items: v.array(v.object({ itemIndex: v.number(), quantity: v.number(), amountKurus: v.number() })),
    providerReference: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_order_and_created_at", ["orderId", "createdAt"])
    .index("by_idempotency_key", ["idempotencyKey"]),

  shippingShipments: defineTable({
    orderId: v.id("orders"),
    status: v.union(
      v.literal("creating"),
      v.literal("quoted"),
      v.literal("purchasing"),
      v.literal("purchased"),
      v.literal("failed"),
      v.literal("review"),
    ),
    geliverShipmentId: v.optional(v.string()),
    transactionId: v.optional(v.string()),
    carrierName: v.optional(v.string()),
    trackingNumber: v.optional(v.string()),
    trackingUrl: v.optional(v.string()),
    labelUrl: v.optional(v.string()),
    barcode: v.optional(v.string()),
    offers: v.array(v.object({
      id: v.string(),
      carrierName: v.string(),
      serviceName: v.string(),
      priceKurus: v.number(),
      currency: v.string(),
      estimatedDays: v.optional(v.number()),
    })),
    errorCode: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    purchasedAt: v.optional(v.number()),
  })
    .index("by_order_and_created_at", ["orderId", "createdAt"])
    .index("by_geliver_shipment_id", ["geliverShipmentId"]),

  abandonedCarts: defineTable({
    sessionKey: v.string(),
    items: v.array(v.object({
      productId: v.string(),
      variantId: v.optional(v.string()),
      quantity: v.number(),
    })),
    email: v.optional(v.string()),
    whatsapp: v.optional(v.string()),
    emailConsent: v.boolean(),
    whatsappConsent: v.boolean(),
    emailConsentedAt: v.optional(v.number()),
    whatsappConsentedAt: v.optional(v.number()),
    emailOptedOutAt: v.optional(v.number()),
    whatsappOptedOutAt: v.optional(v.number()),
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
    whatsappSentAt: v.optional(v.number()),
  })
    .index("by_session_key", ["sessionKey"])
    .index("by_order", ["orderId"])
    .index("by_unsubscribe_token", ["unsubscribeToken"])
    .index("by_restore_token", ["restoreToken"]),

  reviewUploads: defineTable({
    userId: v.id("users"),
    productId: v.id("products"),
    storageId: v.id("_storage"),
    mediaType: v.union(v.literal("image"), v.literal("video")),
    size: v.number(),
    createdAt: v.string(),
    reviewId: v.optional(v.id("reviews")),
  })
    .index("by_user_and_product", ["userId", "productId"])
    .index("by_review", ["reviewId"]),

  reviews: defineTable({
    productId: v.id("products"),
    userId: v.id("users"),
    authorName: v.string(),
    rating: v.number(),
    title: v.string(),
    body: v.string(),
    media: v.array(v.object({
      storageId: v.id("_storage"),
      mediaType: v.union(v.literal("image"), v.literal("video")),
    })),
    createdAt: v.string(),
  })
    .index("by_product", ["productId"])
    .index("by_user_and_product", ["userId", "productId"]),

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
    // Legacy value ignored; storefront colors now come from the static theme.
    brandColor: v.optional(v.string()),
    shippingCutoffMinutes: v.optional(v.union(v.number(), v.null())),
    shippingDays: v.optional(v.array(v.number())),
    shippingFeeKurus: v.optional(v.number()),
    freeShippingThresholdKurus: v.optional(v.union(v.number(), v.null())),
    // Legacy fields are ignored; storefront metadata is generated from store content.
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
    provinceId: v.optional(v.string()),
    districtId: v.optional(v.string()),
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

  restockSubscriptions: defineTable({
    productId: v.id("products"),
    variantId: v.string(),
    channel: v.union(v.literal("email"), v.literal("sms")),
    contact: v.optional(v.string()),
    status: v.union(
      v.literal("active"),
      v.literal("sending"),
      v.literal("sent"),
      v.literal("failed"),
      v.literal("unsubscribed"),
    ),
    consentedAt: v.number(),
    unsubscribeToken: v.string(),
    notificationId: v.string(),
    sentAt: v.optional(v.number()),
  })
    .index("by_product", ["productId"])
    .index("by_product_variant_contact", ["productId", "variantId", "contact"])
    .index("by_product_variant_channel_status", ["productId", "variantId", "channel", "status"])
    .index("by_unsubscribe_token", ["unsubscribeToken"]),
});
