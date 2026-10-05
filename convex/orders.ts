import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

const orderItemValidator = v.object({
  productId: v.string(),
  variantId: v.optional(v.string()),
  title: v.string(),
  quantity: v.number(),
  price: v.string(),
  image: v.optional(v.string()),
});

const orderStatusValidator = v.union(
  v.literal("pending"),
  v.literal("paid"),
  v.literal("shipped"),
  v.literal("delivered"),
  v.literal("cancelled")
);

const orderValidator = v.object({
  _id: v.id("orders"),
  _creationTime: v.number(),
  userId: v.optional(v.id("users")),
  customerEmail: v.string(),
  customerName: v.string(),
  customerPhone: v.optional(v.string()),
  items: v.array(orderItemValidator),
  total: v.string(),
  status: orderStatusValidator,
  shippingAddress: v.optional(v.string()),
});

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
  args: {},
  returns: v.array(orderValidator),
  handler: async (ctx) => {
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
    // If order has userId and logged-in user is someone else, restrict access
    if (order.userId && userId && order.userId !== userId) {
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
      v.object({
        title: v.string(),
        city: v.string(),
        district: v.string(),
        addressLine1: v.string(),
        addressLine2: v.optional(v.string()),
        postalCode: v.optional(v.string()),
        isDefault: v.optional(v.boolean()),
      })
    ),
  },
  returns: v.id("orders"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

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
        const existingAddresses = await ctx.db
          .query("addresses")
          .withIndex("by_userId", (q) => q.eq("userId", userId))
          .collect();

        const isFirst = existingAddresses.length === 0;
        const shouldBeDefault = args.saveAddress.isDefault || isFirst;

        if (shouldBeDefault) {
          for (const addr of existingAddresses) {
            if (addr.isDefault) {
              await ctx.db.patch(addr._id, { isDefault: false });
            }
          }
        }

        await ctx.db.insert("addresses", {
          userId,
          title: args.saveAddress.title || "Ev",
          fullName: args.customerName.trim(),
          phone: args.customerPhone?.trim() || "",
          city: args.saveAddress.city.trim(),
          district: args.saveAddress.district.trim(),
          addressLine1: args.saveAddress.addressLine1.trim(),
          addressLine2: args.saveAddress.addressLine2?.trim(),
          postalCode: args.saveAddress.postalCode?.trim(),
          isDefault: shouldBeDefault,
        });
      }
    }

    // 3. Siparişi oluştur
    const orderId = await ctx.db.insert("orders", {
      userId: userId ?? undefined,
      customerEmail: args.customerEmail.trim(),
      customerName: args.customerName.trim(),
      customerPhone: args.customerPhone?.trim(),
      items: args.items,
      total: args.total,
      status: "pending",
      shippingAddress: args.shippingAddress,
    });

    return orderId;
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("orders"),
    status: orderStatusValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: args.status });
    return null;
  },
});
