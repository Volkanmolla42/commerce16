import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";

const verifiedStatuses = ["paid", "shipped", "delivered"] as const;
const MAX_REVIEW_MEDIA = 5;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 30 * 1024 * 1024;
const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const allowedVideoTypes = new Set(["video/mp4", "video/webm"]);

async function hasVerifiedPurchase(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  productId: string,
) {
  const ordersByStatus = await Promise.all(
    verifiedStatuses.map((status) =>
      ctx.db.query("orders")
        .withIndex("by_user_and_status", (q) => q.eq("userId", userId).eq("status", status))
        .order("desc")
        .take(100),
    ),
  );
  return ordersByStatus.flat().some((order) =>
    order.items.some((item) => item.productId === productId),
  );
}

async function assertEligibleBuyer(
  ctx: MutationCtx,
  productId: Id<"products">,
  userId: Id<"users">,
) {
  if (!await ctx.db.get(productId)) throw new Error("Ürün bulunamadı.");
  if (!await hasVerifiedPurchase(ctx, userId, productId)) {
    throw new Error("Yorum yazmak için bu ürünü içeren tamamlanmış bir siparişiniz olmalı.");
  }
  const existingReview = await ctx.db.query("reviews")
    .withIndex("by_user_and_product", (q) => q.eq("userId", userId).eq("productId", productId))
    .first();
  if (existingReview) throw new Error("Bu ürün için daha önce yorum gönderdiniz.");
}

function inspectMedia(contentType: string | undefined, size: number) {
  if (contentType && allowedImageTypes.has(contentType) && size > 0 && size <= MAX_IMAGE_BYTES) {
    return "image" as const;
  }
  if (contentType && allowedVideoTypes.has(contentType) && size > 0 && size <= MAX_VIDEO_BYTES) {
    return "video" as const;
  }
  throw new Error("Dosya türü desteklenmiyor veya dosya boyutu sınırı aşıldı.");
}

export const listForProduct = query({
  args: { productId: v.id("products") },
  returns: v.object({
    reviews: v.array(v.object({
      id: v.id("reviews"),
      authorName: v.string(),
      rating: v.number(),
      title: v.string(),
      body: v.string(),
      createdAt: v.string(),
      media: v.array(v.object({ url: v.string(), mediaType: v.union(v.literal("image"), v.literal("video")) })),
    })),
    averageRating: v.number(),
    totalReviews: v.number(),
    canReview: v.boolean(),
    hasReviewed: v.boolean(),
  }),
  handler: async (ctx, { productId }) => {
    const allReviews = await ctx.db.query("reviews")
      .withIndex("by_product", (q) => q.eq("productId", productId))
      .order("desc")
      .take(500);
    const userId = await getAuthUserId(ctx);
    const existingReview = userId
      ? await ctx.db.query("reviews")
        .withIndex("by_user_and_product", (q) => q.eq("userId", userId).eq("productId", productId))
        .first()
      : null;
    const canReview = Boolean(
      userId &&
      !existingReview &&
      await hasVerifiedPurchase(ctx, userId, productId),
    );
    const averageRating = allReviews.length > 0
      ? Math.round(allReviews.reduce((sum, review) => sum + review.rating, 0) / allReviews.length * 10) / 10
      : 0;
    const reviews = await Promise.all(allReviews.slice(0, 20).map(async (review) => ({
      id: review._id,
      authorName: review.authorName,
      rating: review.rating,
      title: review.title,
      body: review.body,
      createdAt: review.createdAt,
      media: (await Promise.all(review.media.map(async ({ storageId, mediaType }) => {
        const url = await ctx.storage.getUrl(storageId);
        return url ? { url, mediaType } : null;
      }))).filter((media): media is { url: string; mediaType: "image" | "video" } => media !== null),
    })));

    return {
      reviews,
      averageRating,
      totalReviews: allReviews.length,
      canReview,
      hasReviewed: Boolean(existingReview),
    };
  },
});

export const generateUploadUrl = mutation({
  args: { productId: v.id("products") },
  returns: v.string(),
  handler: async (ctx, { productId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Yorum göndermek için giriş yapın.");
    await assertEligibleBuyer(ctx, productId, userId);
    const staged = await ctx.db.query("reviewUploads")
      .withIndex("by_user_and_product", (q) => q.eq("userId", userId).eq("productId", productId))
      .take(MAX_REVIEW_MEDIA);
    if (staged.length >= MAX_REVIEW_MEDIA) throw new Error("Yorum başına en fazla 5 görsel veya video eklenebilir.");
    return await ctx.storage.generateUploadUrl();
  },
});

export const registerMedia = mutation({
  args: { productId: v.id("products"), storageId: v.id("_storage") },
  returns: v.id("reviewUploads"),
  handler: async (ctx, { productId, storageId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Yorum göndermek için giriş yapın.");
    await assertEligibleBuyer(ctx, productId, userId);

    const staged = await ctx.db.query("reviewUploads")
      .withIndex("by_user_and_product", (q) => q.eq("userId", userId).eq("productId", productId))
      .take(MAX_REVIEW_MEDIA);
    if (staged.length >= MAX_REVIEW_MEDIA || staged.some((item) => item.storageId === storageId)) {
      throw new Error("Bu yoruma artık dosya eklenemiyor.");
    }

    const metadata = await ctx.db.system.get("_storage", storageId);
    if (!metadata) throw new Error("Yüklenen dosya bulunamadı.");
    const mediaType = inspectMedia(metadata.contentType, metadata.size);
    return await ctx.db.insert("reviewUploads", {
      userId,
      productId,
      storageId,
      mediaType,
      size: metadata.size,
      createdAt: new Date().toISOString(),
    });
  },
});

export const removeStagedMedia = mutation({
  args: { uploadId: v.id("reviewUploads") },
  returns: v.null(),
  handler: async (ctx, { uploadId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Giriş yapmanız gerekmektedir.");
    const upload = await ctx.db.get(uploadId);
    if (!upload || upload.userId !== userId) throw new Error("Medya dosyası bulunamadı.");
    if (upload.reviewId) throw new Error("Yayınlanmış bir yorumun medyası kaldırılamaz.");
    await ctx.storage.delete(upload.storageId);
    await ctx.db.delete(uploadId);
    return null;
  },
});

export const create = mutation({
  args: {
    productId: v.id("products"),
    rating: v.number(),
    title: v.string(),
    body: v.string(),
    mediaUploadIds: v.array(v.id("reviewUploads")),
  },
  returns: v.id("reviews"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Yorum göndermek için giriş yapın.");
    await assertEligibleBuyer(ctx, args.productId, userId);
    if (!Number.isInteger(args.rating) || args.rating < 1 || args.rating > 5) {
      throw new Error("Puan 1 ile 5 arasında olmalı.");
    }
    const title = args.title.trim();
    const body = args.body.trim();
    if (title.length < 3 || title.length > 100 || body.length < 10 || body.length > 2000) {
      throw new Error("Başlık 3–100, yorum 10–2000 karakter arasında olmalı.");
    }
    if (args.mediaUploadIds.length > MAX_REVIEW_MEDIA || new Set(args.mediaUploadIds).size !== args.mediaUploadIds.length) {
      throw new Error("Yorum başına en fazla 5 farklı medya dosyası eklenebilir.");
    }
    const staged = await ctx.db.query("reviewUploads")
      .withIndex("by_user_and_product", (q) => q.eq("userId", userId).eq("productId", args.productId))
      .take(MAX_REVIEW_MEDIA);
    const stagedById = new Map(staged.map((upload) => [upload._id, upload]));
    const media = args.mediaUploadIds.map((id) => {
      const upload = stagedById.get(id);
      if (!upload || upload.reviewId) throw new Error("Yorum medyası doğrulanamadı.");
      return { storageId: upload.storageId, mediaType: upload.mediaType };
    });
    if (media.filter((item) => item.mediaType === "video").length > 1) {
      throw new Error("Bir yorumda en fazla 1 video paylaşabilirsiniz.");
    }

    const user = await ctx.db.get(userId);
    const nameParts = (user?.name ?? "").trim().split(/\s+/).filter(Boolean);
    const authorName = nameParts.length > 1
      ? `${nameParts[0]} ${nameParts.at(-1)?.[0]?.toLocaleUpperCase("tr-TR")}.`
      : nameParts[0] || "Müşteri";
    const createdAt = new Date().toISOString();
    const reviewId = await ctx.db.insert("reviews", {
      productId: args.productId,
      userId,
      authorName,
      rating: args.rating,
      title,
      body,
      media,
      createdAt,
    });
    await Promise.all(args.mediaUploadIds.map((id) => ctx.db.patch(id, { reviewId })));
    return reviewId;
  },
});
