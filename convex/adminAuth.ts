import { RateLimiter, MINUTE } from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";
import { env, mutation } from "./_generated/server";
import { v } from "convex/values";

const rateLimiter = new RateLimiter(components.rateLimiter, {
  adminPinAttempts: { kind: "fixed window", rate: 5, period: 15 * MINUTE },
});

export function assertAdminApiSecret(suppliedSecret: string) {
  const configuredSecret = env.ADMIN_API_SECRET;

  if (!configuredSecret || suppliedSecret !== configuredSecret) {
    throw new Error("Yönetici işlemi doğrulanamadı.");
  }
}

export const consumePinAttempt = mutation({
  args: { adminSecret: v.string(), key: v.string() },
  returns: v.object({ ok: v.boolean(), retryAfter: v.optional(v.number()) }),
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);
    return await rateLimiter.limit(ctx, "adminPinAttempts", { key: args.key });
  },
});

export const resetPinAttempts = mutation({
  args: { adminSecret: v.string(), key: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);
    await rateLimiter.reset(ctx, "adminPinAttempts", { key: args.key });
    return null;
  },
});
