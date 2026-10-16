/// <reference types="vite/client" />
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { RateLimiter } from "@convex-dev/rate-limiter";
import schema from "./schema";
import { api, internal } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");
const secret = "test-admin-secret-payments";

const merchantSettings = {
  cashOnDelivery: { enabled: true, fee: 0, description: "Kapıda ödeme" },
  bankTransfer: {
    enabled: true,
    description: "Havale",
    accounts: [{ id: "bank-1", bankName: "Ziraat", accountHolder: "Mağaza A.Ş.", iban: "TR00" }],
  },
  paytr: {
    enabled: true,
    testMode: true,
    merchantId: "123456",
    merchantKey: "gizli-merchant-key",
    merchantSalt: "gizli-merchant-salt",
    description: "Kredi kartı ile ödeme",
  },
};

beforeEach(() => {
  vi.stubEnv("ADMIN_API_SECRET", secret);
  vi.spyOn(RateLimiter.prototype, "limit").mockResolvedValue({ ok: true } as unknown as Awaited<ReturnType<RateLimiter["limit"]>>);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("payment settings and order payment methods", () => {
  it("returns default payment settings when empty", async () => {
    const t = convexTest(schema, modules);
    const settings = await t.query(api.payments.getPaymentSettings, {});
    expect(settings.cashOnDelivery.enabled).toBe(true);
    expect(settings.bankTransfer.enabled).toBe(true);
    expect(settings.paytr.enabled).toBe(true);
    expect(settings.paytr.testMode).toBe(true);
    expect(settings.bankTransfer.accounts.length).toBeGreaterThan(0);
  });

  it("updates payment settings with admin secret and enforces validation", async () => {
    const t = convexTest(schema, modules);

    // Yanlış admin secret reddedilmeli
    await expect(
      t.mutation(api.payments.updatePaymentSettings, {
        adminSecret: "wrong-secret",
        cashOnDelivery: { enabled: false, fee: 25, description: "Kapıda ödeme kapalı" },
        bankTransfer: { enabled: true, description: "Havale yapın", accounts: [] },
        paytr: { enabled: true, testMode: true, description: "PayTR demo" },
      })
    ).rejects.toThrow("doğrulanamadı");

    // Geçerli güncelleme
    await t.mutation(api.payments.updatePaymentSettings, {
      adminSecret: secret,
      cashOnDelivery: { enabled: true, fee: 35.5, description: "Kapıda 35.5 TL ek ücret" },
      bankTransfer: {
        enabled: true,
        description: "Banka havalesi",
        accounts: [
          {
            id: "bank-1",
            bankName: "İş Bankası",
            accountHolder: "Test Ltd",
            iban: "TR11 0006 4000 0000 0000 0000 01",
          },
        ],
      },
      paytr: {
        enabled: false,
        testMode: true,
        merchantId: "12345",
        merchantKey: "key123",
        merchantSalt: "salt123",
        description: "PayTR kapalı",
      },
    });

    const updated = await t.query(api.payments.getPaymentSettings, {});
    expect(updated.cashOnDelivery.fee).toBe(35.5);
    expect(updated.bankTransfer.accounts[0].bankName).toBe("İş Bankası");
    expect(updated.paytr.enabled).toBe(false);
  });

  it("keeps PayTR merchant credentials out of the storefront payment settings", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.payments.updatePaymentSettings, { adminSecret: secret, ...merchantSettings });

    const storefront = await t.query(api.payments.getPaymentSettings, {});

    expect(JSON.stringify(storefront)).not.toContain("gizli-merchant-key");
    expect(JSON.stringify(storefront)).not.toContain("gizli-merchant-salt");
    expect(storefront.paytr.enabled).toBe(true);
    expect(storefront.paytr.description).toBe("Kredi kartı ile ödeme");
  });

  it("exposes PayTR merchant credentials only through the admin payment settings query", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.payments.updatePaymentSettings, { adminSecret: secret, ...merchantSettings });

    const admin = await t.query(api.payments.getPaymentSettingsAdmin, { adminSecret: secret });
    expect(admin.paytr.merchantId).toBe("123456");
    expect(admin.paytr.merchantKey).toBe("gizli-merchant-key");
    expect(admin.paytr.merchantSalt).toBe("gizli-merchant-salt");

    await expect(t.query(api.payments.getPaymentSettingsAdmin, { adminSecret: "wrong-secret" })).rejects.toThrow(
      "doğrulanamadı",
    );
  });

  it("creates a paytr order without marking it paid", async () => {
    const t = convexTest(schema, modules);

    const productId = await t.mutation(api.products.create, {
      adminSecret: secret,
      title: "Test Tişört",
      slug: "test-tisort",
      availableForSale: true,
      variants: [
        {
          id: "v-1",
          title: "Standart",
          sku: "SKU-TISORT-1",
          price: "100.00",
          stockQuantity: 10,
          availableForSale: true,
          selectedOptions: [],
        },
      ],
      options: [],
      images: [],
    });

    const orderId = await t.mutation(api.orders.createOrder, {
      customerName: "Ali Veli",
      customerEmail: "ali@test.com",
      provinceId: "34",
      districtId: "1421",
      total: "100.00",
      paymentMethod: "paytr",
      items: [
        {
          productId,
          variantId: "v-1",
          title: "Test Tişört",
          quantity: 1,
          price: "100.00",
        },
      ],
    });

    const order = await t.query(api.orders.getOrderById, { id: orderId });
    expect(order).not.toBeNull();
    expect(order?.status).toBe("pending");
    expect(order?.paymentMethod).toBe("paytr");
    expect(order?.paidAt).toBeUndefined();
  });

  it("confirms a paytr order as awaiting payment", async () => {
    const t = convexTest(schema, modules);

    const productId = await t.mutation(api.products.create, {
      adminSecret: secret,
      title: "Test Tişört",
      slug: "test-tisort",
      availableForSale: true,
      variants: [
        {
          id: "v-1",
          title: "Standart",
          sku: "SKU-TISORT-1",
          price: "100.00",
          stockQuantity: 10,
          availableForSale: true,
          selectedOptions: [],
        },
      ],
      options: [],
      images: [],
    });

    const orderId = await t.mutation(api.orders.createOrder, {
      customerName: "Ali Veli",
      customerEmail: "ali@test.com",
      provinceId: "34",
      districtId: "1421",
      total: "100.00",
      paymentMethod: "paytr",
      items: [
        {
          productId,
          variantId: "v-1",
          title: "Test Tişört",
          quantity: 1,
          price: "100.00",
        },
      ],
    });

    const emailPayload = await t.query(internal.notifications.getOrderEmailPayload, {
      orderId,
      event: "payment_confirmation",
    });
    expect(emailPayload).not.toBeNull();
    expect(emailPayload?.orderStatus).toBe("pending");
    expect(emailPayload?.paymentMethod).toBe("paytr");
  });

  it("creates order with bank transfer and sets status to pending", async () => {
    const t = convexTest(schema, modules);

    const productId = await t.mutation(api.products.create, {
      adminSecret: secret,
      title: "Test Pantolon",
      slug: "test-pantolon",
      availableForSale: true,
      variants: [
        {
          id: "v-1",
          title: "Standart",
          sku: "SKU-PANTOLON-1",
          price: "200.00",
          stockQuantity: 10,
          availableForSale: true,
          selectedOptions: [],
        },
      ],
      options: [],
      images: [],
    });

    const orderId = await t.mutation(api.orders.createOrder, {
      customerName: "Fatma Yılmaz",
      customerEmail: "fatma@test.com",
      provinceId: "6",
      districtId: "1231",
      total: "200.00",
      paymentMethod: "bank_transfer",
      items: [
        {
          productId,
          variantId: "v-1",
          title: "Test Pantolon",
          quantity: 1,
          price: "200.00",
        },
      ],
    });

    const order = await t.query(api.orders.getOrderById, { id: orderId });
    expect(order).not.toBeNull();
    expect(order?.status).toBe("pending");
    expect(order?.paymentMethod).toBe("bank_transfer");
    expect(order?.paymentMethodTitle).toBe("Havale / EFT");

    // Havale / EFT için giden sipariş e-posta içeriği kontrolü
    const emailPayload = await t.query(internal.notifications.getOrderEmailPayload, {
      orderId,
      event: "payment_confirmation",
    });
    expect(emailPayload).not.toBeNull();
    expect(emailPayload?.bankAccounts).toBeDefined();
    expect(emailPayload?.bankAccounts?.length).toBeGreaterThan(0);
    expect(emailPayload?.bankAccounts?.[0].iban).toBeDefined();
    expect(emailPayload?.paymentMethodTitle).toBe("Havale / EFT");
  });

  it("applies cash on delivery fee when configured and rejects disabled method", async () => {
    const t = convexTest(schema, modules);

    // Kapıda ödeme ücretini 20 TL yap
    await t.mutation(api.payments.updatePaymentSettings, {
      adminSecret: secret,
      cashOnDelivery: { enabled: true, fee: 20, description: "20 TL kapıda ödeme" },
      bankTransfer: { enabled: true, description: "Havale", accounts: [{ id: "1", bankName: "Ziraat", accountHolder: "A", iban: "TR00" }] },
      paytr: { enabled: false, testMode: true, description: "PayTR kapalı" },
    });

    const productId = await t.mutation(api.products.create, {
      adminSecret: secret,
      title: "Test Çanta",
      slug: "test-canta",
      availableForSale: true,
      variants: [
        {
          id: "v-1",
          title: "Standart",
          sku: "SKU-CANTA-1",
          price: "150.00",
          stockQuantity: 10,
          availableForSale: true,
          selectedOptions: [],
        },
      ],
      options: [],
      images: [],
    });

    // 150 + 20 = 170 TL olmalı
    const orderId = await t.mutation(api.orders.createOrder, {
      customerName: "Mehmet Demir",
      customerEmail: "mehmet@test.com",
      provinceId: "35",
      districtId: "1819",
      total: "170.00",
      paymentMethod: "cash_on_delivery",
      items: [
        {
          productId,
          variantId: "v-1",
          title: "Test Çanta",
          quantity: 1,
          price: "150.00",
        },
      ],
    });

    const order = await t.query(api.orders.getOrderById, { id: orderId });
    expect(order).not.toBeNull();
    expect(order?.total).toBe("170.00");
    expect(order?.paymentMethod).toBe("cash_on_delivery");
    expect(order?.paymentFee).toBe(20);
    expect(order?.status).toBe("pending");

    // PayTR kapalıyken sipariş verilmek istenirse reddedilmeli
    await expect(
      t.mutation(api.orders.createOrder, {
        customerName: "Mehmet Demir",
        customerEmail: "mehmet@test.com",
        provinceId: "35",
        districtId: "1819",
        total: "150.00",
        paymentMethod: "paytr",
        items: [
          {
            productId,
            variantId: "v-1",
            title: "Test Çanta",
            quantity: 1,
            price: "150.00",
          },
        ],
      })
    ).rejects.toThrow("aktif değildir");
  });
});
