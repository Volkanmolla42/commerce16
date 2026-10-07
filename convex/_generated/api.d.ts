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
import type * as addresses from "../addresses.js";
import type * as adminAuth from "../adminAuth.js";
import type * as analytics from "../analytics.js";
import type * as auth from "../auth.js";
import type * as categories from "../categories.js";
import type * as checkoutPayments from "../checkoutPayments.js";
import type * as coupons from "../coupons.js";
import type * as crons from "../crons.js";
import type * as favorites from "../favorites.js";
import type * as http from "../http.js";
import type * as inventory from "../inventory.js";
import type * as invoices from "../invoices.js";
import type * as legalDocuments from "../legalDocuments.js";
import type * as notifications from "../notifications.js";
import type * as orders from "../orders.js";
import type * as parasut from "../parasut.js";
import type * as paymentRisk from "../paymentRisk.js";
import type * as products from "../products.js";
import type * as refunds from "../refunds.js";
import type * as restockNotifications from "../restockNotifications.js";
import type * as reviews from "../reviews.js";
import type * as seed from "../seed.js";
import type * as settings from "../settings.js";
import type * as shipping from "../shipping.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  abandonedCartRecovery: typeof abandonedCartRecovery;
  addresses: typeof addresses;
  adminAuth: typeof adminAuth;
  analytics: typeof analytics;
  auth: typeof auth;
  categories: typeof categories;
  checkoutPayments: typeof checkoutPayments;
  coupons: typeof coupons;
  crons: typeof crons;
  favorites: typeof favorites;
  http: typeof http;
  inventory: typeof inventory;
  invoices: typeof invoices;
  legalDocuments: typeof legalDocuments;
  notifications: typeof notifications;
  orders: typeof orders;
  parasut: typeof parasut;
  paymentRisk: typeof paymentRisk;
  products: typeof products;
  refunds: typeof refunds;
  restockNotifications: typeof restockNotifications;
  reviews: typeof reviews;
  seed: typeof seed;
  settings: typeof settings;
  shipping: typeof shipping;
  users: typeof users;
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
