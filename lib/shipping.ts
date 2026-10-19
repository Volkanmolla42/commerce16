export function getShippingQuote({
  subtotal,
  freeShippingThreshold = 0,
  shippingFee = 0,
  promotionFreeShipping = false,
}: {
  subtotal: number;
  freeShippingThreshold?: number;
  shippingFee?: number;
  promotionFreeShipping?: boolean;
}) {
  const freeShipping = promotionFreeShipping || freeShippingThreshold <= 0 || subtotal >= freeShippingThreshold;
  return { freeShipping, shippingFee: freeShipping ? 0 : shippingFee };
}
