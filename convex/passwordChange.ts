import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalMutation, internalQuery, type ActionCtx } from "./_generated/server";
import {
  getAuthSessionId,
  getAuthUserId,
  invalidateSessions,
  modifyAccountCredentials,
  retrieveAccount,
} from "@convex-dev/auth/server";
import { renderOtpEmail } from "./emails/templates/account";
import { sendEmail } from "./emails/send";
import { storeConfig } from "../lib/store-config";

const PROVIDER = "password";
const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function generateCode() {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(bytes[0] % 1_000_000).padStart(6, "0");
}

async function hashCode(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export const getChangeContext = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(v.object({ email: v.string(), storeName: v.string() }), v.null()),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user?.email) return null;
    return {
      email: user.email,
      storeName: storeConfig.name,
    };
  },
});

export const saveCode = internalMutation({
  args: { userId: v.id("users"), codeHash: v.string(), expiresAt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("passwordChangeCodes")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
    await ctx.db.insert("passwordChangeCodes", {
      userId: args.userId,
      codeHash: args.codeHash,
      expiresAt: args.expiresAt,
      attempts: 0,
    });
    return null;
  },
});

export const consumeCode = internalMutation({
  args: { userId: v.id("users"), codeHash: v.string() },
  returns: v.union(
    v.literal("ok"),
    v.literal("missing"),
    v.literal("expired"),
    v.literal("too_many"),
    v.literal("mismatch"),
  ),
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("passwordChangeCodes")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
    if (!record) return "missing";
    if (record.expiresAt < Date.now()) {
      await ctx.db.delete(record._id);
      return "expired";
    }
    if (record.attempts >= MAX_ATTEMPTS) {
      await ctx.db.delete(record._id);
      return "too_many";
    }
    if (record.codeHash !== args.codeHash) {
      await ctx.db.patch(record._id, { attempts: record.attempts + 1 });
      return "mismatch";
    }
    await ctx.db.delete(record._id);
    return "ok";
  },
});

async function assertCurrentPassword(
  ctx: ActionCtx,
  email: string,
  currentPassword: string,
) {
  try {
    await retrieveAccount(ctx, {
      provider: PROVIDER,
      account: { id: email, secret: currentPassword },
    });
  } catch {
    throw new ConvexError("Mevcut şifreniz hatalı.");
  }
}

export const requestPasswordChangeCode = action({
  args: { currentPassword: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Giriş yapmanız gerekmektedir.");

    const context = await ctx.runQuery(internal.passwordChange.getChangeContext, { userId });
    if (!context) throw new ConvexError("Hesabınıza bağlı bir e-posta adresi bulunamadı.");

    await assertCurrentPassword(ctx, context.email, args.currentPassword);

    const code = generateCode();
    await ctx.runMutation(internal.passwordChange.saveCode, {
      userId,
      codeHash: await hashCode(code),
      expiresAt: Date.now() + CODE_TTL_MS,
    });

    const outcome = await sendEmail(ctx, {
      to: context.email,
      storeName: context.storeName,
      templateKey: "password_change_otp",
      content: renderOtpEmail({ storeName: context.storeName, token: code, purpose: "change" }),
      idempotencyKey: `password-change/${userId}/${code}`,
      metadata: { userId },
    });

    if (outcome !== "sent") {
      throw new ConvexError("Doğrulama kodu gönderilemedi. Lütfen tekrar deneyin.");
    }
    return null;
  },
});

export const changePassword = action({
  args: {
    currentPassword: v.string(),
    newPassword: v.string(),
    code: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Giriş yapmanız gerekmektedir.");
    if (args.newPassword.length < 8) {
      throw new ConvexError("Yeni şifre en az 8 karakter olmalıdır.");
    }

    const context = await ctx.runQuery(internal.passwordChange.getChangeContext, { userId });
    if (!context) throw new ConvexError("Hesabınıza bağlı bir e-posta adresi bulunamadı.");

    await assertCurrentPassword(ctx, context.email, args.currentPassword);

    const status = await ctx.runMutation(internal.passwordChange.consumeCode, {
      userId,
      codeHash: await hashCode(args.code.trim()),
    });
    if (status === "missing") {
      throw new ConvexError("Doğrulama kodu bulunamadı. Lütfen yeni bir kod isteyin.");
    }
    if (status === "expired") {
      throw new ConvexError("Doğrulama kodunun süresi doldu. Lütfen yeni bir kod isteyin.");
    }
    if (status === "too_many") {
      throw new ConvexError("Çok fazla hatalı deneme yapıldı. Lütfen yeni bir kod isteyin.");
    }
    if (status === "mismatch") {
      throw new ConvexError("Doğrulama kodu hatalı.");
    }

    await modifyAccountCredentials(ctx, {
      provider: PROVIDER,
      account: { id: context.email, secret: args.newPassword },
    });

    const sessionId = await getAuthSessionId(ctx);
    await invalidateSessions(ctx, {
      userId,
      ...(sessionId ? { except: [sessionId] } : {}),
    });

    return null;
  },
});
