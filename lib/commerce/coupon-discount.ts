type DiscountableOrderLine = { price: string; quantity: number };
type DiscountedOrderLine = {
  listTotalKurus: number;
  discountKurus: number;
  payableKurus: number;
};

export function allocateCouponDiscount(
  lines: readonly DiscountableOrderLine[],
  couponDiscountKurus: number,
): DiscountedOrderLine[] {
  const listTotals = lines.map((line) => Math.round(Number(line.price) * 100) * line.quantity);
  let remainingSubtotalKurus = listTotals.reduce((sum, amount) => sum + amount, 0);
  let remainingDiscountKurus = Math.min(Math.max(0, Math.trunc(couponDiscountKurus)), remainingSubtotalKurus);

  return listTotals.map((listTotalKurus, index) => {
    const discountKurus = index === listTotals.length - 1
      ? remainingDiscountKurus
      : remainingSubtotalKurus > 0
        ? Math.min(listTotalKurus, Math.floor(remainingDiscountKurus * listTotalKurus / remainingSubtotalKurus))
        : 0;
    remainingDiscountKurus -= discountKurus;
    remainingSubtotalKurus -= listTotalKurus;
    return {
      listTotalKurus,
      discountKurus,
      payableKurus: listTotalKurus - discountKurus,
    };
  });
}
