import { v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { assertAdminApiSecret } from "./adminAuth";
import schema from "./schema";

export type InventoryMovementReason =
  | "initial_stock"
  | "manual_adjustment"
  | "order_reservation"
  | "reservation_release"
  | "product_removed";

type ProductWithSkus = {
  sku?: string;
  variants?: { id: string; sku?: string }[];
};

type OrderForInventory = Doc<"orders">;

const movementValidator = schema.doc("inventoryMovements");

export function normalizeSku(value: string | undefined) {
  const normalized = value?.trim().toLocaleUpperCase("en-US");
  if (!normalized) return undefined;
  if (!/^[A-Z0-9][A-Z0-9._-]{0,63}$/.test(normalized)) {
    throw new Error("SKU 1-64 karakter olmalı ve yalnızca harf, rakam, nokta, alt çizgi veya tire içermeli.");
  }
  return normalized;
}

export function normalizeProductSkus<T extends ProductWithSkus>(product: T): T {
  const normalized = { ...product } as T;
  const sku = normalizeSku(product.sku);
  if (sku) normalized.sku = sku;
  else delete normalized.sku;
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

export async function syncSkuRegistry(
  ctx: MutationCtx,
  productId: Id<"products">,
  product: ProductWithSkus,
) {
  const entries = [
    ...(product.sku ? [{ sku: normalizeSku(product.sku)! }] : []),
    ...(product.variants ?? []).flatMap((variant) => {
      const sku = normalizeSku(variant.sku);
      return sku ? [{ sku, variantId: variant.id }] : [];
    }),
  ];
  if (new Set(entries.map(({ sku }) => sku)).size !== entries.length) {
    throw new Error("Her ürün ve varyant için farklı bir SKU kullanın.");
  }

  for (const entry of entries) {
    const owner = await ctx.db.query("inventorySkuRegistry")
      .withIndex("by_sku", (q) => q.eq("sku", entry.sku))
      .first();
    if (owner && owner.productId !== productId) {
      throw new Error(`${entry.sku} SKU kodu başka bir üründe kullanılıyor.`);
    }
  }

  const existing = await ctx.db.query("inventorySkuRegistry")
    .withIndex("by_product", (q) => q.eq("productId", productId))
    .take(101);
  for (const row of existing) await ctx.db.delete(row._id);
  for (const entry of entries) {
    await ctx.db.insert("inventorySkuRegistry", { ...entry, productId });
  }
}

export async function recordInventoryMovement(
  ctx: MutationCtx,
  movement: {
    productId: Id<"products">;
    productTitle: string;
    variantId?: string;
    sku: string;
    quantityDelta: number;
    reason: InventoryMovementReason;
    orderId?: Id<"orders">;
  },
) {
  if (movement.quantityDelta === 0) return;
  await ctx.db.insert("inventoryMovements", { ...movement, createdAt: Date.now() });
}

export async function recordInitialInventory(
  ctx: MutationCtx,
  productId: Id<"products">,
  product: Pick<Doc<"products">, "title" | "sku" | "stockQuantity" | "variants">,
) {
  if (product.stockQuantity != null) {
    await recordInventoryMovement(ctx, {
      productId,
      productTitle: product.title,
      sku: normalizeSku(product.sku) ?? `PRODUCT-${productId}`,
      quantityDelta: product.stockQuantity,
      reason: "initial_stock",
    });
  }
  for (const variant of product.variants ?? []) {
    if (variant.stockQuantity == null) continue;
    await recordInventoryMovement(ctx, {
      productId,
      productTitle: product.title,
      variantId: variant.id,
      sku: normalizeSku(variant.sku) ?? `VARIANT-${productId}-${variant.id}`,
      quantityDelta: variant.stockQuantity,
      reason: "initial_stock",
    });
  }
}

type InventoryTarget = {
  productId: Id<"products">;
  variantId?: string;
  sku: string;
  quantity: number;
  tracking: "product" | "variant";
};

export async function reserveOrderInventory(
  ctx: MutationCtx,
  order: OrderForInventory,
  expiresAt: number,
) {
  if (order.inventoryReserved) {
    const reservations = await ctx.db.query("inventoryReservations")
      .withIndex("by_order", (q) => q.eq("orderId", order._id))
      .order("desc")
      .take(100);
    for (const reservation of reservations) {
      if (reservation.status === "reserved") {
        await ctx.db.patch(reservation._id, { expiresAt, updatedAt: Date.now() });
      }
    }
    await ctx.db.patch(order._id, { reservationExpiresAt: expiresAt });
    return;
  }

  const targets = new Map<string, InventoryTarget>();
  for (const item of order.items) {
    const productId = ctx.db.normalizeId("products", item.productId);
    const product = productId ? await ctx.db.get(productId) : null;
    if (!product || !product.availableForSale) throw new Error("Siparişinizdeki ürün artık satışta değil.");
    const variants = product.variants ?? [];
    const variant = item.variantId
      ? variants.find((candidate) => candidate.id === item.variantId)
      : variants.length === 1 ? variants[0] : undefined;
    if ((product.variants?.length && !variant) || (variant && !variant.availableForSale)) {
      throw new Error("Siparişinizdeki varyant artık satışta değil.");
    }

    const tracking = variant?.stockQuantity != null
      ? "variant" as const
      : product.stockQuantity != null
        ? "product" as const
        : undefined;
    const stockQuantity = tracking === "variant"
      ? variant!.stockQuantity!
      : tracking === "product"
        ? product.stockQuantity!
        : null;
    if (item.stockTracked && !tracking) {
      throw new Error("Ürün stok takibi değişti. Siparişinizi yenileyip tekrar deneyin.");
    }
    if (!tracking) continue;
    if (stockQuantity === 0) throw new Error("Siparişinizdeki ürün tükendi.");

    const targetKey = tracking === "variant" ? `${product._id}:${variant!.id}` : String(product._id);
    const target = targets.get(targetKey);
    const quantity = (target?.quantity ?? 0) + item.quantity;
    if (stockQuantity == null || stockQuantity < quantity) throw new Error("Sipariş miktarı mevcut stok miktarını aşıyor.");
    targets.set(targetKey, {
      productId: product._id,
      ...(tracking === "variant" ? { variantId: variant!.id } : {}),
      sku: tracking === "variant"
        ? normalizeSku(variant!.sku) ?? `VARIANT-${product._id}-${variant!.id}`
        : normalizeSku(product.sku) ?? `PRODUCT-${product._id}`,
      quantity,
      tracking,
    });
  }

  const now = Date.now();
  for (const target of targets.values()) {
    const product = await ctx.db.get(target.productId);
    if (!product) throw new Error("Siparişinizdeki ürün bulunamadı.");
    if (target.tracking === "variant" && target.variantId) {
      const variants = product.variants ?? [];
      const index = variants.findIndex((variant) => variant.id === target.variantId);
      const variant = variants[index];
      if (!variant || variant.stockQuantity == null || variant.stockQuantity < target.quantity) {
        throw new Error("Varyant stoğu değişti. Sepetinizi yenileyip tekrar deneyin.");
      }
      await ctx.db.patch(product._id, {
        variants: variants.map((candidate, variantIndex) => variantIndex === index
          ? { ...candidate, stockQuantity: variant.stockQuantity! - target.quantity }
          : candidate),
        updatedAt: new Date().toISOString(),
      });
    } else {
      if (product.stockQuantity == null || product.stockQuantity < target.quantity) {
        throw new Error("Ürün stoğu değişti. Sepetinizi yenileyip tekrar deneyin.");
      }
      await ctx.db.patch(product._id, {
        stockQuantity: product.stockQuantity - target.quantity,
        updatedAt: new Date().toISOString(),
      });
    }
    await ctx.db.insert("inventoryReservations", {
      orderId: order._id,
      productId: target.productId,
      variantId: target.variantId,
      sku: target.sku,
      quantity: target.quantity,
      status: "reserved",
      expiresAt,
      createdAt: now,
      updatedAt: now,
    });
    await recordInventoryMovement(ctx, {
      productId: target.productId,
      productTitle: product.title,
      variantId: target.variantId,
      sku: target.sku,
      quantityDelta: -target.quantity,
      reason: "order_reservation",
      orderId: order._id,
    });
  }
  await ctx.db.patch(order._id, { inventoryReserved: true, reservationExpiresAt: expiresAt });
}

export async function commitOrderInventory(ctx: MutationCtx, orderId: Id<"orders">) {
  const reservations = await ctx.db.query("inventoryReservations")
    .withIndex("by_order", (q) => q.eq("orderId", orderId))
    .order("desc")
    .take(100);
  const now = Date.now();
  for (const reservation of reservations) {
    if (reservation.status === "reserved") {
      await ctx.db.patch(reservation._id, { status: "committed", updatedAt: now });
    }
  }
}

export async function releaseOrderInventory(ctx: MutationCtx, orderId: Id<"orders">) {
  const reservations = await ctx.db.query("inventoryReservations")
    .withIndex("by_order", (q) => q.eq("orderId", orderId))
    .order("desc")
    .take(100);
  const restockTargets: Array<{ productId: Id<"products">; variantId: string }> = [];
  const now = Date.now();

  for (const reservation of reservations) {
    if (reservation.status === "released") continue;
    const product = await ctx.db.get(reservation.productId);
    if (product) {
      if (reservation.variantId) {
        const variants = product.variants ?? [];
        const index = variants.findIndex((variant) => variant.id === reservation.variantId);
        const variant = variants[index];
        if (variant?.stockQuantity != null) {
          const nextQuantity = variant.stockQuantity + reservation.quantity;
          await ctx.db.patch(product._id, {
            variants: variants.map((candidate, variantIndex) => variantIndex === index
              ? { ...candidate, stockQuantity: nextQuantity }
              : candidate),
            updatedAt: new Date().toISOString(),
          });
          if (variant.stockQuantity === 0 && nextQuantity > 0 && product.availableForSale && variant.availableForSale) {
            restockTargets.push({ productId: product._id, variantId: variant.id });
          }
          await recordInventoryMovement(ctx, {
            productId: product._id,
            productTitle: product.title,
            variantId: variant.id,
            sku: reservation.sku,
            quantityDelta: reservation.quantity,
            reason: "reservation_release",
            orderId,
          });
        }
      } else if (product.stockQuantity != null) {
        const nextQuantity = product.stockQuantity + reservation.quantity;
        await ctx.db.patch(product._id, {
          stockQuantity: nextQuantity,
          updatedAt: new Date().toISOString(),
        });
        if (product.stockQuantity === 0 && nextQuantity > 0 && product.availableForSale) {
          const variantIds = (product.variants ?? []).filter((variant) =>
            variant.availableForSale && variant.stockQuantity == null,
          ).map((variant) => variant.id);
          for (const variantId of variantIds) restockTargets.push({ productId: product._id, variantId });
          if (variantIds.length === 0 && (product.variants?.length ?? 0) === 0) {
            restockTargets.push({ productId: product._id, variantId: "" });
          }
        }
        await recordInventoryMovement(ctx, {
          productId: product._id,
          productTitle: product.title,
          sku: reservation.sku,
          quantityDelta: reservation.quantity,
          reason: "reservation_release",
          orderId,
        });
      }
    }
    await ctx.db.patch(reservation._id, { status: "released", updatedAt: now });
  }

  const order = await ctx.db.get(orderId);
  if (order?.inventoryReserved) await ctx.db.patch(orderId, { inventoryReserved: false });
  return restockTargets;
}

export const listMovements = query({
  args: { adminSecret: v.string(), productId: v.optional(v.id("products")), limit: v.optional(v.number()) },
  returns: v.array(movementValidator),
  handler: async (ctx, { adminSecret, productId, limit }) => {
    assertAdminApiSecret(adminSecret);
    const take = limit === undefined ? 100 : Math.max(1, Math.min(200, Math.trunc(limit)));
    if (!Number.isSafeInteger(take)) throw new Error("Hareket limiti geçersiz.");
    if (productId) {
      return await ctx.db.query("inventoryMovements")
        .withIndex("by_product", (q) => q.eq("productId", productId))
        .order("desc")
        .take(take);
    }
    return await ctx.db.query("inventoryMovements").order("desc").take(take);
  },
});
