import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import { env, internalMutation, mutation, query } from "./_generated/server";
import { assertAdminApiSecret } from "./adminAuth";

async function hashCustomerKey(email: string, secret?: string) {
  const data = new TextEncoder().encode(`customer:${secret ?? "analytics"}:${email}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const eventTypeValidator = v.union(
  v.literal("page_view"),
  v.literal("product_view"),
  v.literal("add_to_cart"),
  v.literal("begin_checkout"),
);

const analyticsRateLimiter = new RateLimiter(components.rateLimiter, {
  eventsPerVisitor: { kind: "fixed window", rate: 180, period: MINUTE },
});

const dashboardValidator = v.object({
  days: v.union(v.literal(7), v.literal(30), v.literal(90)),
  generatedAt: v.number(),
  summary: v.object({
    uniqueVisitors: v.number(),
    sessions: v.number(),
    pageViews: v.number(),
    paidOrders: v.number(),
    revenueCents: v.number(),
    averageOrderValueCents: v.number(),
    observedLtvCents: v.number(),
    repeatCustomerRate: v.number(),
    unattributedPaidOrders: v.number(),
  }),
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
    campaign: v.string(),
    newCustomers: v.number(),
    attributedRevenueCents: v.number(),
  })),
  cohorts: v.array(v.object({
    month: v.string(),
    customers: v.number(),
    cells: v.array(v.object({
      age: v.number(),
      activeCustomers: v.number(),
      retentionPercent: v.number(),
    })),
  })),
  coverage: v.object({
    funnelLimited: v.boolean(),
    purchaseLimited: v.boolean(),
    orderHistoryLimited: v.boolean(),
    orderHistoryMonths: v.number(),
  }),
});

type FunnelKey = "sessions" | "product_view" | "add_to_cart" | "checkout_started" | "purchase";

function isUuid(value: string) {
  return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
}

function cleanAttribution(value: string) {
  return value.trim().replace(/[^\p{L}\p{N}._ -]/gu, "").slice(0, 120).toLocaleLowerCase("tr-TR");
}

function monthKey(timestamp: number) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(timestamp);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  return `${year}-${month}`;
}

function monthIndex(month: string) {
  const [year, value] = month.split("-").map(Number);
  return year * 12 + value - 1;
}

function centsFromAmount(value: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return 0;
  const cents = Math.round(amount * 100);
  return Number.isSafeInteger(cents) ? cents : 0;
}

function percentage(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 10_000) / 100 : 0;
}

function stage(
  key: FunnelKey,
  label: string,
  sessions: number,
  previous: number,
) {
  const conversionFromPrevious = key === "sessions" ? 100 : percentage(sessions, previous);
  return {
    key,
    label,
    sessions,
    conversionFromPrevious,
    dropOffFromPrevious: key === "sessions" || previous === 0
      ? 0
      : Math.max(0, Math.round((100 - conversionFromPrevious) * 100) / 100),
  };
}

export const recordEvent = mutation({
  args: {
    adminSecret: v.string(),
    visitorId: v.string(),
    sessionId: v.string(),
    eventType: eventTypeValidator,
    source: v.string(),
    medium: v.string(),
    campaign: v.optional(v.string()),
    route: v.optional(v.string()),
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
      ...(args.route ? { lastRoute: args.route } : {}),
    };

    if (existing) {
      await ctx.db.patch(existing._id, next);
    } else {
      await ctx.db.insert("analyticsSessions", { ...session, ...next });
    }
    return null;
  },
});

export const syncOrderAttribution = internalMutation({
  args: { orderId: v.id("orders"), attempts: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, { orderId, attempts = 0 }) => {
    const order = await ctx.db.get(orderId);
    if (!order) return null;

    const existing = await ctx.db.query("analyticsPurchases")
      .withIndex("by_order_id", (q) => q.eq("orderId", orderId))
      .unique();
    const isPaid = order.status === "paid";
    if (!isPaid) {
      if (existing) await ctx.db.delete(existing._id);
      return null;
    }
    if (existing || !order.analyticsSessionId) return null;

    const session = await ctx.db.query("analyticsSessions")
      .withIndex("by_session_id", (q) => q.eq("sessionId", order.analyticsSessionId!))
      .unique();
    if (!session) {
      if (attempts < 3) {
        await ctx.scheduler.runAfter(1_000, internal.analytics.syncOrderAttribution, {
          orderId,
          attempts: attempts + 1,
        });
      }
      return null;
    }

    await ctx.db.insert("analyticsPurchases", {
      orderId,
      sessionId: session.sessionId,
      visitorId: session.visitorId,
      customerKey: await hashCustomerKey(order.customerEmail.trim().toLowerCase(), env.ADMIN_API_SECRET),
      source: session.source,
      medium: session.medium,
      campaign: session.campaign,
      amountCents: centsFromAmount(order.total),
      paidAt: order.paidAt ?? order._creationTime,
    });
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

    const purchases = await ctx.db.query("analyticsPurchases")
      .withIndex("by_visitor_id", (q) => q.eq("visitorId", visitorId))
      .take(50);
    for (const purchase of purchases) await ctx.db.delete(purchase._id);
    if (purchases.length === 50) hasMore = true;

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
    const from = now - days * 24 * 60 * 60 * 1000;
    const historyFrom = now - 730 * 24 * 60 * 60 * 1000;
    const currentMonth = monthKey(now);
    const oldestCohortMonthIndex = monthIndex(currentMonth) - 11;
    const oldestCohortMonth = `${Math.floor(oldestCohortMonthIndex / 12).toString().padStart(4, "0")}-${String(oldestCohortMonthIndex % 12 + 1).padStart(2, "0")}`;

    const [sessionRows, purchaseRows, paidByStatus] = await Promise.all([
      ctx.db.query("analyticsSessions")
        .withIndex("by_started_at", (q) => q.gte("startedAt", from))
        .order("desc")
        .take(5_001),
      ctx.db.query("analyticsPurchases")
        .withIndex("by_paid_at", (q) => q.gte("paidAt", from))
        .order("desc")
        .take(5_001),
      ctx.db.query("orders").withIndex("by_status", (q) => q.eq("status", "paid").gte("_creationTime", historyFrom)).order("desc").take(750),
    ]);

    const sessions = sessionRows.slice(0, 5_000);
    const purchases = purchaseRows.slice(0, 5_000);
    const paidOrders = paidByStatus;
    const orderHistoryLimited = paidByStatus.length === 750;
    const customers = new Map<string, Array<{ orderId: string; paidAt: number; amountCents: number; month: string }>>();
    for (const order of paidOrders) {
      const customerKey = await hashCustomerKey(order.customerEmail.trim().toLowerCase(), env.ADMIN_API_SECRET);
      const orders = customers.get(customerKey) ?? [];
      orders.push({
        orderId: order._id,
        paidAt: order.paidAt ?? order._creationTime,
        amountCents: centsFromAmount(order.total),
        month: monthKey(order.paidAt ?? order._creationTime),
      });
      customers.set(customerKey, orders);
    }

    let revenueCents = 0;
    let periodPaidOrders = 0;
    let periodRevenueCents = 0;
    const cohortGroups = new Map<string, { customers: number; activeByAge: Map<number, number> }>();
    let repeatCustomers = 0;
    const cohortStartIndex = monthIndex(oldestCohortMonth);
    const currentMonthIndex = monthIndex(currentMonth);

    for (const customerOrders of customers.values()) {
      customerOrders.sort((a, b) => a.paidAt - b.paidAt);
      const firstOrder = customerOrders[0];
      if (customerOrders.length > 1) repeatCustomers += 1;

      for (const order of customerOrders) {
        revenueCents += order.amountCents;
        if (order.paidAt >= from && order.paidAt <= now) {
          periodPaidOrders += 1;
          periodRevenueCents += order.amountCents;
        }
      }

      if (!firstOrder || monthIndex(firstOrder.month) < cohortStartIndex) continue;
      const cohort = cohortGroups.get(firstOrder.month) ?? { customers: 0, activeByAge: new Map<number, number>() };
      cohort.customers += 1;
      const activeAges = new Set<number>();
      for (const order of customerOrders) {
        const age = monthIndex(order.month) - monthIndex(firstOrder.month);
        if (age >= 0 && age <= 11 && monthIndex(order.month) <= currentMonthIndex) activeAges.add(age);
      }
      for (const age of activeAges) cohort.activeByAge.set(age, (cohort.activeByAge.get(age) ?? 0) + 1);
      cohortGroups.set(firstOrder.month, cohort);
    }

    const purchaseSessions = new Set(purchases.map((purchase) => purchase.sessionId));
    const visitorIds = new Set(sessions.map((session) => session.visitorId));
    const productViewSessions = sessions.filter((session) => session.productViews > 0).length;
    const addToCartSessions = sessions.filter((session) => session.addedToCart).length;
    const checkoutSessions = sessions.filter((session) => session.checkoutStarted).length;
    const purchasedSessions = sessions.filter((session) => purchaseSessions.has(session.sessionId)).length;
    const funnel = [
      stage("sessions", "Oturum", sessions.length, 0),
      stage("product_view", "Ürün görüntüleme", productViewSessions, sessions.length),
      stage("add_to_cart", "Sepete ekleme", addToCartSessions, productViewSessions),
      stage("checkout_started", "Ödeme adımı", checkoutSessions, addToCartSessions),
      stage("purchase", "Tamamlanan satın alma", purchasedSessions, checkoutSessions),
    ];

    const firstOrderById = new Map<string, { customerKey: string; paidAt: number; amountCents: number }>();
    for (const [customerKey, customerOrders] of customers) {
      const first = [...customerOrders].sort((a, b) => a.paidAt - b.paidAt)[0];
      if (first) firstOrderById.set(first.orderId, { customerKey, paidAt: first.paidAt, amountCents: first.amountCents });
    }

    const campaignAttribution = new Map<string, {
      source: string;
      campaign: string;
      newCustomerKeys: Set<string>;
      attributedRevenueCents: number;
    }>();

    const trackedOrderIds = new Set<string>();
    for (const purchase of purchases) {
      trackedOrderIds.add(purchase.orderId);
      const campaignKey = `${purchase.source.toLocaleLowerCase("tr-TR")}\n${(purchase.campaign ?? "").toLocaleLowerCase("tr-TR")}`;
      const entry = campaignAttribution.get(campaignKey) ?? {
        source: purchase.source,
        campaign: purchase.campaign ?? "",
        newCustomerKeys: new Set<string>(),
        attributedRevenueCents: 0,
      };
      entry.attributedRevenueCents += purchase.amountCents;
      campaignAttribution.set(campaignKey, entry);

      const first = firstOrderById.get(purchase.orderId);
      if (!first || first.paidAt < from || first.paidAt > now) continue;
      entry.newCustomerKeys.add(first.customerKey);
    }

    const channels = [...campaignAttribution.values()]
      .map((entry) => ({
        source: entry.source,
        campaign: entry.campaign,
        newCustomers: entry.newCustomerKeys.size,
        attributedRevenueCents: entry.attributedRevenueCents,
      }))
      .sort((a, b) => b.attributedRevenueCents - a.attributedRevenueCents || a.source.localeCompare(b.source));
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
        customers: cohort.customers,
        cells: Array.from({ length: currentAge + 1 }, (_, age) => {
          const activeCustomers = cohort.activeByAge.get(age) ?? 0;
          return { age, activeCustomers, retentionPercent: percentage(activeCustomers, cohort.customers) };
        }),
      }];
    });
    const observedLtvCents = customers.size > 0 ? Math.round(revenueCents / customers.size) : 0;
    return {
      days,
      generatedAt: now,
      summary: {
        uniqueVisitors: visitorIds.size,
        sessions: sessions.length,
        pageViews: sessions.reduce((sum, session) => sum + session.pageViews, 0),
        paidOrders: periodPaidOrders,
        revenueCents: periodRevenueCents,
        averageOrderValueCents: periodPaidOrders > 0
          ? Math.round(periodRevenueCents / periodPaidOrders)
          : 0,
        observedLtvCents,
        repeatCustomerRate: percentage(repeatCustomers, customers.size),
        unattributedPaidOrders: Math.max(0, periodPaidOrders - trackedOrderIds.size),
      },
      funnel,
      channels,
      cohorts,
      coverage: {
        funnelLimited: sessionRows.length > 5_000,
        purchaseLimited: purchaseRows.length > 5_000,
        orderHistoryLimited,
        orderHistoryMonths: 24,
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

    const purchases = await ctx.db.query("analyticsPurchases")
      .withIndex("by_paid_at", (q) => q.lt("paidAt", cutoff))
      .take(50);
    for (const purchase of purchases) await ctx.db.delete(purchase._id);
    if (purchases.length === 50) hasMore = true;

    if (hasMore) await ctx.scheduler.runAfter(0, internal.analytics.purgeExpired, {});
    return null;
  },
});
