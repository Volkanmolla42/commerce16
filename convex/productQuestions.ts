import { getAuthUserId } from "@convex-dev/auth/server";
import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import { internalAction, internalQuery, mutation, query } from "./_generated/server";
import { assertAdminApiSecret } from "./adminAuth";
import { adminAlertTo, adminLink, siteLink } from "./emails/config";
import { sendEmail } from "./emails/send";
import { renderProductQuestionEmail } from "./emails/templates/alerts";
import { readStoreSettings } from "./settings";
import { resolveFirstImageUrl } from "./productMedia";

const rateLimiter = new RateLimiter(components.rateLimiter, {
  productQuestionAsk: { kind: "fixed window", rate: 3, period: 10 * MINUTE },
});

const questionStatusValidator = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
);

const adminUserValidator = v.union(
  v.object({ name: v.string(), email: v.nullable(v.string()) }),
  v.null(),
);

const publishedQuestionValidator = v.object({
  _id: v.id("productQuestions"),
  question: v.string(),
  answer: v.string(),
  _creationTime: v.number(),
  answeredAt: v.optional(v.number()),
});

function displayName(user: { name?: string; email?: string } | null) {
  return user?.name?.trim() || user?.email?.split("@")[0] || "Müşteri";
}

const adminQuestionValidator = v.object({
  _id: v.id("productQuestions"),
  productId: v.id("products"),
  productTitle: v.nullable(v.string()),
  productSlug: v.nullable(v.string()),
  productImage: v.nullable(v.string()),
  user: adminUserValidator,
  question: v.string(),
  answer: v.optional(v.string()),
  answeredAt: v.optional(v.number()),
  status: questionStatusValidator,
  _creationTime: v.number(),
});

/** PDP'de gösterilecek sorular: yalnızca yanıtlanıp yayınlanmış olanlar. */
export const getByProduct = query({
  args: {
    productId: v.id("products"),
    limit: v.optional(v.number()),
  },
  returns: v.array(publishedQuestionValidator),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 20, 1), 50);
    const questions = await ctx.db
      .query("productQuestions")
      .withIndex("by_product_and_status", (q) =>
        q.eq("productId", args.productId).eq("status", "approved")
      )
      .order("desc")
      .take(limit);

    return questions.map((item) => ({
      _id: item._id,
      question: item.question,
      answer: item.answer ?? "",
      _creationTime: item._creationTime,
      answeredAt: item.answeredAt,
    }));
  },
});

/** Giriş yapmış müşteri soru sorar; soru moderasyon kuyruğuna düşer. */
export const ask = mutation({
  args: {
    productId: v.id("products"),
    question: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Soru sormak için giriş yapmalısınız.");

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("Kullanıcı hesabı bulunamadı.");

    const question = args.question.trim();
    if (question.length < 10 || question.length > 1000) {
      throw new Error("Sorunuz 10-1000 karakter arasında olmalıdır.");
    }

    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Ürün bulunamadı.");

    const limit = await rateLimiter.limit(ctx, "productQuestionAsk", { key: userId });
    if (!limit.ok) {
      const minutes = Math.max(1, Math.ceil((limit.retryAfter ?? 0) / MINUTE));
      throw new Error(`Çok fazla soru gönderdiniz. ${minutes} dakika sonra tekrar deneyin.`);
    }

    const questionId = await ctx.db.insert("productQuestions", {
      productId: args.productId,
      userId,
      question,
      status: "pending",
    });

    await ctx.scheduler.runAfter(0, internal.productQuestions.sendQuestionAlert, {
      questionId,
    });

    return null;
  },
});

/** Admin: durum filtresine göre soruları ürün bilgisiyle birlikte listeler. */
export const listForAdmin = query({
  args: {
    adminSecret: v.string(),
    status: v.optional(v.union(v.literal("all"), questionStatusValidator)),
  },
  returns: v.array(adminQuestionValidator),
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);

    const questions =
      args.status && args.status !== "all"
        ? await ctx.db
            .query("productQuestions")
            .withIndex("by_status", (q) => q.eq("status", args.status as "pending" | "approved" | "rejected"))
            .order("desc")
            .take(100)
        : await ctx.db.query("productQuestions").order("desc").take(100);

    return await Promise.all(
      questions.map(async (item) => {
        const [product, user] = await Promise.all([
          ctx.db.get(item.productId),
          ctx.db.get(item.userId),
        ]);
        const productImage = await resolveFirstImageUrl(ctx, product);
        return {
          _id: item._id,
          productId: item.productId,
          productTitle: product?.title ?? null,
          productSlug: product?.slug ?? null,
          productImage,
          user: user
            ? { name: displayName(user), email: user.email?.trim().toLowerCase() ?? null }
            : null,
          question: item.question,
          answer: item.answer,
          answeredAt: item.answeredAt,
          status: item.status,
          _creationTime: item._creationTime,
        };
      }),
    );
  },
});

/** Admin: yanıtı kaydeder ve soruyu yayınlar. */
export const answer = mutation({
  args: {
    adminSecret: v.string(),
    id: v.id("productQuestions"),
    answer: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);

    const question = await ctx.db.get(args.id);
    if (!question) throw new Error("Soru bulunamadı.");

    const answer = args.answer.trim();
    if (answer.length < 2 || answer.length > 2000) {
      throw new Error("Yanıt 2-2000 karakter arasında olmalıdır.");
    }

    await ctx.db.patch(args.id, {
      answer,
      answeredAt: Date.now(),
      status: "approved",
    });

    return null;
  },
});

/** Admin: yayından kaldırma / reddetme / beklemeye alma. */
export const updateStatus = mutation({
  args: {
    adminSecret: v.string(),
    id: v.id("productQuestions"),
    status: questionStatusValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);

    const question = await ctx.db.get(args.id);
    if (!question) throw new Error("Soru bulunamadı.");

    if (args.status === "approved" && !question.answer?.trim()) {
      throw new Error("Yayınlamak için önce yanıt yazın.");
    }

    await ctx.db.patch(args.id, { status: args.status });
    return null;
  },
});

/** Admin: soruyu kalıcı olarak siler. */
export const remove = mutation({
  args: {
    adminSecret: v.string(),
    id: v.id("productQuestions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);
    await ctx.db.delete(args.id);
    return null;
  },
});

export const getQuestionAlertDetails = internalQuery({
  args: {
    questionId: v.id("productQuestions"),
  },
  returns: v.union(
    v.object({
      storeName: v.string(),
      productTitle: v.nullable(v.string()),
      productSlug: v.nullable(v.string()),
      user: adminUserValidator,
      question: v.string(),
      _creationTime: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.questionId);
    if (!item) return null;

    const [product, user] = await Promise.all([
      ctx.db.get(item.productId),
      ctx.db.get(item.userId),
    ]);
    const { storeName } = await readStoreSettings(ctx);

    return {
      storeName,
      productTitle: product?.title ?? null,
      productSlug: product?.slug ?? null,
      user: user
        ? { name: displayName(user), email: user.email?.trim().toLowerCase() ?? null }
        : null,
      question: item.question,
      _creationTime: item._creationTime,
    };
  },
});

export const sendQuestionAlert = internalAction({
  args: {
    questionId: v.id("productQuestions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const data = await ctx.runQuery(internal.productQuestions.getQuestionAlertDetails, {
      questionId: args.questionId,
    });
    if (!data) return null;

    await sendEmail(ctx, {
      to: adminAlertTo(),
      storeName: data.storeName,
      templateKey: "product_question_alert",
      content: renderProductQuestionEmail({
        storeName: data.storeName,
        productTitle: data.productTitle,
        productUrl: data.productSlug ? siteLink(`/product/${data.productSlug}`) : "",
        user: data.user ?? { name: "Müşteri", email: null },
        question: data.question,
        _creationTime: data._creationTime,
        adminQuestionsUrl: adminLink("questions"),
      }),
      replyTo: data.user?.email ?? undefined,
      idempotencyKey: `product-question/${args.questionId}`,
      metadata: { questionId: args.questionId },
    });

    return null;
  },
});
