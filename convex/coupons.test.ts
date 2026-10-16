/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { RateLimiter } from "@convex-dev/rate-limiter";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");
const secret = "test-admin-secret-coupons";

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

async function seedShop(t: Test) {
  const productId = await t.mutation(api.products.create, {
    adminSecret: secret,
    title: "Test Kolye",
    slug: "test-kolye",
    availableForSale: true,
    variants: [
      {
        id: "v-1",
        title: "Standart",
        sku: "SKU-KOLYE-1",
        price: "100.00",
        stockQuantity: 10,
        availableForSale: true,
        selectedOptions: [],
      },
    ],
    options: [],
    images: [],
  });

  const couponId = await t.mutation(api.coupons.create, {
    adminSecret: secret,
    code: "INDIRIM10",
    discountType: "percentage",
    discountValue: 10,
    usageLimit: 1,
    isActive: true,
  });

  return { productId, couponId };
}

function orderArgs(productId: string, total: string, customerEmail = "ali@test.com") {
  return {
    customerName: "Ali Veli",
    customerEmail,
    provinceId: "34",
    districtId: "1421",
    total,
    couponCode: "INDIRIM10",
    items: [{ productId, variantId: "v-1", title: "Test Kolye", quantity: 1, price: "100.00" }],
  };
}

async function usedCount(t: Test, couponId: string) {
  const coupons = await t.query(api.coupons.listAdmin, { adminSecret: secret });
  return coupons.find((coupon) => coupon._id === couponId)?.usedCount;
}

describe("kupon kullanım takibi", () => {
  it("kupon hakkını sipariş anında düşürür, iptalde geri verir", async () => {
    const t = makeTest();
    const { productId, couponId } = await seedShop(t);

    const orderId = await t.mutation(api.orders.createOrder, orderArgs(productId, "90.00"));

    const order = await t.query(api.orders.getOrderById, { id: orderId });
    expect(order?.couponCode).toBe("INDIRIM10");
    expect(order?.couponDiscountKurus).toBe(1000);
    expect(order?.couponReserved).toBe(true);
    expect(await usedCount(t, couponId)).toBe(1);

    await t.mutation(api.orders.updateStatus, { adminSecret: secret, id: orderId, status: "cancelled" });
    expect(await usedCount(t, couponId)).toBe(0);

    // Limit 1 olduğu için ikinci sipariş ancak iptal sonrası kurulabilir.
    const secondOrderId = await t.mutation(api.orders.createOrder, orderArgs(productId, "90.00", "fatma@test.com"));
    await t.mutation(api.orders.updateStatus, { adminSecret: secret, id: secondOrderId, status: "paid" });

    const paid = await t.query(api.orders.getOrderById, { id: secondOrderId });
    expect(paid?.couponRedeemed).toBe(true);
    expect(paid?.couponReserved).toBe(false);
  });

  it("limit dolduğunda yeni sipariş kuramaz", async () => {
    const t = makeTest();
    const { productId } = await seedShop(t);

    await t.mutation(api.orders.createOrder, orderArgs(productId, "90.00"));

    await expect(
      t.mutation(api.orders.createOrder, orderArgs(productId, "90.00", "mehmet@test.com"))
    ).rejects.toThrow("Kupon kullanım limitine ulaştı");
  });

  it("kapıda ödeme ücreti kupon rezervasyonunu bozmaz", async () => {
    const t = makeTest();
    await t.mutation(api.payments.updatePaymentSettings, {
      adminSecret: secret,
      cashOnDelivery: { enabled: true, fee: 20, description: "Kapıda ödeme" },
      bankTransfer: { enabled: false, description: "", accounts: [] },
      paytr: { enabled: false, testMode: true, description: "" },
    });
    const { productId, couponId } = await seedShop(t);

    // 100 TL sepet - 10 TL indirim + 20 TL kapıda ödeme ücreti
    await t.mutation(api.orders.createOrder, {
      ...orderArgs(productId, "110.00"),
      paymentMethod: "cash_on_delivery",
    });

    expect(await usedCount(t, couponId)).toBe(1);
  });
});
