import rateLimiter from "@convex-dev/rate-limiter/convex.config.js";
import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
  env: {
    ADMIN_API_SECRET: v.optional(v.string()),
    RESEND_API_KEY: v.optional(v.string()),
    ORDER_FROM_EMAIL: v.optional(v.string()),
    RESTOCK_FROM_EMAIL: v.optional(v.string()),
    RESTOCK_SITE_URL: v.optional(v.string()),
    TWILIO_ACCOUNT_SID: v.optional(v.string()),
    TWILIO_AUTH_TOKEN: v.optional(v.string()),
    TWILIO_FROM_NUMBER: v.optional(v.string()),
    CART_RECOVERY_FROM_EMAIL: v.optional(v.string()),
    CART_RECOVERY_SITE_URL: v.optional(v.string()),
    TWILIO_WHATSAPP_FROM: v.optional(v.string()),
    TWILIO_WHATSAPP_CONTENT_SID: v.optional(v.string()),
    EINVOICE_ADAPTER_URL: v.optional(v.string()),
    EINVOICE_ADAPTER_TOKEN: v.optional(v.string()),
    EINVOICE_PROVIDER: v.optional(v.string()),
    PARASUT_CLIENT_ID: v.optional(v.string()),
    PARASUT_CLIENT_SECRET: v.optional(v.string()),
    PARASUT_COMPANY_ID: v.optional(v.string()),
    PARASUT_TOKEN_ENCRYPTION_KEY: v.optional(v.string()),
    PARASUT_INITIAL_REFRESH_TOKEN: v.optional(v.string()),
    PARASUT_SHIPPING_VAT_RATE: v.optional(v.string()),
    GELIVER_TOKEN: v.optional(v.string()),
    GELIVER_SENDER_ADDRESS_ID: v.optional(v.string()),
    GELIVER_SOURCE_IDENTIFIER: v.optional(v.string()),
    GELIVER_TEST_MODE: v.optional(v.string()),
    GELIVER_PACKAGE_LENGTH_CM: v.optional(v.string()),
    GELIVER_PACKAGE_WIDTH_CM: v.optional(v.string()),
    GELIVER_PACKAGE_HEIGHT_CM: v.optional(v.string()),
    GELIVER_PACKAGE_WEIGHT_KG: v.optional(v.string()),
  },
});

app.use(rateLimiter);

export default app;
