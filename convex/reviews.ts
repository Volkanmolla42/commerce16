import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { assertAdminApiSecret } from "./adminAuth";
import { maskName } from "../lib/mask-name";

const reviewItemValidator = v.object({
  _id: v.id("reviews"),
  productId: v.id("products"),
  userId: v.optional(v.id("users")),
  orderId: v.optional(v.id("orders")),
  authorName: v.string(),
  rating: v.number(),
  title: v.optional(v.string()),
  content: v.string(),
  isVerifiedPurchase: v.boolean(),
  status: v.union(v.literal("approved"), v.literal("pending"), v.literal("rejected")),
  _creationTime: v.number(),
});

const publicReviewValidator = v.object({
  _id: v.id("reviews"),
  productId: v.id("products"),
  authorName: v.string(),
  rating: v.number(),
  title: v.optional(v.string()),
  content: v.string(),
  isVerifiedPurchase: v.boolean(),
  _creationTime: v.number(),
});

/** Bir ürünün onaylanmış yorumlarını ve özet puan istatistiklerini getirir. */
export const getByProduct = query({
  args: {
    productId: v.id("products"),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    reviews: v.array(publicReviewValidator),
    averageRating: v.number(),
    reviewCount: v.number(),
    commentCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 20, 1), 100);

    const allApproved = (await ctx.db
      .query("reviews")
      .withIndex("by_product_and_status", (q) =>
        q.eq("productId", args.productId).eq("status", "approved")
      )
      .order("desc")
      .take(100))
      .filter((review) => review.isVerifiedPurchase);

    const reviewCount = allApproved.length;
    let sum = 0;
    let commentCount = 0;

    for (const r of allApproved) {
      sum += r.rating;
      if (r.content.trim()) commentCount += 1;
    }

    const averageRating = reviewCount > 0 ? Number((sum / reviewCount).toFixed(1)) : 0;

    return {
      reviews: allApproved.slice(0, limit).map((review) => ({
        _id: review._id,
        productId: review.productId,
        authorName: maskName(review.authorName),
        rating: review.rating,
        title: review.title,
        content: review.content,
        isVerifiedPurchase: review.isVerifiedPurchase,
        _creationTime: review._creationTime,
      })),
      averageRating,
      reviewCount,
      commentCount,
    };
  },
});

/** Ürünün sadece puan özetini döner (kartlar ve başlıklar için hafif sorgu). */
export const getSummary = query({
  args: {
    productId: v.id("products"),
  },
  returns: v.object({
    averageRating: v.number(),
    reviewCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const allApproved = (await ctx.db
      .query("reviews")
      .withIndex("by_product_and_status", (q) =>
        q.eq("productId", args.productId).eq("status", "approved")
      )
      .take(100))
      .filter((review) => review.isVerifiedPurchase);

    const reviewCount = allApproved.length;
    if (reviewCount === 0) {
      return { averageRating: 0, reviewCount: 0 };
    }

    const sum = allApproved.reduce((acc, r) => acc + r.rating, 0);
    return {
      averageRating: Number((sum / reviewCount).toFixed(1)),
      reviewCount,
    };
  },
});

/** Kullanıcının belirli bir ürünü sipariş edip etmediğini kontrol eder. */
export const getProductReviewEligibility = query({
  args: {
    productId: v.id("products"),
  },
  returns: v.object({
    canReview: v.boolean(),
    eligibleOrderId: v.optional(v.id("orders")),
    alreadyReviewed: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { canReview: false, alreadyReviewed: false };
    }

    // Kullanıcının siparişlerini bul
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50);

    const matchingOrder = orders.find(
      (order) =>
        order.status === "delivered" &&
        order.items.some((item) => item.productId === args.productId)
    );

    if (!matchingOrder) {
      return { canReview: false, alreadyReviewed: false };
    }

    // Bu kullanıcı bu ürüne zaten yorum yapmış mı?
    const existingReview = await ctx.db
      .query("reviews")
      .withIndex("by_user_and_product", (q) =>
        q.eq("userId", userId).eq("productId", args.productId)
      )
      .first();

    return {
      canReview: true,
      eligibleOrderId: matchingOrder._id,
      alreadyReviewed: Boolean(existingReview),
    };
  },
});

/** Bir sipariş için yapılan ürün değerlendirmeleri ve mağaza deneyimi durumunu sorgular. */
export const getOrderReviewStatus = query({
  args: {
    orderId: v.id("orders"),
  },
  returns: v.object({
    isEligible: v.boolean(),
    reviewedProductIds: v.array(v.string()),
    hasStoreFeedback: v.boolean(),
    storeFeedback: v.optional(v.object({
      storeRating: v.number(),
      deliveryRating: v.optional(v.number()),
      comment: v.optional(v.string()),
    })),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { isEligible: false, reviewedProductIds: [], hasStoreFeedback: false };
    }

    const order = await ctx.db.get(args.orderId);
    if (!order || order.userId !== userId || order.status !== "delivered") {
      return { isEligible: false, reviewedProductIds: [], hasStoreFeedback: false };
    }

    // Bu sipariş için girilen ürün yorumları
    const existingReviews = await ctx.db
      .query("reviews")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .take(50);

    const reviewedProductIds = existingReviews.map((r) => r.productId as string);

    // Bu sipariş için girilen mağaza deneyimi geri bildirimi
    const feedback = await ctx.db
      .query("orderFeedback")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .first();

    return {
      isEligible: true,
      reviewedProductIds,
      hasStoreFeedback: !!feedback,
      storeFeedback: feedback
        ? {
            storeRating: feedback.storeRating,
            deliveryRating: feedback.deliveryRating,
            comment: feedback.comment,
          }
        : undefined,
    };
  },
});

/** Sipariş üzerinden ürün yorumlarını ve alışveriş deneyimi geri bildirimini birlikte kaydeder. */
export const submitOrderReview = mutation({
  args: {
    orderId: v.id("orders"),
    productReviews: v.array(
      v.object({
        productId: v.id("products"),
        rating: v.number(),
        title: v.optional(v.string()),
        content: v.string(),
      })
    ),
    storeFeedback: v.optional(
      v.object({
        storeRating: v.number(),
        deliveryRating: v.optional(v.number()),
        comment: v.optional(v.string()),
      })
    ),
  },
  returns: v.object({
    success: v.boolean(),
    savedReviewsCount: v.number(),
    savedStoreFeedback: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Değerlendirme yapmak için giriş yapmalısınız.");
    }

    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Sipariş bulunamadı.");
    }

    if (order.userId !== userId) {
      throw new Error("Yalnızca kendi siparişinizi değerlendirebilirsiniz.");
    }

    if (order.status !== "delivered") {
      throw new Error("Yalnızca teslim edilmiş (tamamlanmış) siparişler için değerlendirme yapabilirsiniz.");
    }

    const authorName = order.customerName || "Değerli Müşterimiz";
    let savedReviewsCount = 0;

    if (args.productReviews.length === 0 && !args.storeFeedback) {
      throw new Error("En az bir ürün veya mağaza değerlendirmesi girin.");
    }

    // 1. Ürün Yorumlarını Kaydet (Doğrulanmış Satın Alım Olarak)
    for (const item of args.productReviews) {
      // Siparişte bu ürün var mı doğrula
      const itemInOrder = order.items.some((i) => i.productId === item.productId);
      if (!itemInOrder) continue;

      const trimmedContent = item.content.trim();
      if (!Number.isInteger(item.rating) || item.rating < 1 || item.rating > 5) {
        throw new Error("Ürün puanı 1 ile 5 arasında bir tam sayı olmalıdır.");
      }
      const rating = item.rating;

      if (!trimmedContent || trimmedContent.length < 3) {
        throw new Error("Ürün yorumu en az 3 karakter olmalıdır.");
      }

      // Bu siparişteki bu ürün için daha önce yorum yapılmış mı kontrol et
      const existing = await ctx.db
        .query("reviews")
        .withIndex("by_order_and_product", (q) =>
          q.eq("orderId", args.orderId).eq("productId", item.productId)
        )
        .first();

      if (existing) {
        // Güncelle
        await ctx.db.patch(existing._id, {
          rating,
          title: item.title?.trim() || undefined,
          content: trimmedContent,
        });
      } else {
        // Yeni ekle
        await ctx.db.insert("reviews", {
          productId: item.productId,
          userId,
          orderId: args.orderId,
          authorName,
          rating,
          title: item.title?.trim() || undefined,
          content: trimmedContent,
          isVerifiedPurchase: true,
          status: "approved",
        });
      }
      savedReviewsCount++;
    }

    // 2. Alışveriş / Mağaza Deneyimi Geri Bildirimini Kaydet (Sadece Admin / Mağaza İçi Kanal)
    let savedStoreFeedback = false;
    if (args.storeFeedback) {
      if (!Number.isInteger(args.storeFeedback.storeRating) || args.storeFeedback.storeRating < 1 || args.storeFeedback.storeRating > 5) {
        throw new Error("Mağaza puanı 1 ile 5 arasında bir tam sayı olmalıdır.");
      }
      if (args.storeFeedback.deliveryRating !== undefined &&
        (!Number.isInteger(args.storeFeedback.deliveryRating) || args.storeFeedback.deliveryRating < 1 || args.storeFeedback.deliveryRating > 5)) {
        throw new Error("Teslimat puanı 1 ile 5 arasında bir tam sayı olmalıdır.");
      }
      const storeRating = args.storeFeedback.storeRating;
      const deliveryRating = args.storeFeedback.deliveryRating;
      const comment = args.storeFeedback.comment?.trim() || undefined;

      const existingFeedback = await ctx.db
        .query("orderFeedback")
        .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
        .first();

      if (existingFeedback) {
        await ctx.db.patch(existingFeedback._id, {
          storeRating,
          deliveryRating,
          comment,
        });
      } else {
        await ctx.db.insert("orderFeedback", {
          orderId: args.orderId,
          userId,
          customerName: order.customerName,
          customerEmail: order.customerEmail,
          storeRating,
          deliveryRating,
          comment,
        });
      }
      savedStoreFeedback = true;
    }

    return {
      success: true,
      savedReviewsCount,
      savedStoreFeedback,
    };
  },
});

/** Admin: Ürün Yorumlarını Listele */
export const listForAdmin = query({
  args: {
    adminSecret: v.string(),
    status: v.optional(v.union(v.literal("all"), v.literal("approved"), v.literal("pending"), v.literal("rejected"))),
  },
  returns: v.array(reviewItemValidator),
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);

    if (args.status && args.status !== "all") {
      return await ctx.db
        .query("reviews")
        .withIndex("by_status", (q) => q.eq("status", args.status as "approved" | "pending" | "rejected"))
        .order("desc")
        .take(100);
    }

    return await ctx.db.query("reviews").order("desc").take(100);
  },
});

/** Admin: Yorum durumunu güncelle */
export const updateStatus = mutation({
  args: {
    adminSecret: v.string(),
    reviewId: v.id("reviews"),
    status: v.union(v.literal("approved"), v.literal("pending"), v.literal("rejected")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);
    await ctx.db.patch(args.reviewId, { status: args.status });
    return null;
  },
});

/** Admin: Yorum sil */
export const deleteReview = mutation({
  args: {
    adminSecret: v.string(),
    reviewId: v.id("reviews"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);
    await ctx.db.delete(args.reviewId);
    return null;
  },
});
