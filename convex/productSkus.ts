import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

type ProductWithSkus = {
  variants?: { id: string; sku?: string }[];
};

export function normalizeSku(value: string | undefined) {
  const normalized = value?.trim().toLocaleUpperCase("en-US");
  if (!normalized) return undefined;
  if (!/^[A-Z0-9][A-Z0-9._-]{0,63}$/.test(normalized)) {
    throw new Error("SKU 1-64 karakter olmalı ve yalnızca harf, rakam, nokta, alt çizgi veya tire içermeli.");
  }
  return normalized;
}

export function normalizeVariantSkus<T extends ProductWithSkus>(product: T): T {
  const normalized = { ...product } as T;
  if (product.variants) {
    normalized.variants = product.variants.map((variant) => {
      const next = { ...variant };
      const variantSku = normalizeSku(variant.sku);
      if (variantSku) next.sku = variantSku;
      else delete next.sku;
      return next;
    });
  }
  return normalized;
}

export async function syncProductSkus(
  ctx: MutationCtx,
  productId: Id<"products">,
  product: ProductWithSkus,
) {
  const entries = (product.variants ?? []).flatMap((variant) => {
    const sku = normalizeSku(variant.sku);
    return sku ? [{ sku, variantId: variant.id }] : [];
  });
  if (new Set(entries.map(({ sku }) => sku)).size !== entries.length) {
    throw new Error("Her ürün ve varyant için farklı bir SKU kullanın.");
  }

  for (const entry of entries) {
    const owner = await ctx.db.query("productSkus")
      .withIndex("by_sku", (q) => q.eq("sku", entry.sku))
      .first();
    if (owner && owner.productId !== productId) {
      throw new Error(`${entry.sku} SKU kodu başka bir üründe kullanılıyor.`);
    }
  }

  const existing = await ctx.db.query("productSkus")
    .withIndex("by_product", (q) => q.eq("productId", productId))
    .take(101);
  for (const row of existing) await ctx.db.delete(row._id);
  for (const entry of entries) {
    await ctx.db.insert("productSkus", { ...entry, productId });
  }
}
