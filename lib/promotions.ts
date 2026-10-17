export type PromotionType = "cart_percentage" | "buy_x_get_y" | "category_free_shipping";

export type PromotionRule = {
  id: string;
  title: string;
  type: PromotionType;
  categorySlug?: string;
  productId?: string;
  percentage?: number;
  buyQuantity?: number;
  payQuantity?: number;
  minSubtotalKurus?: number;
};

export type PromotionLine = {
  productId: string;
  unitPriceKurus: number;
  quantity: number;
  categorySlug?: string;
};

export type PromotionQuote = {
  discountKurus: number;
  title: string | null;
  freeShipping: boolean;
  freeShippingTitle: string | null;
};

function matchesTarget(line: PromotionLine, rule: PromotionRule) {
  if (rule.productId) return line.productId === rule.productId;
  if (rule.categorySlug) return line.categorySlug === rule.categorySlug;
  return true;
}

function targetedSubtotalKurus(lines: PromotionLine[], productId: string) {
  return lines.reduce(
    (sum, line) => line.productId === productId ? sum + line.unitPriceKurus * line.quantity : sum,
    0,
  );
}

function buyXGetYDiscount(lines: PromotionLine[], rule: PromotionRule) {
  const buy = rule.buyQuantity ?? 0;
  const pay = rule.payQuantity ?? 0;
  if (buy < 2 || pay < 1 || pay >= buy) return 0;
  const priceCounts = new Map<number, number>();
  let totalUnits = 0;
  for (const line of lines) {
    if (line.quantity <= 0 || !matchesTarget(line, rule)) continue;
    totalUnits += line.quantity;
    priceCounts.set(line.unitPriceKurus, (priceCounts.get(line.unitPriceKurus) ?? 0) + line.quantity);
  }
  const freeUnits = Math.floor(totalUnits / buy) * (buy - pay);
  if (freeUnits <= 0) return 0;
  let remaining = freeUnits;
  let discount = 0;
  const prices = [...priceCounts].sort(([left], [right]) => left - right);
  for (const [price, count] of prices) {
    const take = Math.min(remaining, count);
    discount += take * price;
    remaining -= take;
    if (remaining <= 0) break;
  }
  return discount;
}

export function quotePromotions(
  lines: PromotionLine[],
  rules: PromotionRule[],
  afterCouponKurus: number,
  subtotalKurus: number = afterCouponKurus,
): PromotionQuote {
  const matchingShippingRule = rules.find(
    (rule) =>
      rule.type === "category_free_shipping" &&
      Boolean(rule.productId || rule.categorySlug) &&
      lines.some((line) => line.quantity > 0 && matchesTarget(line, rule)),
  );
  const freeShipping = Boolean(matchingShippingRule);

  let discountKurus = 0;
  let title: string | null = null;

  if (Number.isSafeInteger(afterCouponKurus) && afterCouponKurus > 0) {
    for (const rule of rules) {
      if (rule.minSubtotalKurus !== undefined && subtotalKurus < rule.minSubtotalKurus) continue;
      const discount = rule.type === "cart_percentage"
        ? Math.floor(
            (rule.productId
              ? targetedSubtotalKurus(lines, rule.productId)
              : afterCouponKurus) * (rule.percentage ?? 0) / 100,
          )
        : rule.type === "buy_x_get_y"
          ? buyXGetYDiscount(lines, rule)
          : 0;
      if (discount > discountKurus) {
        discountKurus = discount;
        title = rule.title;
      }
    }
  }

  return {
    discountKurus: Math.min(Math.max(0, discountKurus), Math.max(0, afterCouponKurus)),
    title,
    freeShipping,
    freeShippingTitle: matchingShippingRule?.title ?? null,
  };
}
