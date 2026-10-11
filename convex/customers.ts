import { query } from "./_generated/server";
import { v } from "convex/values";
import { assertAdminApiSecret } from "./adminAuth";
import type { Doc, Id } from "./_generated/dataModel";

const MAX_PAGE_SIZE = 24;
const ORDER_HISTORY_LIMIT = 50;

const customerSummaryValidator = v.object({
  key: v.string(),
  userId: v.optional(v.id("users")),
  name: v.string(),
  email: v.string(),
  phone: v.string(),
  registeredAt: v.optional(v.number()),
  firstOrderAt: v.optional(v.number()),
  lastOrderAt: v.optional(v.number()),
  orderCount: v.number(),
  totalSpent: v.string(),
  addressCount: v.number(),
});

const addressValidator = v.object({
  _id: v.id("addresses"),
  title: v.string(),
  fullName: v.string(),
  phone: v.string(),
  city: v.string(),
  district: v.string(),
  addressLine1: v.string(),
  isDefault: v.boolean(),
});

const customerOrderValidator = v.object({
  _id: v.id("orders"),
  _creationTime: v.number(),
  status: v.union(v.literal("pending"), v.literal("paid"), v.literal("cancelled")),
  total: v.string(),
  itemCount: v.number(),
});

type OrderBucket = {
  orderCount: number;
  totalKurus: number;
  firstOrderAt: number | null;
  lastOrderAt: number | null;
  latestOrder: Doc<"orders"> | null;
};

type CustomerSummary = {
  key: string;
  userId?: Id<"users">;
  name: string;
  email: string;
  phone: string;
  registeredAt?: number;
  firstOrderAt?: number;
  lastOrderAt?: number;
  orderCount: number;
  totalSpent: string;
  addressCount: number;
};

function toKurus(total: string) {
  const value = Number(total);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

// Kayıtlı hesaplar ile misafir siparişlerini e-posta üzerinden birleştirip listeler.
export const listAdmin = query({
  args: {
    adminSecret: v.string(),
    query: v.string(),
    cursor: v.optional(v.string()),
    numItems: v.number(),
    all: v.optional(v.boolean()),
  },
  returns: v.object({
    page: v.array(customerSummaryValidator),
    continueCursor: v.string(),
    isDone: v.boolean(),
    totalCount: v.number(),
  }),
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);
    if (!Number.isInteger(args.numItems) || args.numItems < 1 || args.numItems > MAX_PAGE_SIZE) {
      throw new Error("Müşteri sayfa boyutu 1-24 arasında olmalı.");
    }

    const [users, orders, addresses] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db.query("orders").collect(),
      ctx.db.query("addresses").collect(),
    ]);

    const addressCounts = new Map<string, number>();
    for (const address of addresses) {
      addressCounts.set(address.userId, (addressCounts.get(address.userId) ?? 0) + 1);
    }

    const registered = users.filter((user) => user.isAnonymous !== true);
    const registeredById = new Map<string, Doc<"users">>();
    const registeredByEmail = new Map<string, Doc<"users">>();
    for (const user of registered) {
      registeredById.set(user._id, user);
      const email = user.email?.trim().toLowerCase();
      if (email) registeredByEmail.set(email, user);
    }

    const buckets = new Map<string, OrderBucket>();
    const bucketFor = (key: string) => {
      const existing = buckets.get(key);
      if (existing) return existing;
      const created: OrderBucket = { orderCount: 0, totalKurus: 0, firstOrderAt: null, lastOrderAt: null, latestOrder: null };
      buckets.set(key, created);
      return created;
    };

    for (const order of orders) {
      const email = order.customerEmail.trim().toLowerCase();
      const owner = (order.userId ? registeredById.get(order.userId) : undefined) ?? (email ? registeredByEmail.get(email) : undefined);
      const bucket = bucketFor(owner ? `user:${owner._id}` : `email:${email}`);
      bucket.orderCount += 1;
      bucket.totalKurus += toKurus(order.total);
      if (bucket.firstOrderAt === null || order._creationTime < bucket.firstOrderAt) bucket.firstOrderAt = order._creationTime;
      if (bucket.lastOrderAt === null || order._creationTime > bucket.lastOrderAt) {
        bucket.lastOrderAt = order._creationTime;
        bucket.latestOrder = order;
      }
    }

    const summaries: CustomerSummary[] = registered.map((user) => {
      const bucket = buckets.get(`user:${user._id}`);
      return {
        key: `user:${user._id}`,
        userId: user._id,
        name: user.name?.trim() || bucket?.latestOrder?.customerName.trim() || "",
        email: user.email?.trim() || bucket?.latestOrder?.customerEmail.trim() || "",
        phone: user.phone?.trim() || bucket?.latestOrder?.customerPhone?.trim() || "",
        registeredAt: user._creationTime,
        firstOrderAt: bucket?.firstOrderAt ?? undefined,
        lastOrderAt: bucket?.lastOrderAt ?? undefined,
        orderCount: bucket?.orderCount ?? 0,
        totalSpent: ((bucket?.totalKurus ?? 0) / 100).toFixed(2),
        addressCount: addressCounts.get(user._id) ?? 0,
      };
    });

    for (const [key, bucket] of buckets) {
      if (key.startsWith("user:")) continue;
      summaries.push({
        key,
        name: bucket.latestOrder?.customerName.trim() || "",
        email: key.slice("email:".length),
        phone: bucket.latestOrder?.customerPhone?.trim() || "",
        firstOrderAt: bucket.firstOrderAt ?? undefined,
        lastOrderAt: bucket.lastOrderAt ?? undefined,
        orderCount: bucket.orderCount,
        totalSpent: (bucket.totalKurus / 100).toFixed(2),
        addressCount: 0,
      });
    }

    const term = args.query.trim().toLocaleLowerCase("tr-TR");
    const filtered = term
      ? summaries.filter((customer) =>
        `${customer.name} ${customer.email} ${customer.phone}`.toLocaleLowerCase("tr-TR").includes(term),
      )
      : summaries;

    filtered.sort((a, b) => {
      const diff = (b.lastOrderAt ?? b.registeredAt ?? 0) - (a.lastOrderAt ?? a.registeredAt ?? 0);
      return diff !== 0 ? diff : a.key.localeCompare(b.key);
    });

    const parsedOffset = Number.parseInt(args.cursor ?? "", 10);
    const start = Number.isSafeInteger(parsedOffset) && parsedOffset > 0 ? parsedOffset : 0;
    const pageSize = args.all === true ? filtered.length : args.numItems;
    const page = filtered.slice(start, start + pageSize);
    const nextOffset = start + page.length;

    return {
      page,
      continueCursor: String(nextOffset),
      isDone: nextOffset >= filtered.length,
      totalCount: filtered.length,
    };
  },
});

export const getAdmin = query({
  args: {
    adminSecret: v.string(),
    userId: v.optional(v.string()),
    email: v.string(),
  },
  returns: v.object({
    name: v.string(),
    email: v.string(),
    phone: v.string(),
    image: v.optional(v.string()),
    registeredAt: v.optional(v.number()),
    firstOrderAt: v.optional(v.number()),
    lastOrderAt: v.optional(v.number()),
    orderCount: v.number(),
    totalSpent: v.string(),
    addresses: v.array(addressValidator),
    orders: v.array(customerOrderValidator),
  }),
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);

    const normalizedEmail = args.email.trim().toLowerCase();
    const userId = args.userId ? ctx.db.normalizeId("users", args.userId) : null;
    const user = userId ? await ctx.db.get(userId) : null;
    const accountEmail = user?.email?.trim().toLowerCase() || normalizedEmail;

    const addresses = userId
      ? await ctx.db.query("addresses").withIndex("by_userId", (q) => q.eq("userId", userId)).collect()
      : [];

    const orders = (await ctx.db.query("orders").collect())
      .filter((order) => {
        if (userId && order.userId === userId) return true;
        if (order.userId) return false;
        return Boolean(accountEmail) && order.customerEmail.trim().toLowerCase() === accountEmail;
      })
      .sort((a, b) => b._creationTime - a._creationTime);

    const latestOrder = orders[0];

    return {
      name: user?.name?.trim() || latestOrder?.customerName.trim() || "",
      email: user?.email?.trim() || normalizedEmail,
      phone: user?.phone?.trim() || latestOrder?.customerPhone?.trim() || "",
      ...(user?.image ? { image: user.image } : {}),
      ...(user ? { registeredAt: user._creationTime } : {}),
      firstOrderAt: orders.length ? orders[orders.length - 1]._creationTime : undefined,
      lastOrderAt: latestOrder?._creationTime,
      orderCount: orders.length,
      totalSpent: (orders.reduce((sum, order) => sum + toKurus(order.total), 0) / 100).toFixed(2),
      addresses: addresses.map((address) => ({
        _id: address._id,
        title: address.title,
        fullName: address.fullName,
        phone: address.phone,
        city: address.city,
        district: address.district,
        addressLine1: address.addressLine1,
        isDefault: address.isDefault,
      })),
      orders: orders.slice(0, ORDER_HISTORY_LIMIT).map((order) => ({
        _id: order._id,
        _creationTime: order._creationTime,
        status: order.status,
        total: order.total,
        itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      })),
    };
  },
});
