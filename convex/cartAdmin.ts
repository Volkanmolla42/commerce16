import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { resolveVariantImageUrl } from "./productMedia";

export type CartItemRef = {
  productId: string | Id<"products">;
  variantId?: string;
  quantity: number;
};

export type EnrichedCartItem = {
  productId: string;
  variantId?: string;
  quantity: number;
  title: string;
  variantTitle?: string;
  price: string;
  image?: string;
};

export async function enrichCartItems(ctx: QueryCtx, items: CartItemRef[]) {
  const enriched: EnrichedCartItem[] = [];
  let itemCount = 0;
  let total = 0;

  for (const item of items) {
    const productId = ctx.db.normalizeId("products", item.productId);
    const product = productId ? await ctx.db.get(productId) : null;
    const variant = item.variantId
      ? product?.variants?.find((candidate) => candidate.id === item.variantId)
      : undefined;
    const price = variant?.price ?? "0.00";
    itemCount += item.quantity;
    total += (Number.parseFloat(price) || 0) * item.quantity;
    const image = await resolveVariantImageUrl(ctx, product, variant?.selectedOptions ?? []);

    enriched.push({
      productId: String(item.productId),
      variantId: item.variantId,
      quantity: item.quantity,
      title: product?.title ?? "Silinmiş ürün",
      variantTitle: variant?.title,
      price,
      image: image ?? undefined,
    });
  }

  return { items: enriched, itemCount, estimatedTotal: total.toFixed(2) };
}
