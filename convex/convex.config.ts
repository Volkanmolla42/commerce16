import rateLimiter from "@convex-dev/rate-limiter/convex.config.js";
import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
  env: {
    ADMIN_API_SECRET: v.optional(v.string()),
  },
});

app.use(rateLimiter);

export default app;
