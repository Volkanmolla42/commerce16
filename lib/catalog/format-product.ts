import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import type { Product } from "./types";

type ProductResponse = FunctionReturnType<typeof api.products.list>[number];

export function formatProduct(item: ProductResponse): Product {
  return {
    id: item._id,
    slug: item.slug,
    title: item.title,
    price: item.price,
    availableForSale: item.availableForSale,
    attributes: item.attributes,
    categorySlug: item.categorySlug,
    images: item.images.map(({ url, selectedOptions }) => ({ url, ...(selectedOptions ? { selectedOptions } : {}) })),
    options: item.options,
    variants: item.variants.map(({ price, ...variant }) => ({
      ...variant,
      price: { amount: price, currencyCode: "TRY" },
    })),
    updatedAt: item.updatedAt || new Date(item._creationTime).toISOString(),
  };
}
