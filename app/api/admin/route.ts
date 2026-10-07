import { getAdminBackend } from "@/lib/admin/backend";
import { revalidatePath, revalidateTag } from "next/cache";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { hasAdminSession, isSameOriginRequest } from "@/lib/admin/session";
import { isRecord, stringValue, parseProductInput, parseCategoryInput } from "@/lib/admin/input";
import { readJsonLimited } from "@/lib/http/read-json-limited";
import { NextRequest, NextResponse } from "next/server";

function invalidateCatalog(tag: "products" | "categories") {
  revalidateTag(tag, { expire: 0 });
  revalidatePath("/sitemap.xml");
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "İşlem tamamlanamadı.";
  const unavailable =
    message.includes("ADMIN_API_SECRET") ||
    message.includes("NEXT_PUBLIC_CONVEX_URL") ||
    message.includes("Yönetici işlemi doğrulanamadı");
  const status = unavailable ? 503 : 400;
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Yönetici oturumu gerekli." }, { status: 401 });
  }

  try {
    const resource = request.nextUrl.searchParams.get("resource");
    const { client, adminSecret } = getAdminBackend();

    if (resource === "categories") {
      const categories = await client.mutation(api.categories.listAdmin, { adminSecret });
      return NextResponse.json(categories, { headers: { "Cache-Control": "no-store" } });
    }
    if (resource === "settings") {
      const settings = await client.query(api.settings.getStoreSettings, {});
      return NextResponse.json(settings, { headers: { "Cache-Control": "no-store" } });
    }
    if (resource === "coupons") {
      const coupons = await client.query(api.coupons.listAdmin, { adminSecret });
      return NextResponse.json(coupons, { headers: { "Cache-Control": "no-store" } });
    }

    if (resource === "products") {
      const products = await client.query(api.products.listAllAdmin, { adminSecret });
      return NextResponse.json(products, { headers: { "Cache-Control": "no-store" } });
    }
    if (resource === "orders") {
      const orders = await client.query(api.orders.listAllAdmin, { adminSecret });
      const [invoices, paymentRisks, shippingShipments, orderEmailEvents] = await Promise.all([
        client.query(api.invoices.listAllAdmin, { adminSecret }),
        client.query(api.checkoutPayments.listRiskForOrders, {
          adminSecret,
          orderIds: orders.map((order) => order._id),
        }),
        client.query(api.shipping.listAllAdmin, { adminSecret }),
        client.query(api.notifications.listForOrdersAdmin, {
          adminSecret,
          orderIds: orders.map((order) => order._id),
        }),
      ]);
      const invoiceByOrder = new Map(invoices.map((invoice) => [invoice.orderId, invoice]));
      const riskByOrder = new Map(paymentRisks.map((risk) => [risk.orderId, risk]));
      const emailsByOrder = new Map<string, typeof orderEmailEvents>();
      for (const event of orderEmailEvents) {
        emailsByOrder.set(event.orderId, [...(emailsByOrder.get(event.orderId) ?? []), event]);
      }
      const shippingByOrder = new Map<string, (typeof shippingShipments)[number]>();
      for (const shipment of shippingShipments) {
        if (!shippingByOrder.has(shipment.orderId)) shippingByOrder.set(shipment.orderId, shipment);
      }
      const enrichedOrders = orders.map((order) => ({
        ...order,
        invoice: invoiceByOrder.get(order._id) ?? null,
        paymentRisk: riskByOrder.get(order._id) ?? null,
        shippingShipment: shippingByOrder.get(order._id) ?? null,
        emailEvents: emailsByOrder.get(order._id) ?? [],
      }));
      return NextResponse.json(enrichedOrders, { headers: { "Cache-Control": "no-store" } });
    }
    if (resource === "overview") {
      const [products, categories, orders] = await Promise.all([
        client.query(api.products.listAllAdmin, { adminSecret }),
        client.query(api.categories.list, {}),
        client.query(api.orders.listAllAdmin, { adminSecret }),
      ]);
      return NextResponse.json(
        { products, categories, orders },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (resource === "analytics") {
      const rawDays = request.nextUrl.searchParams.get("days") ?? "30";
      const days = rawDays === "7" ? 7 : rawDays === "90" ? 90 : rawDays === "30" ? 30 : null;
      if (!days) return NextResponse.json({ error: "Analitik dönemi geçersiz." }, { status: 400 });
      const dashboard = await client.query(api.analytics.getDashboard, { adminSecret, days, now: Date.now() });
      return NextResponse.json(dashboard, { headers: { "Cache-Control": "no-store" } });
    }

    return NextResponse.json({ error: "Bilinmeyen yönetim alanı." }, { status: 404 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "İstek reddedildi." }, { status: 403 });
  }
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Yönetici oturumu gerekli." }, { status: 401 });
  }

  try {
    const parsedBody = await readJsonLimited(request, 256 * 1024);
    if (!parsedBody.ok) {
      return NextResponse.json(
        { error: parsedBody.reason === "too_large" ? "İstek çok büyük." : "İstek gövdesi geçersiz." },
        { status: parsedBody.reason === "too_large" ? 413 : 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    const body = parsedBody.value;
    if (!isRecord(body) || typeof body.action !== "string") {
      return NextResponse.json({ error: "İşlem bilgisi geçersiz." }, { status: 400 });
    }

    const { client, adminSecret } = getAdminBackend();
    const input = isRecord(body.input) ? body.input : {};

    const parseCouponInput = () => {
      const code = stringValue(input.code, "Kupon kodu");
      const rawDiscountType = input.discountType;
      if (rawDiscountType !== "percentage" && rawDiscountType !== "fixed") throw new Error("İndirim türü geçersiz.");
      const discountType: "percentage" | "fixed" = rawDiscountType;
      const discountValue = input.discountValue;
      if (typeof discountValue !== "number" || !Number.isSafeInteger(discountValue)) {
        throw new Error("İndirim değeri geçersiz.");
      }
      const optionalInteger = (value: unknown, label: string) => {
        if (value === null || value === undefined || value === "") return null;
        if (typeof value !== "number" || !Number.isSafeInteger(value)) throw new Error(`${label} geçersiz.`);
        return value;
      };
      const expiresAt = optionalInteger(input.expiresAt, "Son kullanma tarihi");
      const isActive = input.isActive !== false;
      return {
        code,
        discountType,
        discountValue,
        minOrderAmountKurus: optionalInteger(input.minOrderAmountKurus, "Asgari sepet tutarı"),
        maxDiscountKurus: optionalInteger(input.maxDiscountKurus, "Maksimum indirim"),
        usageLimit: optionalInteger(input.usageLimit, "Kullanım limiti"),
        expiresAt,
        isActive,
      };
    };

    switch (body.action) {
      case "coupon.create": {
        const parsed = parseCouponInput();
        const result = await client.mutation(api.coupons.create, {
          adminSecret,
          code: parsed.code,
          discountType: parsed.discountType,
          discountValue: parsed.discountValue,
          isActive: parsed.isActive,
          ...(parsed.minOrderAmountKurus !== null ? { minOrderAmountKurus: parsed.minOrderAmountKurus } : {}),
          ...(parsed.maxDiscountKurus !== null ? { maxDiscountKurus: parsed.maxDiscountKurus } : {}),
          ...(parsed.usageLimit !== null ? { usageLimit: parsed.usageLimit } : {}),
          ...(parsed.expiresAt !== null ? { expiresAt: parsed.expiresAt } : {}),
        });
        return NextResponse.json({ success: true, result });
      }
      case "coupon.update": {
        const parsed = parseCouponInput();
        const result = await client.mutation(api.coupons.update, {
          adminSecret,
          id: stringValue(input.id, "Kupon") as Id<"coupons">,
          ...parsed,
        });
        return NextResponse.json({ success: true, result });
      }
      case "coupon.disable": {
        const result = await client.mutation(api.coupons.disable, {
          adminSecret,
          id: stringValue(body.id, "Kupon") as Id<"coupons">,
        });
        return NextResponse.json({ success: true, result });
      }
      case "settings.update": {
        const storeName = stringValue(input.storeName, "Mağaza adı");
        if (storeName.length < 2 || storeName.length > 80) {
          throw new Error("Mağaza adı 2 ile 80 karakter arasında olmalı.");
        }
        const text = (value: unknown) =>
          typeof value === "string" ? value : "";
        const logoStorageId = text(input.logoStorageId);
        const shippingCutoffMinutes = input.shippingCutoffMinutes;
        if (shippingCutoffMinutes !== null && typeof shippingCutoffMinutes !== "number") {
          throw new Error("Kargo kesim saati geçersiz.");
        }
        const shippingDays = input.shippingDays;
        if (!Array.isArray(shippingDays) || shippingDays.some((day) => typeof day !== "number")) {
          throw new Error("Kargo günleri geçersiz.");
        }
        const shippingFeeKurus = input.shippingFeeKurus;
        const freeShippingThresholdKurus = input.freeShippingThresholdKurus;
        if (typeof shippingFeeKurus !== "number" ||
          (freeShippingThresholdKurus !== null && typeof freeShippingThresholdKurus !== "number")) {
          throw new Error("Kargo ücretlerini kontrol edin.");
        }
        const result = await client.mutation(api.settings.updateStoreSettings, {
          adminSecret,
          storeName,
          slogan: text(input.slogan),
          logoStorageId: (logoStorageId || null) as Id<"_storage"> | null,
          phone: text(input.phone),
          email: text(input.email),
          address: text(input.address),
          announcement: text(input.announcement),
          shippingCutoffMinutes,
          shippingDays,
          shippingFeeKurus,
          freeShippingThresholdKurus,
          isOpen: input.isOpen !== false,
        });
        revalidateTag("store-settings", { expire: 0 });
        revalidatePath("/", "layout");
        revalidatePath("/opengraph-image");
        return NextResponse.json({ success: true, ...result });
      }
      case "product.image-upload-url": {
        const uploadUrl = await client.mutation(api.products.generateImageUploadUrl, {
          adminSecret,
        });
        return NextResponse.json({ uploadUrl });
      }
      case "product.image-url": {
        const storageId = stringValue(input.storageId, "Görsel kimliği") as Id<"_storage">;
        const url = await client.query(api.products.getImageUrl, { adminSecret, storageId });
        if (!url) throw new Error("Yüklenen görsel bulunamadı.");
        return NextResponse.json({ url });
      }
      case "product.create": {
        const result = await client.mutation(api.products.create, {
          adminSecret, ...parseProductInput(input),
        });
        invalidateCatalog("products");
        return NextResponse.json({ success: true, result });
      }
      case "product.update": {
        const result = await client.mutation(api.products.update, {
          adminSecret,
          id: stringValue(input.id, "Ürün") as Id<"products">,
          ...parseProductInput(input),
        });
        invalidateCatalog("products");
        return NextResponse.json({ success: true, result });
      }
      case "product.delete": {
        const result = await client.mutation(api.products.remove, {
          adminSecret,
          id: stringValue(body.id, "Ürün") as Id<"products">,
        });
        invalidateCatalog("products");
        return NextResponse.json({ success: true, result });
      }
      case "category.create": {
        const result = await client.mutation(api.categories.create, {
          adminSecret, ...parseCategoryInput(input),
        });
        invalidateCatalog("categories");
        return NextResponse.json({ success: true, result });
      }
      case "category.image-upload-url": {
        const uploadUrl = await client.mutation(api.categories.generateImageUploadUrl, { adminSecret });
        return NextResponse.json({ uploadUrl });
      }
      case "category.image-discard": {
        await client.mutation(api.categories.discardImageUpload, {
          adminSecret,
          storageId: stringValue(input.storageId, "Kategori görseli kimliği") as Id<"_storage">,
        });
        return NextResponse.json({ success: true });
      }
      case "category.update": {
        const result = await client.mutation(api.categories.update, {
          adminSecret,
          id: stringValue(input.id, "Kategori") as Id<"categories">,
          ...parseCategoryInput(input),
        });
        invalidateCatalog("categories");
        invalidateCatalog("products");
        return NextResponse.json({ success: true, result });
      }
      case "category.delete": {
        const result = await client.mutation(api.categories.remove, {
          adminSecret,
          id: stringValue(body.id, "Kategori") as Id<"categories">,
        });
        invalidateCatalog("categories");
        return NextResponse.json({ success: true, result });
      }
      case "order.status": {
        const status = input.status;
        if (
          status !== "pending" &&
          status !== "paid" &&
          status !== "shipped" &&
          status !== "delivered" &&
          status !== "cancelled"
        ) {
          throw new Error("Sipariş durumu geçersiz.");
        }
        const result = await client.mutation(api.orders.updateStatus, {
          adminSecret,
          id: stringValue(input.id, "Sipariş") as Id<"orders">,
          status,
        });
        return NextResponse.json({ success: true, result });
      }
      case "payment.approve-risk-review": {
        const result = await client.mutation(api.checkoutPayments.approveRiskHeldPayment, {
          adminSecret,
          orderId: stringValue(input.orderId, "Sipariş") as Id<"orders">,
        });
        return NextResponse.json({ success: true, result });
      }
      case "order.refund": {
        const rawItems = input.items;
        if (!Array.isArray(rawItems) || rawItems.length === 0 || rawItems.length > 100) {
          throw new Error("İade kalemlerini seçin.");
        }
        const items = rawItems.map((value) => {
          if (!isRecord(value) || typeof value.itemIndex !== "number" || typeof value.quantity !== "number") {
            throw new Error("İade kalemi geçersiz.");
          }
          return { itemIndex: value.itemIndex, quantity: value.quantity };
        });
        const idempotencyKey = stringValue(input.idempotencyKey, "İade istek kimliği");
        const result = await client.action(api.refunds.refundOrder, {
          adminSecret,
          orderId: stringValue(input.orderId, "Sipariş") as Id<"orders">,
          items,
          idempotencyKey,
        });
        return NextResponse.json(result);
      }
      case "shipping.create": {
        const result = await client.action(api.shipping.createForPaidOrderAdmin, {
          adminSecret,
          orderId: stringValue(input.orderId, "Sipariş") as Id<"orders">,
        });
        return NextResponse.json(result);
      }
      case "shipping.refresh-offers": {
        const result = await client.action(api.shipping.refreshOffersAdmin, {
          adminSecret,
          orderId: stringValue(input.orderId, "Sipariş") as Id<"orders">,
        });
        return NextResponse.json(result);
      }
      case "shipping.purchase-label": {
        const result = await client.action(api.shipping.purchaseLabelAdmin, {
          adminSecret,
          orderId: stringValue(input.orderId, "Sipariş") as Id<"orders">,
          offerId: stringValue(input.offerId, "Kargo teklifi"),
        });
        return NextResponse.json(result);
      }
      case "analytics.spend.upsert": {
        const month = stringValue(input.month, "Ay");
        const source = stringValue(input.source, "Kanal").trim();
        const campaign = typeof input.campaign === "string" ? input.campaign.trim() : "";
        const amount = input.amount;
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Ay bilgisi geçersiz.");
        if (source.length < 2 || source.length > 100 || campaign.length > 120) {
          throw new Error("Kanal veya kampanya bilgisi geçersiz.");
        }
        if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0 || amount > 100_000_000) {
          throw new Error("Harcama tutarı geçersiz.");
        }
        const result = await client.mutation(api.analytics.upsertMarketingSpend, {
          adminSecret,
          month,
          source,
          campaign,
          amountCents: Math.round(amount * 100),
        });
        return NextResponse.json({ success: true, result });
      }
      case "invoice.retry": {
        const result = await client.mutation(api.invoices.retry, {
          adminSecret,
          orderId: stringValue(input.orderId, "Sipariş") as Id<"orders">,
        });
        return NextResponse.json({ success: true, result });
      }
      case "email.retry": {
        const event = stringValue(input.event, "E-posta türü");
        if (event !== "payment_confirmation" && event !== "shipping_update") throw new Error("E-posta türü geçersiz.");
        const result = await client.mutation(api.notifications.retry, {
          adminSecret,
          orderId: stringValue(input.orderId, "Sipariş") as Id<"orders">,
          event,
        });
        return NextResponse.json({ success: true, result });
      }
      default:
        return NextResponse.json({ error: "Desteklenmeyen işlem." }, { status: 400 });
    }
  } catch (error) {
    return errorResponse(error);
  }
}
