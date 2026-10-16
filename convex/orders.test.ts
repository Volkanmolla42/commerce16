/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { RateLimiter } from "@convex-dev/rate-limiter";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");
const secret = "test-admin-secret-orders";

function makeTest() {
  return convexTest(schema, modules);
}
type Test = ReturnType<typeof makeTest>;

beforeEach(() => {
  vi.stubEnv("ADMIN_API_SECRET", secret);
  vi.spyOn(RateLimiter.prototype, "limit").mockResolvedValue({ ok: true } as unknown as Awaited<ReturnType<RateLimiter["limit"]>>);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

async function seedProduct(t: Test, stockQuantity = 10) {
  return await t.mutation(api.products.create, {
    adminSecret: secret,
    title: "Test Küpe",
    slug: "test-kupe",
    availableForSale: true,
    options: [],
    images: [],
    variants: [
      {
        id: "v-kupe-1",
        title: "Standart",
        sku: "SKU-KUPE-1",
        price: "250.00",
        stockQuantity,
        availableForSale: true,
        selectedOptions: [],
      },
    ],
  });
}

describe("orders convex functions", () => {
  it("creates order successfully and decreases product inventory", async () => {
    const t = makeTest();
    const productId = await seedProduct(t, 10);

    const orderId = await t.mutation(api.orders.createOrder, {
      customerName: "Ahmet Yılmaz",
      customerEmail: "ahmet@example.com",
      customerPhone: "05551234567",
      provinceId: "34", // İstanbul
      districtId: "1421", // Kadıköy
      items: [
        {
          productId,
          variantId: "v-kupe-1",
          quantity: 2,
          price: "250.00",
          title: "Test Küpe",
        },
      ],
      total: "500.00",
    });

    expect(orderId).toBeDefined();

    // Sipariş kontrolü
    const order = await t.query(api.orders.getOrderById, { id: orderId });
    expect(order?.status).toBe("pending");
    expect(order?.total).toBe("500.00");
    expect(order?.customerEmail).toBe("ahmet@example.com");

    // Stok düşüşü kontrolü (10 - 2 = 8)
    const product = await t.run(async (ctx) => await ctx.db.get(productId));
    expect(product?.variants?.[0]?.stockQuantity).toBe(8);
  });


  it("fails to create order when requested quantity exceeds available stock", async () => {
    const t = makeTest();
    const productId = await seedProduct(t, 2);

    await expect(
      t.mutation(api.orders.createOrder, {
        customerName: "Mehmet Demir",
        customerEmail: "mehmet@example.com",
        provinceId: "34",
        districtId: "1421",
        items: [
          {
            productId,
            variantId: "v-kupe-1",
            quantity: 5,
            price: "250.00",
            title: "Test Küpe",
          },
        ],
        total: "1250.00",
      })
    ).rejects.toThrow("Ürün seçeneği tükendi veya yetersiz stok");
  });

  it("updates order status through valid state transitions and restores stock on cancel", async () => {
    const t = makeTest();
    const productId = await seedProduct(t, 10);

    const orderId = await t.mutation(api.orders.createOrder, {
      customerName: "Ayşe Kaya",
      customerEmail: "ayse@example.com",
      provinceId: "6", // Ankara
      districtId: "1231", // Çankaya
      items: [
        {
          productId,
          variantId: "v-kupe-1",
          quantity: 3,
          price: "250.00",
          title: "Test Küpe",
        },
      ],
      total: "750.00",
    });

    // pending -> paid
    await t.mutation(api.orders.updateStatus, {
      adminSecret: secret,
      id: orderId,
      status: "paid",
    });

    let order = await t.query(api.orders.getOrderById, { id: orderId });
    expect(order?.status).toBe("paid");

    // paid -> shipped
    await t.mutation(api.orders.updateStatus, {
      adminSecret: secret,
      id: orderId,
      status: "shipped",
      carrier: "Yurtiçi Kargo",
      trackingNumber: "TR123456789",
    });

    order = await t.query(api.orders.getOrderById, { id: orderId });
    expect(order?.status).toBe("shipped");
    expect(order?.carrier).toBe("Yurtiçi Kargo");
    expect(order?.trackingNumber).toBe("TR123456789");

    // shipped -> cancelled (stok iadesi)
    await t.mutation(api.orders.updateStatus, {
      adminSecret: secret,
      id: orderId,
      status: "cancelled",
    });

    order = await t.query(api.orders.getOrderById, { id: orderId });
    expect(order?.status).toBe("cancelled");

    // İptal sonrası stok geri 10 olmalıdır
    const product = await t.run(async (ctx) => await ctx.db.get(productId));
    expect(product?.variants?.[0]?.stockQuantity).toBe(10);
  });


  it("rejects invalid status transitions", async () => {
    const t = makeTest();
    const productId = await seedProduct(t, 5);

    const orderId = await t.mutation(api.orders.createOrder, {
      customerName: "Canan Öz",
      customerEmail: "canan@example.com",
      provinceId: "35", // İzmir
      districtId: "1819", // Konak
      items: [
        {
          productId,
          variantId: "v-kupe-1",
          quantity: 1,
          price: "250.00",
          title: "Test Küpe",
        },
      ],
      total: "250.00",
    });

    // pending'den doğrudan delivered durumuna geçiş yasaktır
    await expect(
      t.mutation(api.orders.updateStatus, {
        adminSecret: secret,
        id: orderId,
        status: "delivered",
      })
    ).rejects.toThrow("Sipariş bu durumdan seçilen duruma geçirilemiyor");
  });
});
