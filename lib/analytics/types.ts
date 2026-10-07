export type AnalyticsDashboard = {
  days: 7 | 30 | 90;
  generatedAt: number;
  summary: {
    uniqueVisitors: number;
    sessions: number;
    pageViews: number;
    paidOrders: number;
    revenueCents: number;
    averageOrderValueCents: number;
    observedLtvCents: number;
    repeatCustomerRate: number;
    attributedNewCustomers: number;
    marketingSpendCents: number;
    cacCents: number | null;
    unattributedPaidOrders: number;
  };
  funnel: Array<{
    key: "sessions" | "product_view" | "add_to_cart" | "checkout_started" | "purchase";
    label: string;
    sessions: number;
    conversionFromPrevious: number;
    dropOffFromPrevious: number;
  }>;
  channels: Array<{
    source: string;
    campaign: string;
    spendCents: number;
    newCustomers: number;
    attributedRevenueCents: number;
    cacCents: number | null;
  }>;
  cohorts: Array<{
    month: string;
    customers: number;
    cells: Array<{
      age: number;
      activeCustomers: number;
      retentionPercent: number;
    }>;
  }>;
  coverage: {
    funnelLimited: boolean;
    purchaseLimited: boolean;
    orderHistoryLimited: boolean;
    spendLimited: boolean;
    orderHistoryMonths: number;
  };
};
