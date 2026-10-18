/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as abandonedCartRecovery from "../abandonedCartRecovery.js";
import type * as activeCarts from "../activeCarts.js";
import type * as addresses from "../addresses.js";
import type * as adminAuth from "../adminAuth.js";
import type * as adminEmails from "../adminEmails.js";
import type * as analytics from "../analytics.js";
import type * as auth from "../auth.js";
import type * as catalog from "../catalog.js";
import type * as catalogModel from "../catalogModel.js";
import type * as categories from "../categories.js";
import type * as categoryAttributePresets from "../categoryAttributePresets.js";
import type * as contact from "../contact.js";
import type * as coupons from "../coupons.js";
import type * as crons from "../crons.js";
import type * as customers from "../customers.js";
import type * as emails_config from "../emails/config.js";
import type * as emails_content from "../emails/content.js";
import type * as emails_events from "../emails/events.js";
import type * as emails_registry from "../emails/registry.js";
import type * as emails_resend from "../emails/resend.js";
import type * as emails_send from "../emails/send.js";
import type * as emails_templates_account from "../emails/templates/account.js";
import type * as emails_templates_alerts from "../emails/templates/alerts.js";
import type * as emails_templates_marketing from "../emails/templates/marketing.js";
import type * as emails_templates_order from "../emails/templates/order.js";
import type * as favorites from "../favorites.js";
import type * as http from "../http.js";
import type * as legalDocuments from "../legalDocuments.js";
import type * as lowStock from "../lowStock.js";
import type * as notifications from "../notifications.js";
import type * as orders from "../orders.js";
import type * as passwordChange from "../passwordChange.js";
import type * as payments from "../payments.js";
import type * as productQuestions from "../productQuestions.js";
import type * as productSkus from "../productSkus.js";
import type * as products from "../products.js";
import type * as promotions from "../promotions.js";
import type * as restock from "../restock.js";
import type * as reviews from "../reviews.js";
import type * as settings from "../settings.js";
import type * as users from "../users.js";
import type * as welcome from "../welcome.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  abandonedCartRecovery: typeof abandonedCartRecovery;
  activeCarts: typeof activeCarts;
  addresses: typeof addresses;
  adminAuth: typeof adminAuth;
  adminEmails: typeof adminEmails;
  analytics: typeof analytics;
  auth: typeof auth;
  catalog: typeof catalog;
  catalogModel: typeof catalogModel;
  categories: typeof categories;
  categoryAttributePresets: typeof categoryAttributePresets;
  contact: typeof contact;
  coupons: typeof coupons;
  crons: typeof crons;
  customers: typeof customers;
  "emails/config": typeof emails_config;
  "emails/content": typeof emails_content;
  "emails/events": typeof emails_events;
  "emails/registry": typeof emails_registry;
  "emails/resend": typeof emails_resend;
  "emails/send": typeof emails_send;
  "emails/templates/account": typeof emails_templates_account;
  "emails/templates/alerts": typeof emails_templates_alerts;
  "emails/templates/marketing": typeof emails_templates_marketing;
  "emails/templates/order": typeof emails_templates_order;
  favorites: typeof favorites;
  http: typeof http;
  legalDocuments: typeof legalDocuments;
  lowStock: typeof lowStock;
  notifications: typeof notifications;
  orders: typeof orders;
  passwordChange: typeof passwordChange;
  payments: typeof payments;
  productQuestions: typeof productQuestions;
  productSkus: typeof productSkus;
  products: typeof products;
  promotions: typeof promotions;
  restock: typeof restock;
  reviews: typeof reviews;
  settings: typeof settings;
  users: typeof users;
  welcome: typeof welcome;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
