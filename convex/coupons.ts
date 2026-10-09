import { v } from "convex/values";
import { assertAdminApiSecret } from "./adminAuth";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import schema from "./schema";
import type { Doc } from "./_generated/dataModel";

const couponValidator = schema.doc("coupons");
const couponCodePattern = /^[A-Z0-9][A-Z0-9_-]{2,31}$/;

function normalizeCouponCode(value: string) {
  return value.trim().toLocaleUpperCase("en-US");
}

function validateCouponInput(input: {
  discountType: "percentage" | "fixed";
  discountValue: number;
  minOrderAmountKurus?: number;
  maxDiscountKurus?: number;
  usageLimit?: number;
  expiresAt?: number;
}) {
  if (!Number.isSafeInteger(input.discountValue) || input.discountValue < 1 ||
    (input.discountType === "percentage" && input.discountValue > 100)) {
    throw new Error(input.discountType === "percentage"
      ? "Yüzde indirimi 1 ile 100 arasında tam sayı olmalı."
      : "Sabit indirim tutarı en az 1 kuruş olmalı.");
  }
  if (input.minOrderAmountKurus !== undefined &&
    (!Number.isSafeInteger(input.minOrderAmountKurus) || input.minOrderAmountKurus < 0)) {
    throw new Error("Asgari sepet tutarı geçersiz.");
  }
  if (input.maxDiscountKurus !== undefined &&
    (!Number.isSafeInteger(input.maxDiscountKurus) || input.maxDiscountKurus < 1)) {
    throw new Error("Maksimum indirim tutarı geçersiz.");
  }
  if (input.usageLimit !== undefined &&
    (!Number.isSafeInteger(input.usageLimit) || input.usageLimit < 1)) {
    throw new Error("Kullanım limiti en az 1 olmalı.");
  }
  if (input.expiresAt !== undefined &&
    (!Number.isSafeInteger(input.expiresAt) || input.expiresAt < 0)) {
    throw new Error("Son kullanma tarihi geçersiz.");
  }
}

type CouponQuote =
  | { valid: true; code: string; discountKurus: number; totalKurus: number }
  | { valid: false; message: string };

function quoteCouponRecord(coupon: Doc<"coupons">, subtotalKurus: number, now: number): CouponQuote {
  if (!coupon.isActive || (coupon.expiresAt !== undefined && coupon.expiresAt <= now)) {
    return { valid: false, message: "Bu kupon artık kullanılamıyor." };
  }
  if (coupon.usageLimit !== undefined && coupon.usedCount >= coupon.usageLimit) {
    return { valid: false, message: "Kupon kullanım limitine ulaştı." };
  }
  if (coupon.minOrderAmountKurus !== undefined && subtotalKurus < coupon.minOrderAmountKurus) {
    return { valid: false, message: `Bu kupon için sepet tutarı en az ${(coupon.minOrderAmountKurus / 100).toFixed(2)} TL olmalı.` };
  }

  let discountKurus = coupon.discountType === "percentage"
    ? Math.floor(subtotalKurus * coupon.discountValue / 100)
    : coupon.discountValue;
  if (coupon.maxDiscountKurus !== undefined) discountKurus = Math.min(discountKurus, coupon.maxDiscountKurus);
  discountKurus = Math.min(subtotalKurus, discountKurus);
  if (discountKurus <= 0) return { valid: false, message: "Bu sepet için uygulanabilir bir indirim bulunmuyor." };
  return { valid: true, code: coupon.code, discountKurus, totalKurus: subtotalKurus - discountKurus };
}

async function quoteCoupon(ctx: QueryCtx | MutationCtx, code: string, subtotalKurus: number, now: number): Promise<CouponQuote> {
  const normalizedCode = normalizeCouponCode(code);
  if (!couponCodePattern.test(normalizedCode)) return { valid: false, message: "Kupon kodu geçersiz." };
  if (!Number.isSafeInteger(subtotalKurus) || subtotalKurus < 0) return { valid: false, message: "Sepet tutarı geçersiz." };
  if (!Number.isSafeInteger(now) || now < 0) return { valid: false, message: "Kupon kontrol zamanı geçersiz." };

  const coupon = await ctx.db.query("coupons").withIndex("by_code", (q) => q.eq("code", normalizedCode)).unique();
  if (!coupon) return { valid: false, message: "Kupon kodu bulunamadı." };
  return quoteCouponRecord(coupon, subtotalKurus, now);
}

export const preview = query({
  args: { code: v.string(), subtotalKurus: v.number(), now: v.number() },
  returns: v.union(
    v.object({ valid: v.literal(true), code: v.string(), discountKurus: v.number(), totalKurus: v.number() }),
    v.object({ valid: v.literal(false), message: v.string() }),
  ),
  handler: async (ctx, args) => await quoteCoupon(ctx, args.code, args.subtotalKurus, args.now),
});

export async function quoteCouponForOrder(ctx: MutationCtx, code: string, subtotalKurus: number) {
  const quote = await quoteCoupon(ctx, code, subtotalKurus, Date.now());
  if (!quote.valid) throw new Error(quote.message);
  const coupon = await ctx.db.query("coupons").withIndex("by_code", (q) => q.eq("code", quote.code)).unique();
  if (!coupon) throw new Error("Kupon kodu bulunamadı.");
  return { ...quote, couponId: coupon._id };
}

export async function reserveCouponForOrder(ctx: MutationCtx, order: Doc<"orders">) {
  if (!order.couponId || order.couponReserved === true || order.couponRedeemed === true) return;
  const coupon = await ctx.db.get(order.couponId);
  if (!coupon || coupon.code !== order.couponCode) throw new Error("Kupon kodu sipariş oluşturulduktan sonra değişti. Siparişinizi yeniden oluşturun.");
  const subtotalKurus = order.items.reduce((sum, item) => {
    const price = Math.round(Number(item.price) * 100);
    return sum + price * item.quantity;
  }, 0);
  const orderTotalKurus = Math.round(Number(order.total) * 100);
  const quote = quoteCouponRecord(coupon, subtotalKurus, Date.now());
  if (!Number.isSafeInteger(orderTotalKurus) || orderTotalKurus < 0 || !quote.valid ||
    quote.discountKurus !== order.couponDiscountKurus || quote.totalKurus !== orderTotalKurus) {
    throw new Error(quote.valid ? "Kupon koşulları değişti. Siparişinizi yeniden oluşturun." : quote.message);
  }
  if (coupon.usageLimit !== undefined && coupon.usedCount >= coupon.usageLimit) {
    throw new Error("Kupon kullanım hakkı az önce tükendi. Tekrar deneyin.");
  }
  await ctx.db.patch(coupon._id, { usedCount: coupon.usedCount + 1 });
  await ctx.db.patch(order._id, { couponReserved: true });
}

export async function releaseCouponReservation(ctx: MutationCtx, order: Doc<"orders">) {
  if (!order.couponCode || order.couponReserved !== true) return;
  const coupon = order.couponId
    ? await ctx.db.get(order.couponId)
    : await ctx.db.query("coupons").withIndex("by_code", (q) => q.eq("code", order.couponCode!)).unique();
  if (coupon) await ctx.db.patch(coupon._id, { usedCount: Math.max(0, coupon.usedCount - 1) });
  await ctx.db.patch(order._id, { couponReserved: false });
}

export async function commitCouponReservation(ctx: MutationCtx, order: Doc<"orders">) {
  const current = await ctx.db.get(order._id);
  if (!current?.couponCode || current.couponReserved !== true) return;
  await ctx.db.patch(current._id, { couponReserved: false, couponRedeemed: true });
}

const couponFields = {
  discountType: v.union(v.literal("percentage"), v.literal("fixed")),
  discountValue: v.number(),
  minOrderAmountKurus: v.optional(v.number()),
  maxDiscountKurus: v.optional(v.number()),
  usageLimit: v.optional(v.number()),
  expiresAt: v.optional(v.number()),
  isActive: v.boolean(),
};

export const listAdmin = query({
  args: { adminSecret: v.string() },
  returns: v.array(couponValidator),
  handler: async (ctx, { adminSecret }) => {
    assertAdminApiSecret(adminSecret);
    return await ctx.db.query("coupons").order("desc").take(200);
  },
});

export const create = mutation({
  args: { adminSecret: v.string(), code: v.string(), ...couponFields },
  returns: v.id("coupons"),
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);
    const code = normalizeCouponCode(args.code);
    if (!couponCodePattern.test(code)) throw new Error("Kupon kodu 3-32 karakter; harf, rakam, tire veya alt çizgi içermeli.");
    validateCouponInput(args);
    if (await ctx.db.query("coupons").withIndex("by_code", (q) => q.eq("code", code)).unique()) {
      throw new Error("Bu kupon kodu zaten mevcut.");
    }
    return await ctx.db.insert("coupons", {
      code,
      discountType: args.discountType,
      discountValue: args.discountValue,
      minOrderAmountKurus: args.minOrderAmountKurus,
      maxDiscountKurus: args.maxDiscountKurus,
      usageLimit: args.usageLimit,
      usedCount: 0,
      expiresAt: args.expiresAt,
      isActive: args.isActive,
    });
  },
});

export const update = mutation({
  args: {
    adminSecret: v.string(),
    id: v.id("coupons"),
    code: v.optional(v.string()),
    discountType: v.optional(couponFields.discountType),
    discountValue: v.optional(v.number()),
    minOrderAmountKurus: v.optional(v.union(v.number(), v.null())),
    maxDiscountKurus: v.optional(v.union(v.number(), v.null())),
    usageLimit: v.optional(v.union(v.number(), v.null())),
    expiresAt: v.optional(v.union(v.number(), v.null())),
    isActive: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);
    const coupon = await ctx.db.get(args.id);
    if (!coupon) throw new Error("Kupon bulunamadı.");
    const code = args.code === undefined ? coupon.code : normalizeCouponCode(args.code);
    if (!couponCodePattern.test(code)) throw new Error("Kupon kodu 3-32 karakter; harf, rakam, tire veya alt çizgi içermeli.");
    if (code !== coupon.code && await ctx.db.query("coupons").withIndex("by_code", (q) => q.eq("code", code)).unique()) {
      throw new Error("Bu kupon kodu zaten mevcut.");
    }
    const next = {
      discountType: args.discountType ?? coupon.discountType,
      discountValue: args.discountValue ?? coupon.discountValue,
      minOrderAmountKurus: args.minOrderAmountKurus === null ? undefined : args.minOrderAmountKurus ?? coupon.minOrderAmountKurus,
      maxDiscountKurus: args.maxDiscountKurus === null ? undefined : args.maxDiscountKurus ?? coupon.maxDiscountKurus,
      usageLimit: args.usageLimit === null ? undefined : args.usageLimit ?? coupon.usageLimit,
      expiresAt: args.expiresAt === null ? undefined : args.expiresAt ?? coupon.expiresAt,
    };
    validateCouponInput(next);
    const patch: Partial<Doc<"coupons">> = {
      code,
      discountType: next.discountType,
      discountValue: next.discountValue,
      ...(args.isActive !== undefined ? { isActive: args.isActive } : {}),
      ...(args.expiresAt !== undefined ? { expiresAt: args.expiresAt ?? undefined } : {}),
      ...(args.minOrderAmountKurus !== undefined ? { minOrderAmountKurus: args.minOrderAmountKurus ?? undefined } : {}),
      ...(args.maxDiscountKurus !== undefined ? { maxDiscountKurus: args.maxDiscountKurus ?? undefined } : {}),
      ...(args.usageLimit !== undefined ? { usageLimit: args.usageLimit ?? undefined } : {}),
    };
    await ctx.db.patch(args.id, patch);
    return null;
  },
});

export const disable = mutation({
  args: { adminSecret: v.string(), id: v.id("coupons") },
  returns: v.null(),
  handler: async (ctx, { adminSecret, id }) => {
    assertAdminApiSecret(adminSecret);
    const coupon = await ctx.db.get(id);
    if (!coupon) throw new Error("Kupon bulunamadı.");
    await ctx.db.patch(id, { isActive: false });
    return null;
  },
});

