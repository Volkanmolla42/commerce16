type AnalyticsDays = 7 | 30 | 90;

export type AnalyticsDashboard = {
  days: AnalyticsDays;
  generatedAt: number;
  summary: {
    revenueCents: number;
    paidOrders: number;
    orderCount: number;
    orderValueCents: number;
    averageOrderValueCents: number;
    pendingOrders: number;
    pendingValueCents: number;
    cancelledOrders: number;
    uniqueVisitors: number;
    sessions: number;
    pageViews: number;
    averagePageViews: number;
    conversionRate: number;
    newCustomers: number;
    returningCustomers: number;
    repeatCustomerRate: number;
    observedLtvCents: number;
  };
  previous: {
    revenueCents: number;
    paidOrders: number;
    orderCount: number;
    orderValueCents: number;
    averageOrderValueCents: number;
    uniqueVisitors: number;
    sessions: number;
    conversionRate: number;
    newCustomers: number;
  };
  trend: Array<{
    key: string;
    label: string;
    revenueCents: number;
    orderCount: number;
    orderValueCents: number;
    sessions: number;
    visitors: number;
  }>;
  funnel: Array<{
    key: "sessions" | "product_view" | "add_to_cart" | "checkout_started" | "purchase";
    label: string;
    sessions: number;
    conversionFromPrevious: number;
    dropOffFromPrevious: number;
  }>;
  channels: Array<{
    source: string;
    medium: string;
    sessions: number;
    paidOrders: number;
    conversionRate: number;
    revenueCents: number;
  }>;
  products: Array<{
    productId: string;
    title: string;
    quantity: number;
    orderCount: number;
    revenueCents: number;
  }>;
  categories: Array<{
    slug: string;
    title: string;
    quantity: number;
    revenueCents: number;
  }>;
  statuses: Array<{
    key: "received" | "shipped" | "delivered" | "cancelled";
    label: string;
    count: number;
    valueCents: number;
  }>;
  paymentStatuses: Array<{
    key: "pending" | "paid" | "failed" | "refunded";
    label: string;
    count: number;
    valueCents: number;
  }>;
  paymentMethods: Array<{
    key: "paytr" | "bank_transfer" | "cash_on_delivery" | "unknown";
    label: string;
    count: number;
    valueCents: number;
    pendingValueCents: number;
  }>;
  customers: {
    newCustomers: number;
    returningCustomers: number;
    repeatRate: number;
    ltvCents: number;
    top: Array<{
      name: string;
      email: string;
      orderCount: number;
      valueCents: number;
    }>;
  };
  marketing: {
    activeCoupons: number;
    activePromotions: number;
    couponOrders: number;
    couponDiscountCents: number;
    topCoupons: Array<{
      code: string;
      orderCount: number;
      discountCents: number;
    }>;
    cartReminders: number;
    recoveredCarts: number;
    recoveryRate: number;
    reminderEmails: number;
  };
  satisfaction: {
    feedbackCount: number;
    storeRating: number;
    deliveryRating: number;
    approvedReviews: number;
    averageReviewRating: number;
    pendingQuestions: number;
  };
  cohorts: Array<{
    month: string;
    label: string;
    customers: number;
    cells: Array<{
      age: number;
      activeCustomers: number;
      retentionPercent: number;
    }>;
  }>;
  coverage: {
    sessionsLimited: boolean;
    ordersLimited: boolean;
    catalogLimited: boolean;
    orderHistoryMonths: number;
    attributedOrders: number;
    unattributedOrders: number;
  };
};
