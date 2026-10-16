/// <reference types="vite/client" />
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { RateLimiter } from "@convex-dev/rate-limiter";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import { buildEmail, type EmailPayload } from "./notifications";

const modules = import.meta.glob("./**/*.ts");
const secret = "test-admin-secret-notifications";

beforeEach(() => {
  vi.stubEnv("ADMIN_API_SECRET", secret);
  vi.spyOn(RateLimiter.prototype, "limit").mockResolvedValue({ ok: true } as unknown as Awaited<ReturnType<RateLimiter["limit"]>>);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function paymentConfirmation(overrides: Partial<EmailPayload>): EmailPayload {
  return {
    orderId: "<orderId>" as Id<"orders">,
    event: "payment_confirmation",
    customerEmail: "ali@test.com",
    customerName: "Ali Veli",
    customerPhone: null,
    shippingAddress: null,
    total: "100.00",
    couponCode: null,
    couponDiscountKurus: null,
    createdAt: 1_700_000_000_000,
    shippedAt: null,
    carrier: null,
    trackingNumber: null,
    trackingUrl: null,
    itemCount: 1,
    items: [{ title: "Test Tişört", quantity: 1, price: "100.00", image: null, sku: null }],
    storeName: "Demo Mağaza",
    storeEmail: null,
    storePhone: null,
    paymentMethod: "paytr",
    paymentMethodTitle: "PayTR (Demo)",
    paymentFee: null,
    orderStatus: "pending",
    bankAccounts: [],
    bankTransferInstructions: null,
    ...overrides,
  };
}

describe("payment confirmation e-postası kopyası", () => {
  it("beklemedeki PayTR siparişinde ödemenin alındığını iddia etmez", () => {
    const email = buildEmail(paymentConfirmation({ orderStatus: "pending" }));

    expect(email.subject).toContain("Ödeme Bekleniyor");
    expect(email.html).not.toContain("ödemeniz onaylandı");
    expect(email.html).not.toContain("Ödeme Onaylandı");
    expect(email.text).not.toContain("ödemeniz onaylandı");
  });

  it("ödendi işaretlenince ödeme onayını bildirir", () => {
    const email = buildEmail(paymentConfirmation({ orderStatus: "paid" }));

    expect(email.html).toContain("Ödeme Onaylandı");
    expect(email.html).not.toContain("Ödeme Bekleniyor");
  });
});

describe("notifications beginSend ve retry akışı", () => {
  async function setupOrder(t: ReturnType<typeof convexTest>) {
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
      paymentMethod: "bank_transfer",
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

    return { productId, orderId };
  }

  it("sipariş ödendiğinde önceki bekleme e-postasına takılmadan ödeme onay e-postasına izin verir", async () => {
    const t = convexTest(schema, modules);
    const { orderId } = await setupOrder(t);

    // 1. Sipariş oluşturulduğunda ilk gönderim (created/pending fazı)
    const eventId1 = await t.mutation(internal.notifications.beginSend, {
      orderId,
      event: "payment_confirmation",
    });
    expect(eventId1).not.toBeNull();

    const record1 = await t.query(internal.notifications.getEventById, { eventId: eventId1! });
    expect(record1?.idempotencyKey).toBe(`payment_confirmation/${orderId}/created`);

    // İlk e-posta başarıyla gönderildi
    await t.mutation(internal.notifications.recordSendResult, {
      eventId: eventId1!,
      status: "sent",
    });

    // Pending fazında aynı olay tekrar tetiklenirse mükerrer gönderilmemeli
    const dupeWhilePending = await t.mutation(internal.notifications.beginSend, {
      orderId,
      event: "payment_confirmation",
    });
    expect(dupeWhilePending).toBeNull();

    // 2. Yönetici siparişi ödendi işaretler
    await t.mutation(api.orders.updateStatus, {
      adminSecret: secret,
      id: orderId,
      status: "paid",
    });

    // 3. Ödeme onay e-postası için beginSend çağrılır
    const eventId2 = await t.mutation(internal.notifications.beginSend, {
      orderId,
      event: "payment_confirmation",
    });
    // Sessizce yutulmamalı, ödeme onay fazı için işlem izni vermeli
    expect(eventId2).not.toBeNull();
    expect(eventId2).toBe(eventId1);

    const record2 = await t.query(internal.notifications.getEventById, { eventId: eventId2! });
    expect(record2?.idempotencyKey).toBe(`payment_confirmation/${orderId}/paid`);
    expect(record2?.status).toBe("processing");

    // İkinci e-posta başarıyla gönderildi
    await t.mutation(internal.notifications.recordSendResult, {
      eventId: eventId2!,
      status: "sent",
    });

    // Paid fazında da tekrar mükerrer gönderilmemeli
    const dupeWhilePaid = await t.mutation(internal.notifications.beginSend, {
      orderId,
      event: "payment_confirmation",
    });
    expect(dupeWhilePaid).toBeNull();
  });

  it("beklemedeki siparişlerde yeniden dene çağrısına izin verir, iptal siparişlerde reddeder", async () => {
    const t = convexTest(schema, modules);
    const { orderId } = await setupOrder(t);

    const eventId = await t.mutation(internal.notifications.beginSend, {
      orderId,
      event: "payment_confirmation",
    });
    expect(eventId).not.toBeNull();

    // Gönderim başarısız oldu
    await t.mutation(internal.notifications.recordSendResult, {
      eventId: eventId!,
      status: "failed",
      error: "Resend timeout",
    });

    // Sipariş pending olmasına rağmen admin yeniden dene çağırabilmeli
    await expect(
      t.mutation(api.notifications.retry, {
        adminSecret: secret,
        orderId,
        event: "payment_confirmation",
      })
    ).resolves.toBeNull();

    // Sipariş iptal edilirse payment_confirmation yeniden denenememeli
    await t.mutation(api.orders.updateStatus, {
      adminSecret: secret,
      id: orderId,
      status: "cancelled",
    });

    await expect(
      t.mutation(api.notifications.retry, {
        adminSecret: secret,
        orderId,
        event: "payment_confirmation",
      })
    ).rejects.toThrow("uygun değil");
  });
});
