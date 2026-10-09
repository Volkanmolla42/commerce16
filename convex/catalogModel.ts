import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { getProductSearchText } from "../lib/catalog/smart-search";
import { getProductPriceRange } from "../lib/catalog/variants";

export type CatalogProductInput = Omit<Doc<"products">, "_id" | "_creationTime" | "priceValue" | "searchText">;

export function catalogMetadata(product: CatalogProductInput) {
  const basePrice = Number(product.price);
  if (!product.price.trim() || !Number.isFinite(basePrice) || basePrice < 0) throw new Error("Ürün fiyatı geçersiz.");
  const priceValue = Number(getProductPriceRange(product).min);
  if (!Number.isFinite(priceValue) || priceValue < 0) throw new Error("Ürün fiyatı geçersiz.");
  return { priceValue, searchText: getProductSearchText(product) };
}

function facetValues(product: CatalogProductInput | null) {
  if (!product?.availableForSale || !product.categorySlug) return new Map<string, { categorySlug: string; key: string; value: string; numericValue?: number }>();
  const entries = (product.attributes ?? []).flatMap(({ key, value }) =>
    (Array.isArray(value) ? value : [value]).map((item) => ({
      categorySlug: product.categorySlug!, key, value: String(item),
      ...(typeof item === "number" ? { numericValue: item } : {}),
    })),
  );
  return new Map(entries.map((entry) => [JSON.stringify([entry.categorySlug, entry.key, entry.value]), entry]));
}

// Keep the derived read models in the same transaction as the product write.
export async function syncCatalogMetadata(ctx: MutationCtx, previous: CatalogProductInput | null, next: CatalogProductInput | null) {
  const totalDelta = Number(next !== null) - Number(previous !== null);
  const activeDelta = Number(next?.availableForSale === true) - Number(previous?.availableForSale === true);
  if (totalDelta || activeDelta) {
    const stats = await ctx.db.query("catalogStats").withIndex("by_key", (q) => q.eq("key", "products")).unique();
    const counts = { total: (stats?.total ?? 0) + totalDelta, active: (stats?.active ?? 0) + activeDelta };
    if (stats) await ctx.db.patch(stats._id, counts);
    else await ctx.db.insert("catalogStats", { key: "products", ...counts });
  }
  const before = facetValues(previous);
  const after = facetValues(next);
  for (const token of new Set([...before.keys(), ...after.keys()])) {
    const delta = Number(after.has(token)) - Number(before.has(token));
    if (!delta) continue;
    const entry = after.get(token) ?? before.get(token)!;
    const stored = await ctx.db.query("catalogFacetValues").withIndex("by_category_and_key_and_value", (q) =>
      q.eq("categorySlug", entry.categorySlug).eq("key", entry.key).eq("value", entry.value)).unique();
    const count = (stored?.count ?? 0) + delta;
    if (stored && count <= 0) await ctx.db.delete(stored._id);
    else if (stored) await ctx.db.patch(stored._id, { count });
    else if (count > 0) await ctx.db.insert("catalogFacetValues", { ...entry, count });
  }
}

export async function insertCatalogProduct(ctx: MutationCtx, product: CatalogProductInput) {
  const id = await ctx.db.insert("products", { ...product, ...catalogMetadata(product) });
  await syncCatalogMetadata(ctx, null, product);
  return id;
}

export async function patchCatalogProduct(ctx: MutationCtx, previous: Doc<"products">, patch: Partial<CatalogProductInput>) {
  const next = { ...previous, ...patch };
  await ctx.db.patch(previous._id, { ...patch, ...catalogMetadata(next) });
  await syncCatalogMetadata(ctx, previous, next);
}

export async function deleteCatalogProduct(ctx: MutationCtx, product: Doc<"products">) {
  await syncCatalogMetadata(ctx, product, null);
  await ctx.db.delete(product._id);
}

export function withoutCatalogMetadata(product: Doc<"products">) {
  const { priceValue, searchText, ...result } = product;
  void priceValue;
  void searchText;
  return result;
}
