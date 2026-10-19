import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { getProductPriceRange } from "../lib/catalog/variants";
import { productsTable } from "./schema";
import { resolvePublicImages, toPublicVariants } from "./productMedia";

export const productImageValidator = v.object({
  url: v.string(),
  selectedOptions: v.optional(v.array(v.object({ name: v.string(), value: v.string() }))),
});

export const productOptionValidator = productsTable.validator.fields.options.element;
export const productVariantValidator = productsTable.validator.fields.variants.element.extend({
  stockQuantity: v.optional(v.number()),
});

export async function toProductBase(
  ctx: QueryCtx,
  product: Doc<"products">,
  priceRange = getProductPriceRange(product),
) {
  return {
    id: product._id,
    title: product.title,
    slug: product.slug,
    price: priceRange.min,
    soldCount: product.soldCount ?? 0,
    _creationTime: product._creationTime,
    images: await resolvePublicImages(ctx, product.images),
    updatedAt: product.updatedAt,
    categorySlug: product.categorySlug,
    options: product.options,
    variants: toPublicVariants(product.variants),
  };
}
