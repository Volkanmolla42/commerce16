import { RateLimiter, MINUTE } from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";
import { env, mutation } from "./_generated/server";
import { v } from "convex/values";

const rateLimiter = new RateLimiter(components.rateLimiter, {
  adminPinAttempts: { kind: "fixed window", rate: 5, period: 15 * MINUTE },
});

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export function assertAdminApiSecret(suppliedSecret: string) {
  const configuredSecret = env.ADMIN_API_SECRET;

  if (!configuredSecret || !constantTimeEqual(suppliedSecret, configuredSecret)) {
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
