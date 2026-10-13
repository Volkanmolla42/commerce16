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
import type * as emailTemplates from "../emailTemplates.js";
import type * as favorites from "../favorites.js";
import type * as http from "../http.js";
import type * as legalDocuments from "../legalDocuments.js";
import type * as lowStock from "../lowStock.js";
import type * as mailUtils from "../mailUtils.js";
import type * as notifications from "../notifications.js";
import type * as orders from "../orders.js";
import type * as productSkus from "../productSkus.js";
import type * as products from "../products.js";
import type * as restock from "../restock.js";
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
  emailTemplates: typeof emailTemplates;
  favorites: typeof favorites;
  http: typeof http;
  legalDocuments: typeof legalDocuments;
  lowStock: typeof lowStock;
  mailUtils: typeof mailUtils;
  notifications: typeof notifications;
  orders: typeof orders;
  productSkus: typeof productSkus;
  products: typeof products;
  restock: typeof restock;
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
