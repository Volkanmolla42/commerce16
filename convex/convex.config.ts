import rateLimiter from "@convex-dev/rate-limiter/convex.config.js";
import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
  env: {
    ADMIN_API_SECRET: v.optional(v.string()),
    RESEND_API_KEY: v.optional(v.string()),
    ORDER_FROM_EMAIL: v.optional(v.string()),
    CART_RECOVERY_FROM_EMAIL: v.optional(v.string()),
    CART_RECOVERY_SITE_URL: v.optional(v.string()),
  },
});

app.use(rateLimiter);

export default app;
