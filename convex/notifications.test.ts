/// <reference types="vite/client" />
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { RateLimiter } from "@convex-dev/rate-limiter";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import { EMAIL_TEMPLATES, type EmailPreviewStore } from "./emails/registry";
import type { OrderEmailEvent } from "./emails/events";
import { renderOrderEmail, sampleOrderPayload } from "./emails/templates/order";

const modules = import.meta.glob("./**/*.ts");
const secret = "test-admin-secret-notifications";

const previewStore: EmailPreviewStore = {
  storeName: "Test Mağazası",
  storeEmail: "destek@testmagaza.com",
  storePhone: "05550000000",
  lowStockThreshold: 5,
  bankAccounts: [
    { bankName: "Test Bankası", accountHolder: "Test Mağazası", iban: "TR120000000000000000000001" },
  ],
  bankTransferInstructions: "Havale açıklamasına sipariş numaranızı yazınız.",
};

beforeEach(() => {
  vi.stubEnv("ADMIN_API_SECRET", secret);
  vi.stubEnv("SITE_URL", "https://testmagaza.com");
  vi.spyOn(RateLimiter.prototype, "limit").mockResolvedValue({ ok: true } as unknown as Awaited<ReturnType<RateLimiter["limit"]>>);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("e-posta şablon kataloğu", () => {
  it("her şablon mağazanın kendi kimliğiyle konu, HTML ve düz metin üretir", () => {
    for (const template of EMAIL_TEMPLATES) {
      const content = template.preview(previewStore);
      expect(content.subject, template.key).toBeTruthy();
      expect(content.html, template.key).toContain(previewStore.storeName);
      expect(content.text, template.key).toContain("TEST MAĞAZASI");
      expect(content.html, template.key).not.toContain("Mağazamız");
      expect(content.html, template.key).not.toContain("ornek-magaza");
      expect(content.html, template.key).not.toContain("/admin/");
      for (const value of [content.subject, content.html, content.text]) {
        expect(value, template.key).not.toContain("undefined");
        expect(value, template.key).not.toContain("[object Object]");
      }
    }
  });

  it("her sipariş olayının kendi şablonu var", () => {
    const events: Record<OrderEmailEvent, true> = {
      order_placed: true,
      payment_confirmed: true,
      order_shipped: true,
      order_delivered: true,
      order_cancelled: true,
      admin_order_alert: true,
    };
    const keys = EMAIL_TEMPLATES.map((template) => template.key);
    for (const event of Object.keys(events)) {
      expect(keys, event).toContain(event);
    }
  });
});

describe("sipariş e-postası kopyası", () => {
  it("sipariş alındı e-postası ödemenin onaylandığını iddia etmez", () => {
    const email = renderOrderEmail(sampleOrderPayload("order_placed", previewStore));

    expect(email.subject).toContain("Havale/EFT Bekleniyor");
    expect(email.html).toContain("Ödeme Bekleniyor");
    expect(email.html).not.toContain("Ödeme Onaylandı");
    expect(email.text).not.toContain("ödemeniz onaylandı");
    expect(email.text).toContain("IBAN: TR120000000000000000000001");
  });

  it("ödeme onay e-postası ödemenin alındığını bildirir", () => {
    const email = renderOrderEmail(sampleOrderPayload("payment_confirmed", previewStore));

    expect(email.subject).toContain("Ödemeniz Onaylandı");
    expect(email.html).toContain("Ödeme Onaylandı");
    expect(email.html).not.toContain("Ödeme Bekleniyor");
  });

  it("takip bilgisi yalnızca kargo e-postasında görünür", () => {
    expect(renderOrderEmail(sampleOrderPayload("order_shipped", previewStore)).html).toContain(
      "Kargo Takip Bilgileri"
    );
    expect(renderOrderEmail(sampleOrderPayload("payment_confirmed", previewStore)).html).not.toContain(
      "Kargo Takip Bilgileri"
    );
  });

  it("stok uyarısı yöneticiyi gizli admin kök yoluna götürür", () => {
    const template = EMAIL_TEMPLATES.find((item) => item.key === "low_stock_alert");
    expect(template?.preview(previewStore).html).toContain("https://testmagaza.com/yonetim23/inventory");
  });
});

describe("notifications gönderim kayıtları", () => {
  // Siparişi doğrudan tabloya yazarız: createOrder'ın zamanladığı e-posta
  // aksiyonları testin kendi beginSend çağrılarıyla yarışmasın.
  async function setupOrder(t: ReturnType<typeof convexTest>): Promise<Id<"orders">> {
    return await t.run(async (ctx) =>
      ctx.db.insert("orders", {
        customerEmail: "ali@test.com",
        customerName: "Ali Veli",
        items: [
          {
            productId: "product-1",
            variantId: "v-1",
            title: "Test Tişört",
            quantity: 1,
            price: "100.00",
            sku: "SKU-TISORT-1",
          },
        ],
        total: "100.00",
        status: "pending",
        paymentMethod: "bank_transfer",
        paymentMethodTitle: "Havale / EFT",
        shippingAddress: "Atatürk Mah. No: 12 / İstanbul",
      })
    );
  }

  async function eventsOf(t: ReturnType<typeof convexTest>, orderId: Id<"orders">) {
    return await t.query(api.notifications.listForOrdersAdmin, {
      adminSecret: secret,
      orderIds: [orderId],
    });
  }

  it("aynı olayı iki kez göndermez, farklı olay ayrı kayıtla gönderilir", async () => {
    const t = convexTest(schema, modules);
    const orderId = await setupOrder(t);

    const placedId = await t.mutation(internal.notifications.beginSend, {
      orderId,
      event: "order_placed",
    });
    expect(placedId).not.toBeNull();

    // Kiralama sürerken aynı olay tekrar tetiklenirse reddedilir
    const dupe = await t.mutation(internal.notifications.beginSend, {
      orderId,
      event: "order_placed",
    });
    expect(dupe).toBeNull();

    await t.mutation(internal.notifications.recordSendResult, {
      eventId: placedId!,
      status: "sent",
    });

    // Gönderilmiş olay tekrar izin vermez
    const afterSent = await t.mutation(internal.notifications.beginSend, {
      orderId,
      event: "order_placed",
    });
    expect(afterSent).toBeNull();

    // Ödeme onayı ayrı bir kayıtla gönderilir
    const paidId = await t.mutation(internal.notifications.beginSend, {
      orderId,
      event: "payment_confirmed",
    });
    expect(paidId).not.toBeNull();
    expect(paidId).not.toBe(placedId);

    const records = await eventsOf(t, orderId);
    expect(records.map((record) => record.event).sort()).toEqual([
      "order_placed",
      "payment_confirmed",
    ]);
    expect(records.find((record) => record.status === "sent")?.event).toBe("order_placed");
  });

  it("kiralaması dolmuş gönderimi belirsiz sayıp yeniden denemeye kapatır", async () => {
    const t = convexTest(schema, modules);
    const orderId = await setupOrder(t);

    const eventId = await t.mutation(internal.notifications.beginSend, {
      orderId,
      event: "order_placed",
    });
    expect(eventId).not.toBeNull();

    const expired = Date.now() + 61_000;
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(expired);
    const claimed = await t.mutation(internal.notifications.beginSend, {
      orderId,
      event: "order_placed",
    });
    nowSpy.mockRestore();

    expect(claimed).toBeNull();
    const [record] = await eventsOf(t, orderId);
    expect(record.status).toBe("review");

    await expect(
      t.mutation(api.notifications.retry, {
        adminSecret: secret,
        orderId,
        event: "order_placed",
      })
    ).rejects.toThrow("belirsiz");
  });

  it("başarısız gönderim aynı kaydı yeniden kullanır", async () => {
    const t = convexTest(schema, modules);
    const orderId = await setupOrder(t);

    const eventId = await t.mutation(internal.notifications.beginSend, {
      orderId,
      event: "order_placed",
    });
    await t.mutation(internal.notifications.recordSendResult, {
      eventId: eventId!,
      status: "failed",
      error: "Resend timeout",
    });

    const retriedId = await t.mutation(internal.notifications.beginSend, {
      orderId,
      event: "order_placed",
    });
    expect(retriedId).toBe(eventId);
    const [record] = await eventsOf(t, orderId);
    expect(record.status).toBe("processing");
    expect(record.error).toBeUndefined();
  });

  it("sipariş durumu uygun olmayan olay için içerik üretmez ve yeniden denemeyi reddeder", async () => {
    const t = convexTest(schema, modules);
    const orderId = await setupOrder(t);

    await expect(
      t.query(internal.notifications.getOrderEmailPayload, { orderId, event: "order_delivered" })
    ).resolves.toBeNull();

    const eventId = await t.mutation(internal.notifications.beginSend, {
      orderId,
      event: "order_placed",
    });
    await t.mutation(internal.notifications.recordSendResult, {
      eventId: eventId!,
      status: "failed",
    });

    // Bekleyen siparişte yönetici yeniden deneyebilir
    await expect(
      t.mutation(api.notifications.retry, { adminSecret: secret, orderId, event: "order_placed" })
    ).resolves.toBeNull();

    await t.mutation(api.orders.updateStatus, {
      adminSecret: secret,
      id: orderId,
      status: "cancelled",
    });

    // İptal edilen siparişin sipariş alındı e-postası yeniden denenemez
    await expect(
      t.mutation(api.notifications.retry, { adminSecret: secret, orderId, event: "order_placed" })
    ).rejects.toThrow("uygun değil");

    // Ancak iptal bildirimi gönderilebilir
    await expect(
      t.mutation(api.notifications.retry, { adminSecret: secret, orderId, event: "order_cancelled" })
    ).resolves.toBeNull();
  });
});
