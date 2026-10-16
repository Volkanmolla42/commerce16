import rateLimiter from "@convex-dev/rate-limiter/convex.config.js";
import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
  env: {
    ADMIN_API_SECRET: v.optional(v.string()),
    RESEND_API_KEY: v.optional(v.string()),
    ORDER_FROM_EMAIL: v.optional(v.string()),
    ADMIN_ALERT_EMAIL: v.optional(v.string()),
    SITE_URL: v.optional(v.string()),
    ADMIN_PATH: v.optional(v.string()),
  },
});

app.use(rateLimiter);

export default app;
