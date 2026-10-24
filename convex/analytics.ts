import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import { assertAdminApiSecret } from "./adminAuth";
import {
  ORDER_PAYMENT_STATUS_KEYS,
  ORDER_STATUS_KEYS,
  isRevenueOrder,
  orderPaymentStatusLabels,
  orderStatusLabels,
  paymentMethodLabels,
} from "../lib/orders";

const eventTypeValidator = v.union(
  v.literal("page_view"),
  v.literal("product_view"),
  v.literal("add_to_cart"),
  v.literal("begin_checkout"),
);

const analyticsRateLimiter = new RateLimiter(components.rateLimiter, {
  eventsPerVisitor: { kind: "fixed window", rate: 180, period: MINUTE },
});

const orderStatusValidator = v.union(...ORDER_STATUS_KEYS.map((key) => v.literal(key)));
const orderPaymentStatusValidator = v.union(...ORDER_PAYMENT_STATUS_KEYS.map((key) => v.literal(key)));
const paymentMethodValidator = v.union(
  v.literal("paytr"),
  v.literal("bank_transfer"),
  v.literal("cash_on_delivery"),
  v.literal("unknown"),
);

const dashboardValidator = v.object({
  days: v.union(v.literal(7), v.literal(30), v.literal(90)),
  generatedAt: v.number(),
  summary: v.object({
    revenueCents: v.number(),
    paidOrders: v.number(),
    orderCount: v.number(),
    orderValueCents: v.number(),
    averageOrderValueCents: v.number(),
    pendingOrders: v.number(),
    pendingValueCents: v.number(),
    cancelledOrders: v.number(),
    uniqueVisitors: v.number(),
    sessions: v.number(),
    pageViews: v.number(),
    averagePageViews: v.number(),
    conversionRate: v.number(),
    newCustomers: v.number(),
    returningCustomers: v.number(),
    repeatCustomerRate: v.number(),
    observedLtvCents: v.number(),
  }),
  previous: v.object({
    revenueCents: v.number(),
    paidOrders: v.number(),
    orderCount: v.number(),
    orderValueCents: v.number(),
    averageOrderValueCents: v.number(),
    uniqueVisitors: v.number(),
    sessions: v.number(),
    conversionRate: v.number(),
    newCustomers: v.number(),
  }),
  trend: v.array(v.object({
    key: v.string(),
    label: v.string(),
    revenueCents: v.number(),
    orderCount: v.number(),
    orderValueCents: v.number(),
    sessions: v.number(),
    visitors: v.number(),
  })),
  funnel: v.array(v.object({
    key: v.union(
      v.literal("sessions"),
      v.literal("product_view"),
      v.literal("add_to_cart"),
      v.literal("checkout_started"),
      v.literal("purchase"),
    ),
    label: v.string(),
    sessions: v.number(),
    conversionFromPrevious: v.number(),
    dropOffFromPrevious: v.number(),
  })),
  channels: v.array(v.object({
    source: v.string(),
    medium: v.string(),
    sessions: v.number(),
    paidOrders: v.number(),
    conversionRate: v.number(),
    revenueCents: v.number(),
  })),
  products: v.array(v.object({
    productId: v.string(),
    title: v.string(),
    quantity: v.number(),
    orderCount: v.number(),
    revenueCents: v.number(),
  })),
  categories: v.array(v.object({
    slug: v.string(),
    title: v.string(),
    quantity: v.number(),
    revenueCents: v.number(),
  })),
  statuses: v.array(v.object({
    key: orderStatusValidator,
    label: v.string(),
    count: v.number(),
    valueCents: v.number(),
  })),
  paymentStatuses: v.array(v.object({
    key: orderPaymentStatusValidator,
    label: v.string(),
    count: v.number(),
    valueCents: v.number(),
  })),
  paymentMethods: v.array(v.object({
    key: paymentMethodValidator,
    label: v.string(),
    count: v.number(),
    valueCents: v.number(),
    pendingValueCents: v.number(),
  })),
  customers: v.object({
    newCustomers: v.number(),
    returningCustomers: v.number(),
    repeatRate: v.number(),
    ltvCents: v.number(),
    top: v.array(v.object({
      name: v.string(),
      email: v.string(),
      orderCount: v.number(),
      valueCents: v.number(),
    })),
  }),
  marketing: v.object({
    activeCoupons: v.number(),
    activePromotions: v.number(),
    couponOrders: v.number(),
    couponDiscountCents: v.number(),
    topCoupons: v.array(v.object({
      code: v.string(),
      orderCount: v.number(),
      discountCents: v.number(),
    })),
    cartReminders: v.number(),
    recoveredCarts: v.number(),
    recoveryRate: v.number(),
    reminderEmails: v.number(),
  }),
  satisfaction: v.object({
    feedbackCount: v.number(),
    storeRating: v.number(),
    deliveryRating: v.number(),
    approvedReviews: v.number(),
    averageReviewRating: v.number(),
    pendingQuestions: v.number(),
  }),
  cohorts: v.array(v.object({
    month: v.string(),
    label: v.string(),
    customers: v.number(),
    cells: v.array(v.object({
      age: v.number(),
      activeCustomers: v.number(),
      retentionPercent: v.number(),
    })),
  })),
  coverage: v.object({
    sessionsLimited: v.boolean(),
    ordersLimited: v.boolean(),
    catalogLimited: v.boolean(),
    orderHistoryMonths: v.number(),
    attributedOrders: v.number(),
    unattributedOrders: v.number(),
  }),
});

import { average, centsFromAmount, cleanAttribution, dayKey, dayLabelFormatter, isUuid, monthIndex, monthKey, monthLabel, percentage, stage } from "./analytics/helpers";

export const recordEvent = mutation({
  args: {
    adminSecret: v.string(),
    visitorId: v.string(),
    sessionId: v.string(),
    eventType: eventTypeValidator,
    source: v.string(),
    medium: v.string(),
    campaign: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);
    if (!isUuid(args.visitorId) || !isUuid(args.sessionId)) throw new Error("Analitik oturumu geçersiz.");
    const source = cleanAttribution(args.source);
    const medium = cleanAttribution(args.medium);
    const campaign = args.campaign ? cleanAttribution(args.campaign) : undefined;
    if (!source || !medium || source.length > 100 || medium.length > 100 || (campaign && campaign.length > 120)) {
      throw new Error("Analitik kaynağı geçersiz.");
    }

    const rate = await analyticsRateLimiter.limit(ctx, "eventsPerVisitor", { key: args.visitorId });
    if (!rate.ok) return null;

    const existing = await ctx.db.query("analyticsSessions")
      .withIndex("by_session_id", (q) => q.eq("sessionId", args.sessionId))
      .unique();
    if (existing && existing.visitorId !== args.visitorId) throw new Error("Analitik oturumu eşleşmiyor.");

    const now = Date.now();
    const session = existing ?? {
      sessionId: args.sessionId,
      visitorId: args.visitorId,
      startedAt: now,
      source,
      medium,
      ...(campaign ? { campaign } : {}),
      pageViews: 0,
      productViews: 0,
      addedToCart: false,
      checkoutStarted: false,
    };
    const next = {
      pageViews: session.pageViews + (args.eventType === "page_view" ? 1 : 0),
      productViews: session.productViews + (args.eventType === "product_view" ? 1 : 0),
      addedToCart: session.addedToCart || args.eventType === "add_to_cart",
      checkoutStarted: session.checkoutStarted || args.eventType === "begin_checkout",
    };

    if (existing) {
      await ctx.db.patch(existing._id, next);
    } else {
      await ctx.db.insert("analyticsSessions", { ...session, ...next });
    }
    return null;
  },
});

export const eraseVisitorData = mutation({
  args: { adminSecret: v.string(), visitorId: v.string() },
  returns: v.null(),
  handler: async (ctx, { adminSecret, visitorId }) => {
    assertAdminApiSecret(adminSecret);
    if (!isUuid(visitorId)) throw new Error("Ziyaretçi bilgisi geçersiz.");
    await ctx.scheduler.runAfter(0, internal.analytics.eraseVisitorBatch, { visitorId });
    return null;
  },
});

export const eraseVisitorBatch = internalMutation({
  args: { visitorId: v.string() },
  returns: v.null(),
  handler: async (ctx, { visitorId }) => {
    const sessions = await ctx.db.query("analyticsSessions")
      .withIndex("by_visitor_id", (q) => q.eq("visitorId", visitorId))
      .take(25);
    let hasMore = sessions.length === 25;

    for (const session of sessions) {
      const orders = await ctx.db.query("orders")
        .withIndex("by_analytics_session_id", (q) => q.eq("analyticsSessionId", session.sessionId))
        .take(20);
      for (const order of orders) await ctx.db.patch(order._id, { analyticsSessionId: undefined });
      if (orders.length === 20) {
        hasMore = true;
      } else {
        await ctx.db.delete(session._id);
      }
    }

    if (hasMore) await ctx.scheduler.runAfter(0, internal.analytics.eraseVisitorBatch, { visitorId });
    return null;
  },
});

export const getDashboard = query({
  args: {
    adminSecret: v.string(),
    days: v.union(v.literal(7), v.literal(30), v.literal(90)),
    now: v.number(),
  },
  returns: dashboardValidator,
  handler: async (ctx, { adminSecret, days, now }) => {
    assertAdminApiSecret(adminSecret);
    if (!Number.isSafeInteger(now) || now < 0) throw new Error("Analitik zamanı geçersiz.");
    const dayMs = 24 * 60 * 60 * 1000;
    const from = now - days * dayMs;
    const previousFrom = from - days * dayMs;
    const historyFrom = now - 730 * dayMs;
    const currentMonth = monthKey(now);
    const currentMonthIndex = monthIndex(currentMonth);
    const cohortStartIndex = currentMonthIndex - 11;

    const [
      sessionRows,
      orderRows,
      couponRows,
      promotionRows,
      cartRows,
      feedbackRows,
      reviewRows,
      pendingQuestionRows,
      categoryRows,
    ] = await Promise.all([
      ctx.db.query("analyticsSessions")
        .withIndex("by_started_at", (q) => q.gte("startedAt", previousFrom))
        .order("desc")
        .take(5_001),
      ctx.db.query("orders")
        .withIndex("by_creation_time", (q) => q.gte("_creationTime", historyFrom))
        .order("desc")
        .take(2_001),
      ctx.db.query("coupons").order("desc").take(200),
      ctx.db.query("promotions").order("desc").take(200),
      ctx.db.query("abandonedCarts")
        .withIndex("by_expires_at", (q) => q.gte("expiresAt", previousFrom))
        .take(501),
      ctx.db.query("orderFeedback").order("desc").take(501),
      ctx.db.query("reviews").order("desc").take(501),
      ctx.db.query("productQuestions").withIndex("by_status", (q) => q.eq("status", "pending")).take(100),
      ctx.db.query("categories").order("desc").take(200),
    ]);

    const sessionsLimited = sessionRows.length > 5_000;
    const ordersLimited = orderRows.length > 2_000;
    const sessions = sessionRows.slice(0, 5_000);
    const orders = orderRows.slice(0, 2_000);

    const currentSessions = sessions.filter((session) => session.startedAt >= from && session.startedAt <= now);
    const previousSessions = sessions.filter((session) => session.startedAt >= previousFrom && session.startedAt < from);
    const periodOrders = orders.filter((order) => order._creationTime >= from && order._creationTime <= now);
    const currentOrders = periodOrders.filter((order) => order.status !== "cancelled");
    const previousOrders = orders.filter((order) => order._creationTime >= previousFrom && order._creationTime < from && order.status !== "cancelled");
    const currentPaidOrders = orders.filter((order) => {
      if (!isRevenueOrder(order)) return false;
      const paidAt = order.paidAt ?? order._creationTime;
      return paidAt >= from && paidAt <= now;
    });
    const previousPaidOrders = orders.filter((order) => {
      if (!isRevenueOrder(order)) return false;
      const paidAt = order.paidAt ?? order._creationTime;
      return paidAt >= previousFrom && paidAt < from;
    });

    const currentVisitorIds = new Set(currentSessions.map((session) => session.visitorId));
    const previousVisitorIds = new Set(previousSessions.map((session) => session.visitorId));
    const currentPageViews = currentSessions.reduce((sum, session) => sum + session.pageViews, 0);
    const currentOrderValueCents = currentOrders.reduce((sum, order) => sum + centsFromAmount(order.total), 0);
    const previousOrderValueCents = previousOrders.reduce((sum, order) => sum + centsFromAmount(order.total), 0);
    const currentRevenueCents = currentPaidOrders.reduce((sum, order) => sum + centsFromAmount(order.total), 0);
    const previousRevenueCents = previousPaidOrders.reduce((sum, order) => sum + centsFromAmount(order.total), 0);
    const pendingOrderRows = currentOrders.filter((order) => order.paymentStatus === "pending");
    const pendingValueCents = pendingOrderRows.reduce((sum, order) => sum + centsFromAmount(order.total), 0);

    const customerKey = (order: { customerEmail: string }) => order.customerEmail.trim().toLowerCase();
    const customerOrders = new Map<string, typeof orders>();
    for (const order of orders) {
      if (order.status === "cancelled") continue;
      const key = customerKey(order);
      const list = customerOrders.get(key) ?? [];
      list.push(order);
      customerOrders.set(key, list);
    }

    const firstOrderTime = (list: typeof orders | undefined) => {
      if (!list) return Number.POSITIVE_INFINITY;
      return list.reduce((first, order) => Math.min(first, order._creationTime), Number.POSITIVE_INFINITY);
    };

    const countCustomerTypes = (periodOrderList: typeof orders, periodStart: number) => {
      const keys = new Set(periodOrderList.map(customerKey));
      let newCustomers = 0;
      let returningCustomers = 0;
      for (const key of keys) {
        if (firstOrderTime(customerOrders.get(key)) >= periodStart) newCustomers += 1;
        else returningCustomers += 1;
      }
      return { newCustomers, returningCustomers };
    };

    const currentCustomerTypes = countCustomerTypes(currentOrders, from);
    const previousCustomerTypes = countCustomerTypes(previousOrders, previousFrom);

    let lifetimePaidCents = 0;
    const payingCustomerKeys = new Set<string>();
    for (const [key, list] of customerOrders) {
      for (const order of list) {
        if (!isRevenueOrder(order)) continue;
        lifetimePaidCents += centsFromAmount(order.total);
        payingCustomerKeys.add(key);
      }
    }
    const observedLtvCents = payingCustomerKeys.size > 0 ? Math.round(lifetimePaidCents / payingCustomerKeys.size) : 0;
    const repeatCustomers = [...customerOrders.values()].filter((list) => list.length > 1).length;
    const repeatCustomerRate = percentage(repeatCustomers, customerOrders.size);

    const topCustomerMap = new Map<string, { name: string; email: string; orderCount: number; valueCents: number }>();
    for (const order of currentOrders) {
      const key = customerKey(order);
      const entry = topCustomerMap.get(key) ?? {
        name: order.customerName || order.customerEmail,
        email: order.customerEmail,
        orderCount: 0,
        valueCents: 0,
      };
      entry.orderCount += 1;
      entry.valueCents += centsFromAmount(order.total);
      topCustomerMap.set(key, entry);
    }
    const topCustomers = [...topCustomerMap.values()].sort((a, b) => b.valueCents - a.valueCents).slice(0, 5);

    const cohortGroups = new Map<string, { customers: number; activeByAge: Map<number, number> }>();
    for (const list of customerOrders.values()) {
      const sorted = [...list].sort((a, b) => a._creationTime - b._creationTime);
      const first = sorted[0];
      if (!first) continue;
      const firstMonth = monthKey(first._creationTime);
      if (monthIndex(firstMonth) < cohortStartIndex) continue;
      const cohort = cohortGroups.get(firstMonth) ?? { customers: 0, activeByAge: new Map<number, number>() };
      cohort.customers += 1;
      const activeAges = new Set<number>();
      for (const order of sorted) {
        const orderMonth = monthKey(order._creationTime);
        const age = monthIndex(orderMonth) - monthIndex(firstMonth);
        if (age >= 0 && age <= 11 && monthIndex(orderMonth) <= currentMonthIndex) activeAges.add(age);
      }
      for (const age of activeAges) cohort.activeByAge.set(age, (cohort.activeByAge.get(age) ?? 0) + 1);
      cohortGroups.set(firstMonth, cohort);
    }
    const cohortMonths = Array.from({ length: 12 }, (_, offset) => {
      const index = cohortStartIndex + offset;
      return `${Math.floor(index / 12).toString().padStart(4, "0")}-${String(index % 12 + 1).padStart(2, "0")}`;
    });
    const cohorts = cohortMonths.flatMap((month) => {
      const cohort = cohortGroups.get(month);
      if (!cohort) return [];
      const currentAge = Math.min(11, currentMonthIndex - monthIndex(month));
      return [{
        month,
        label: monthLabel(month),
        customers: cohort.customers,
        cells: Array.from({ length: currentAge + 1 }, (_, age) => {
          const activeCustomers = cohort.activeByAge.get(age) ?? 0;
          return { age, activeCustomers, retentionPercent: percentage(activeCustomers, cohort.customers) };
        }),
      }];
    });

    const currentSessionIds = new Set(currentSessions.map((session) => session.sessionId));
    const attributedOrders = currentOrders.filter((order) => order.analyticsSessionId && currentSessionIds.has(order.analyticsSessionId));
    const purchaseSessionIds = new Set(
      currentPaidOrders
        .map((order) => order.analyticsSessionId)
        .filter((sessionId): sessionId is string => Boolean(sessionId && currentSessionIds.has(sessionId))),
    );
    const productViewSessions = currentSessions.filter((session) => session.productViews > 0).length;
    const addToCartSessions = currentSessions.filter((session) => session.addedToCart).length;
    const checkoutSessions = currentSessions.filter((session) => session.checkoutStarted).length;
    const funnel = [
      stage("sessions", "Oturum", currentSessions.length, 0),
      stage("product_view", "Ürün görüntüleme", productViewSessions, currentSessions.length),
      stage("add_to_cart", "Sepete ekleme", addToCartSessions, productViewSessions),
      stage("checkout_started", "Ödeme adımı", checkoutSessions, addToCartSessions),
      stage("purchase", "Sipariş", purchaseSessionIds.size, checkoutSessions),
    ];

    const trendTimestamps = Array.from({ length: days }, (_, index) => now - (days - 1 - index) * dayMs);
    const trend = trendTimestamps.map((timestamp) => ({
      key: dayKey(timestamp),
      label: dayLabelFormatter.format(timestamp),
      revenueCents: 0,
      orderCount: 0,
      orderValueCents: 0,
      sessions: 0,
      visitors: 0,
    }));
    const trendByKey = new Map(trend.map((point) => [point.key, point]));
    const visitorSets = new Map<string, Set<string>>();
    for (const session of currentSessions) {
      const point = trendByKey.get(dayKey(session.startedAt));
      if (!point) continue;
      point.sessions += 1;
      const visitors = visitorSets.get(point.key) ?? new Set<string>();
      visitors.add(session.visitorId);
      visitorSets.set(point.key, visitors);
    }
    for (const [key, visitors] of visitorSets) {
      const point = trendByKey.get(key);
      if (point) point.visitors = visitors.size;
    }
    for (const order of currentOrders) {
      const point = trendByKey.get(dayKey(order._creationTime));
      if (!point) continue;
      point.orderCount += 1;
      point.orderValueCents += centsFromAmount(order.total);
    }
    for (const order of currentPaidOrders) {
      const point = trendByKey.get(dayKey(order.paidAt ?? order._creationTime));
      if (!point) continue;
      point.revenueCents += centsFromAmount(order.total);
    }

    const channelKey = (source: string, medium: string) => `${source}\u0000${medium}`;
    const channelMap = new Map<string, {
      source: string;
      medium: string;
      sessions: number;
      paidOrders: number;
      revenueCents: number;
    }>();
    for (const session of currentSessions) {
      const key = channelKey(session.source, session.medium);
      const entry = channelMap.get(key) ?? {
        source: session.source,
        medium: session.medium,
        sessions: 0,
        paidOrders: 0,
        revenueCents: 0,
      };
      entry.sessions += 1;
      channelMap.set(key, entry);
    }
    const sessionsById = new Map(sessions.map((session) => [session.sessionId, session]));
    for (const order of currentPaidOrders) {
      const session = order.analyticsSessionId ? sessionsById.get(order.analyticsSessionId) : undefined;
      if (!session) continue;
      const key = channelKey(session.source, session.medium);
      const entry = channelMap.get(key) ?? {
        source: session.source,
        medium: session.medium,
        sessions: 0,
        paidOrders: 0,
        revenueCents: 0,
      };
      entry.paidOrders += 1;
      entry.revenueCents += centsFromAmount(order.total);
      channelMap.set(key, entry);
    }
    const channels = [...channelMap.values()]
      .map((entry) => ({
        ...entry,
        conversionRate: percentage(entry.paidOrders, entry.sessions),
      }))
      .sort((a, b) => b.revenueCents - a.revenueCents || b.sessions - a.sessions || a.source.localeCompare(b.source))
      .slice(0, 12);

    const productMap = new Map<string, { title: string; categorySlug?: string }>();
    const productAgg = new Map<string, {
      productId: string;
      title: string;
      quantity: number;
      orderIds: Set<string>;
      revenueCents: number;
    }>();
    for (const order of currentOrders) {
      for (const item of order.items) {
        const entry = productAgg.get(item.productId) ?? {
          productId: item.productId,
          title: item.title,
          quantity: 0,
          orderIds: new Set<string>(),
          revenueCents: 0,
        };
        entry.quantity += item.quantity;
        entry.orderIds.add(order._id);
        entry.revenueCents += centsFromAmount(item.price) * item.quantity;
        productAgg.set(item.productId, entry);
      }
    }
    const soldProductIds = [...productAgg.keys()];
    const lookedUpProductIds = soldProductIds.slice(0, 500);
    const productDocs = await Promise.all(lookedUpProductIds.map((id) => {
      const normalizedId = ctx.db.normalizeId("products", id);
      return normalizedId ? ctx.db.get(normalizedId) : Promise.resolve(null);
    }));
    for (let index = 0; index < lookedUpProductIds.length; index += 1) {
      const product = productDocs[index];
      if (product) productMap.set(lookedUpProductIds[index], { title: product.title, categorySlug: product.categorySlug });
    }
    const products = [...productAgg.values()]
      .map((entry) => ({
        productId: entry.productId,
        title: productMap.get(entry.productId)?.title ?? entry.title,
        quantity: entry.quantity,
        orderCount: entry.orderIds.size,
        revenueCents: entry.revenueCents,
      }))
      .sort((a, b) => b.revenueCents - a.revenueCents || b.quantity - a.quantity)
      .slice(0, 8);

    const categoryTitles = new Map(categoryRows.map((category) => [category.slug, category.title]));
    const categoryAgg = new Map<string, { quantity: number; revenueCents: number }>();
    for (const order of currentOrders) {
      for (const item of order.items) {
        const categorySlug = productMap.get(item.productId)?.categorySlug ?? "";
        const entry = categoryAgg.get(categorySlug) ?? { quantity: 0, revenueCents: 0 };
        entry.quantity += item.quantity;
        entry.revenueCents += centsFromAmount(item.price) * item.quantity;
        categoryAgg.set(categorySlug, entry);
      }
    }
    const categories = [...categoryAgg.entries()]
      .map(([slug, entry]) => ({
        slug,
        title: slug ? categoryTitles.get(slug) ?? slug : "Kategorisiz",
        quantity: entry.quantity,
        revenueCents: entry.revenueCents,
      }))
      .sort((a, b) => b.revenueCents - a.revenueCents)
      .slice(0, 6);

    const statusCounts = new Map<string, { count: number; valueCents: number }>();
    for (const order of periodOrders) {
      const entry = statusCounts.get(order.status) ?? { count: 0, valueCents: 0 };
      entry.count += 1;
      entry.valueCents += centsFromAmount(order.total);
      statusCounts.set(order.status, entry);
    }
    const statuses = ORDER_STATUS_KEYS.map((key) => ({
      key,
      label: orderStatusLabels[key],
      count: statusCounts.get(key)?.count ?? 0,
      valueCents: statusCounts.get(key)?.valueCents ?? 0,
    }));

    const paymentStatusCounts = new Map<string, { count: number; valueCents: number }>();
    for (const order of currentOrders) {
      const entry = paymentStatusCounts.get(order.paymentStatus) ?? { count: 0, valueCents: 0 };
      entry.count += 1;
      entry.valueCents += centsFromAmount(order.total);
      paymentStatusCounts.set(order.paymentStatus, entry);
    }
    const paymentStatuses = ORDER_PAYMENT_STATUS_KEYS.map((key) => ({
      key,
      label: orderPaymentStatusLabels[key],
      count: paymentStatusCounts.get(key)?.count ?? 0,
      valueCents: paymentStatusCounts.get(key)?.valueCents ?? 0,
    }));

    const paymentMethodKeys = ["paytr", "bank_transfer", "cash_on_delivery", "unknown"] as const;
    const paymentMethodCounts = new Map<string, { count: number; valueCents: number; pendingValueCents: number }>();
    for (const order of currentOrders) {
      const key = order.paymentMethod ?? "unknown";
      const entry = paymentMethodCounts.get(key) ?? { count: 0, valueCents: 0, pendingValueCents: 0 };
      entry.count += 1;
      entry.valueCents += centsFromAmount(order.total);
      if (order.paymentStatus === "pending") entry.pendingValueCents += centsFromAmount(order.total);
      paymentMethodCounts.set(key, entry);
    }
    const paymentMethods = paymentMethodKeys.map((key) => ({
      key,
      label: key === "unknown" ? "Belirtilmemiş" : paymentMethodLabels[key],
      count: paymentMethodCounts.get(key)?.count ?? 0,
      valueCents: paymentMethodCounts.get(key)?.valueCents ?? 0,
      pendingValueCents: paymentMethodCounts.get(key)?.pendingValueCents ?? 0,
    }));

    const activeCoupons = couponRows.filter((coupon) => {
      if (!coupon.isActive) return false;
      if (coupon.expiresAt !== undefined && coupon.expiresAt <= now) return false;
      if (coupon.usageLimit !== undefined && coupon.usedCount >= coupon.usageLimit) return false;
      return true;
    }).length;
    const activePromotions = promotionRows.filter((promotion) => promotion.isActive).length;
    const couponOrderRows = currentOrders.filter((order) => order.couponCode);
    const couponDiscountCents = couponOrderRows.reduce((sum, order) => sum + (order.couponDiscountKurus ?? 0), 0);
    const couponCounts = new Map<string, { orderCount: number; discountCents: number }>();
    for (const order of couponOrderRows) {
      if (!order.couponCode) continue;
      const entry = couponCounts.get(order.couponCode) ?? { orderCount: 0, discountCents: 0 };
      entry.orderCount += 1;
      entry.discountCents += order.couponDiscountKurus ?? 0;
      couponCounts.set(order.couponCode, entry);
    }
    const topCoupons = [...couponCounts.entries()]
      .map(([code, entry]) => ({ code, ...entry }))
      .sort((a, b) => b.orderCount - a.orderCount || b.discountCents - a.discountCents)
      .slice(0, 3);

    const currentCarts = cartRows.filter((cart) => cart.lastActivityAt >= from && cart.lastActivityAt <= now);
    const recoveredCarts = currentCarts.filter((cart) => cart.status === "converted").length;
    const reminderEmails = currentCarts.filter((cart) => cart.emailSentAt !== undefined && cart.emailSentAt >= from && cart.emailSentAt <= now).length;

    const periodFeedback = feedbackRows.filter((feedback) => feedback._creationTime >= from);
    const deliveryRatings = periodFeedback.flatMap((feedback) => feedback.deliveryRating === undefined ? [] : [feedback.deliveryRating]);
    const periodReviews = reviewRows.filter((review) => review._creationTime >= from && review.status === "approved");
    const satisfaction = {
      feedbackCount: periodFeedback.length,
      storeRating: average(periodFeedback.map((feedback) => feedback.storeRating)),
      deliveryRating: average(deliveryRatings),
      approvedReviews: periodReviews.length,
      averageReviewRating: average(periodReviews.map((review) => review.rating)),
      pendingQuestions: pendingQuestionRows.length,
    };

    return {
      days,
      generatedAt: now,
      summary: {
        revenueCents: currentRevenueCents,
        paidOrders: currentPaidOrders.length,
        orderCount: currentOrders.length,
        orderValueCents: currentOrderValueCents,
        averageOrderValueCents: currentOrders.length > 0 ? Math.round(currentOrderValueCents / currentOrders.length) : 0,
        pendingOrders: pendingOrderRows.length,
        pendingValueCents,
        cancelledOrders: periodOrders.length - currentOrders.length,
        uniqueVisitors: currentVisitorIds.size,
        sessions: currentSessions.length,
        pageViews: currentPageViews,
        averagePageViews: currentSessions.length > 0 ? Math.round((currentPageViews / currentSessions.length) * 10) / 10 : 0,
        conversionRate: percentage(currentOrders.length, currentVisitorIds.size),
        newCustomers: currentCustomerTypes.newCustomers,
        returningCustomers: currentCustomerTypes.returningCustomers,
        repeatCustomerRate,
        observedLtvCents,
      },
      previous: {
        revenueCents: previousRevenueCents,
        paidOrders: previousPaidOrders.length,
        orderCount: previousOrders.length,
        orderValueCents: previousOrderValueCents,
        averageOrderValueCents: previousOrders.length > 0 ? Math.round(previousOrderValueCents / previousOrders.length) : 0,
        uniqueVisitors: previousVisitorIds.size,
        sessions: previousSessions.length,
        conversionRate: percentage(previousOrders.length, previousVisitorIds.size),
        newCustomers: previousCustomerTypes.newCustomers,
      },
      trend,
      funnel,
      channels,
      products,
      categories,
      statuses,
      paymentStatuses,
      paymentMethods,
      customers: {
        newCustomers: currentCustomerTypes.newCustomers,
        returningCustomers: currentCustomerTypes.returningCustomers,
        repeatRate: repeatCustomerRate,
        ltvCents: observedLtvCents,
        top: topCustomers,
      },
      marketing: {
        activeCoupons,
        activePromotions,
        couponOrders: couponOrderRows.length,
        couponDiscountCents,
        topCoupons,
        cartReminders: currentCarts.length,
        recoveredCarts,
        recoveryRate: percentage(recoveredCarts, currentCarts.length),
        reminderEmails,
      },
      satisfaction,
      cohorts,
      coverage: {
        sessionsLimited,
        ordersLimited,
        catalogLimited: soldProductIds.length > 500,
        orderHistoryMonths: 24,
        attributedOrders: attributedOrders.length,
        unattributedOrders: Math.max(0, currentOrders.length - attributedOrders.length),
      },
    };
  },
});

export const purgeExpired = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const sessions = await ctx.db.query("analyticsSessions")
      .withIndex("by_started_at", (q) => q.lt("startedAt", cutoff))
      .take(25);
    let hasMore = sessions.length === 25;

    for (const session of sessions) {
      const linkedOrders = await ctx.db.query("orders")
        .withIndex("by_analytics_session_id", (q) => q.eq("analyticsSessionId", session.sessionId))
        .take(20);
      for (const order of linkedOrders) await ctx.db.patch(order._id, { analyticsSessionId: undefined });
      if (linkedOrders.length === 20) {
        hasMore = true;
      } else {
        await ctx.db.delete(session._id);
      }
    }

    if (hasMore) await ctx.scheduler.runAfter(0, internal.analytics.purgeExpired, {});
    return null;
  },
});
