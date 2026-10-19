import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { getImagesForVariant } from "../lib/catalog/product-images";
import { isVariantSellable } from "../lib/catalog/variants";

export async function resolvePublicImages(ctx: QueryCtx, images: Doc<"products">["images"]) {
  const resolved = await Promise.all(images.map(async ({ storageId, selectedOptions }) => {
    const url = await ctx.storage.getUrl(storageId);
    return url ? { url, ...(selectedOptions ? { selectedOptions } : {}) } : null;
  }));
  return resolved.filter((image): image is NonNullable<typeof image> => image !== null);
}

export async function resolveFirstImageUrl(ctx: QueryCtx, product: Doc<"products"> | null | undefined) {
  const image = product?.images[0];
  return image ? await ctx.storage.getUrl(image.storageId) : null;
}

export async function resolveDescriptionImages(ctx: QueryCtx, storageIds: Doc<"products">["descriptionImageStorageIds"]) {
  const urls = await Promise.all((storageIds ?? []).map((storageId) => ctx.storage.getUrl(storageId)));
  return urls.flatMap((url) => url ? [{ url }] : []);
}

export async function resolveVariantImageUrl(
  ctx: QueryCtx,
  product: Doc<"products"> | null | undefined,
  selectedOptions: { name: string; value: string }[],
) {
  const image = product ? getImagesForVariant(product.images, selectedOptions)[0] : undefined;
  return image ? await ctx.storage.getUrl(image.storageId) : null;
}

export function toPublicVariants(variants: Doc<"products">["variants"]) {
  return variants.map((variant) => ({
    ...variant,
    stockQuantity: Math.max(0, variant.stockQuantity),
    availableForSale: isVariantSellable(variant),
  }));
}
