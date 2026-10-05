import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import schema from "./schema";
import { insertAddress } from "./addresses";
import { getAuthUserId } from "@convex-dev/auth/server";
import { assertAdminApiSecret } from "./adminAuth";

const orderValidator = schema.doc("orders");
const orderItemValidator = orderValidator.fields.items.element;
const orderStatusValidator = orderValidator.fields.status;

export const getMyOrders = query({
  args: {},
  returns: v.array(orderValidator),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(20);

    return orders;
  },
});

export const listAllAdmin = query({
  args: {
    adminSecret: v.string(),
  },
  returns: v.array(orderValidator),
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);
    return await ctx.db.query("orders").order("desc").take(100);
  },
});

export const getOrderById = query({
  args: {
    id: v.id("orders"),
  },
  returns: v.union(orderValidator, v.null()),
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.id);
    if (!order) return null;

    const userId = await getAuthUserId(ctx);
    if (!userId || order.userId !== userId) {
      return null;
    }

    return order;
  },
});

export const createOrder = mutation({
  args: {
    customerEmail: v.string(),
    customerName: v.string(),
    customerPhone: v.optional(v.string()),
    items: v.array(orderItemValidator),
    total: v.string(),
    shippingAddress: v.optional(v.string()),
    saveAddress: v.optional(
      schema.doc("addresses").pick("title", "city", "district", "addressLine1", "addressLine2", "postalCode")
        .extend({ isDefault: v.optional(v.boolean()) })
    ),
  },
  returns: v.id("orders"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!args.customerName.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(args.customerEmail.trim())) {
      throw new Error("Ad ve geçerli e-posta gereklidir.");
    }
    if (args.items.length === 0 || args.items.length > 100) throw new Error("Sipariş 1 ile 100 ürün içermeli.");
    const items = [];
    let totalCents = 0;
    for (const item of args.items) {
      if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 999) throw new Error("Ürün adedi 1 ile 999 arasında tam sayı olmalı.");
      const productId = ctx.db.normalizeId("products", item.productId);
      const product = productId ? await ctx.db.get(productId) : null;
      if (!product || !product.availableForSale) throw new Error("Sepetinizdeki ürün satışa uygun değil.");
      const variants = product.variants ?? [];
      const variant = item.variantId ? variants.find((candidate) => candidate.id === item.variantId) : undefined;
      if ((variants.length > 0 && !variant) || (item.variantId && !variant) || (variant && !variant.availableForSale)) throw new Error("Ürün seçeneği satışa uygun değil.");
      const price = variant?.price ?? product.price;
      if (!/^\d+(?:\.\d{1,2})?$/.test(price)) throw new Error("Ürün fiyatı geçersiz.");
      const cents = Math.round(Number(price) * 100);
      if (!Number.isSafeInteger(cents) || cents < 0 || !Number.isSafeInteger(totalCents + cents * item.quantity)) throw new Error("Sipariş tutarı geçersiz.");
      if (Number(item.price) !== Number(price)) throw new Error("Sepet fiyatı değişti. Ürünleri yeniden sepete ekleyin.");
      totalCents += cents * item.quantity;
      const storageImage = product.storageImages?.[0];
      const image = product.images[0] ?? (storageImage ? await ctx.storage.getUrl(storageImage.storageId) : null);
      items.push({ productId: product._id, variantId: variant?.id, title: variant ? `${product.title} — ${variant.title}` : product.title, quantity: item.quantity, price: (cents / 100).toFixed(2), image: image ?? undefined });
    }
    if (Number(args.total) !== totalCents / 100) throw new Error("Sepet tutarı değişti. Sepetinizi kontrol edin.");

    // 1. Kullanıcı giriş yapmışsa ad-soyad ve telefon bilgisini profiline kaydet / güncelle
    if (userId) {
      const userUpdates: Record<string, string> = {};
      if (args.customerName && args.customerName.trim()) {
        userUpdates.name = args.customerName.trim();
      }
      if (args.customerPhone && args.customerPhone.trim()) {
        userUpdates.phone = args.customerPhone.trim();
      }
      if (Object.keys(userUpdates).length > 0) {
        await ctx.db.patch(userId, userUpdates);
      }

      // 2. Eğer yeni adres girildiyse ve kaydedilmesi istendiyse adres defterine kaydet
      if (args.saveAddress) {
        await insertAddress(ctx, userId, {
          ...args.saveAddress,
          fullName: args.customerName,
          phone: args.customerPhone ?? "",
          isDefault: args.saveAddress.isDefault ?? false,
        });
      }
    }

    // 3. Siparişi oluştur
    const orderId = await ctx.db.insert("orders", {
      userId: userId ?? undefined,
      customerEmail: args.customerEmail.trim(),
      customerName: args.customerName.trim(),
      customerPhone: args.customerPhone?.trim(),
      items,
      total: (totalCents / 100).toFixed(2),
      status: "pending",
      shippingAddress: args.shippingAddress,
    });

    return orderId;
  },
});

export const updateStatus = mutation({
  args: {
    adminSecret: v.string(),
    id: v.id("orders"),
    status: orderStatusValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);
    await ctx.db.patch(args.id, { status: args.status });
    return null;
  },
});
