import { parseAttributeTemplate } from "@/lib/catalog/attributes";
import { DEFAULT_LOW_STOCK_THRESHOLD } from "@/lib/catalog/low-stock";
import { getAdminBackend, adminErrorResponse } from "@/lib/admin/backend";
import { getAdminProductPage, getAdminProductStats } from "@/lib/catalog/pages";
import { revalidatePath, revalidateTag } from "next/cache";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { isRetryableOrderEvent, type OrderEmailEvent } from "@/convex/emails/events";
import { hasAdminSession, isSameOriginRequest } from "@/lib/admin/session";
import { isRecord, stringValue, parseProductInput, parseCategoryInput } from "@/lib/admin/input";
import { ORDER_STATUS_KEYS, ORDER_PAYMENT_STATUS_KEYS, type OrderStatus, type OrderPaymentStatus } from "@/lib/orders";
import { readJsonLimited } from "@/lib/http/read-json-limited";
import { NextRequest, NextResponse } from "next/server";

function invalidateCatalog(tag: "products" | "categories") {
  revalidateTag(tag, { expire: 0 });
  revalidatePath("/sitemap.xml");
}

function errorResponse(error: unknown) {
  return adminErrorResponse(error);
}

export async function GET(request: NextRequest) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Yönetici oturumu gerekli." }, { status: 401 });
  }

  try {
    const resource = request.nextUrl.searchParams.get("resource");
    const { client, adminSecret } = getAdminBackend();

    if (resource === "categories") {
      const categories = await client.query(api.categories.listAdmin, { adminSecret });
      return NextResponse.json(categories, { headers: { "Cache-Control": "no-store" } });
    }
    if (resource === "category-attribute-presets") {
      const presets = await client.query(api.categoryAttributePresets.listAdmin, {
        adminSecret, search: request.nextUrl.searchParams.get("q") ?? "",
        paginationOpts: { numItems: 8, cursor: request.nextUrl.searchParams.get("cursor") || null, maximumRowsRead: 128, maximumBytesRead: 2 * 1024 * 1024 },
      });
      return NextResponse.json(presets, { headers: { "Cache-Control": "no-store" } });
    }
    if (resource === "settings") {
      const settings = await client.query(api.settings.getStoreSettings, {});
      return NextResponse.json(settings, { headers: { "Cache-Control": "no-store" } });
    }
    if (resource === "coupons") {
      const coupons = await client.query(api.coupons.listAdmin, { adminSecret });
      return NextResponse.json(coupons, { headers: { "Cache-Control": "no-store" } });
    }
    if (resource === "promotions") {
      const promotions = await client.query(api.promotions.listAdmin, { adminSecret });
      return NextResponse.json(promotions, { headers: { "Cache-Control": "no-store" } });
    }
    if (resource === "payments") {
      const payments = await client.query(api.payments.getPaymentSettingsAdmin, { adminSecret });
      return NextResponse.json(payments, { headers: { "Cache-Control": "no-store" } });
    }
    if (resource === "email-templates") {
      const templates = await client.query(api.adminEmails.listTemplatesAdmin, { adminSecret });
      return NextResponse.json(templates, { headers: { "Cache-Control": "no-store" } });
    }
    if (resource === "sent-emails") {
      const sent = await client.query(api.adminEmails.listSentEmailsAdmin, { adminSecret, limit: 100 });
      return NextResponse.json(sent, { headers: { "Cache-Control": "no-store" } });
    }
    if (resource === "product-questions") {
      const rawStatus = request.nextUrl.searchParams.get("status");
      const status = rawStatus === "pending" || rawStatus === "approved" || rawStatus === "rejected"
        ? rawStatus
        : "all";
      const questions = await client.query(api.productQuestions.listForAdmin, { adminSecret, status });
      return NextResponse.json(questions, { headers: { "Cache-Control": "no-store" } });
    }

    if (resource === "products") {
      const [products, favoriteCounts] = await Promise.all([
        getAdminProductPage(Object.fromEntries(request.nextUrl.searchParams)),
        client.query(api.favorites.listFavoriteCountsAdmin, { adminSecret }),
      ]);
      const counts = new Map(favoriteCounts.map((row) => [row.slug, row.count]));
      return NextResponse.json(
        {
          ...products,
          items: products.items.map((item) => ({ ...item, favoriteCount: counts.get(item.slug) ?? 0 })),
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (resource === "inventory") {
      if (request.nextUrl.searchParams.get("low") === "1") {
        const lowStock = await client.query(api.products.lowStockAdmin, { adminSecret });
        return NextResponse.json(
          {
            page: lowStock.page,
            isDone: true,
            continueCursor: "",
            threshold: lowStock.threshold,
            productCount: lowStock.productCount,
            variantCount: lowStock.variantCount,
            truncated: lowStock.truncated,
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      }
      const inventory = await client.query(api.products.listStockAdmin, {
        adminSecret,
        query: request.nextUrl.searchParams.get("q") ?? "",
        paginationOpts: {
          numItems: 24,
          cursor: request.nextUrl.searchParams.get("cursor") || null,
          maximumRowsRead: 256,
          maximumBytesRead: 2 * 1024 * 1024,
        },
      });
      return NextResponse.json(inventory, { headers: { "Cache-Control": "no-store" } });
    }
    if (resource === "product") {
      const id = request.nextUrl.searchParams.get("id");
      const product = id ? await client.query(api.products.getByIdAdmin, { adminSecret, id: id as Id<"products"> }) : null;
      return NextResponse.json({ product }, { headers: { "Cache-Control": "no-store" } });
    }
    if (resource === "abandoned-carts") {
      const carts = await client.query(api.abandonedCartRecovery.listAllAdmin, { adminSecret });
      return NextResponse.json(carts, { headers: { "Cache-Control": "no-store" } });
    }
    if (resource === "active-carts") {
      const carts = await client.query(api.activeCarts.listAdmin, { adminSecret, now: Date.now() });
      return NextResponse.json(carts, { headers: { "Cache-Control": "no-store" } });
    }
    if (resource === "orders") {
      const orders = await client.query(api.orders.listAllAdmin, { adminSecret });
      const orderEmailEvents = await client.query(api.notifications.listForOrdersAdmin, {
        adminSecret,
        orderIds: orders.map((order) => order._id),
      });
      const emailsByOrder = new Map<string, typeof orderEmailEvents>();
      for (const event of orderEmailEvents) {
        emailsByOrder.set(event.orderId, [...(emailsByOrder.get(event.orderId) ?? []), event]);
      }
      const enrichedOrders = orders.map((order) => ({
        ...order,
        emailEvents: emailsByOrder.get(order._id) ?? [],
      }));
      return NextResponse.json(enrichedOrders, { headers: { "Cache-Control": "no-store" } });
    }
    if (resource === "customers") {
      const cursor = request.nextUrl.searchParams.get("cursor");
      const customers = await client.query(api.customers.listAdmin, {
        adminSecret,
        query: request.nextUrl.searchParams.get("q") ?? "",
        numItems: 20,
        ...(cursor ? { cursor } : {}),
      });
      return NextResponse.json(customers, { headers: { "Cache-Control": "no-store" } });
    }
    if (resource === "customer") {
      const userId = request.nextUrl.searchParams.get("userId");
      const target = await client.query(api.customers.getAdmin, {
        adminSecret,
        email: request.nextUrl.searchParams.get("email") ?? "",
        ...(userId ? { userId } : {}),
      });
      return NextResponse.json(target, { headers: { "Cache-Control": "no-store" } });
    }
    if (resource === "overview") {
      const [productStats, categories, orders, lowStock] = await Promise.all([
        getAdminProductStats(),
        client.query(api.categories.list, {}),
        client.query(api.orders.listAllAdmin, { adminSecret }),
        client.query(api.products.lowStockAdmin, { adminSecret }),
      ]);
      return NextResponse.json(
        {
          productStats,
          categories,
          orders,
          lowStock: {
            threshold: lowStock.threshold,
            productCount: lowStock.productCount,
            variantCount: lowStock.variantCount,
            truncated: lowStock.truncated,
            items: lowStock.page.slice(0, 5),
          },
        },
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
      case "promotion.create": {
        const title = stringValue(input.title, "Kampanya adı");
        const type = stringValue(input.type, "Kampanya türü");
        if (!["cart_percentage", "buy_x_get_y", "category_free_shipping"].includes(type)) {
          throw new Error("Kampanya türü geçersiz.");
        }
        const numberValue = (value: unknown) => {
          const parsed = Number(value);
          return Number.isFinite(parsed) ? parsed : undefined;
        };
        const categorySlug = typeof input.categorySlug === "string" && input.categorySlug.trim()
          ? input.categorySlug.trim()
          : undefined;
        const productId = typeof input.productId === "string" && input.productId.trim()
          ? input.productId.trim()
          : undefined;
        const percentage = numberValue(input.percentage);
        const buyQuantity = numberValue(input.buyQuantity);
        const payQuantity = numberValue(input.payQuantity);
        const minSubtotalKurus = numberValue(input.minSubtotalKurus);
        const result = await client.mutation(api.promotions.create, {
          adminSecret,
          title,
          type: type as "cart_percentage" | "buy_x_get_y" | "category_free_shipping",
          isActive: input.isActive !== false,
          ...(categorySlug ? { categorySlug } : {}),
          ...(productId ? { productId } : {}),
          ...(percentage !== undefined ? { percentage } : {}),
          ...(buyQuantity !== undefined ? { buyQuantity } : {}),
          ...(payQuantity !== undefined ? { payQuantity } : {}),
          ...(minSubtotalKurus !== undefined ? { minSubtotalKurus } : {}),
        });
        return NextResponse.json({ success: true, result });
      }
      case "promotion.disable": {
        const result = await client.mutation(api.promotions.disable, {
          adminSecret,
          id: stringValue(body.id, "Kampanya") as Id<"promotions">,
        });
        return NextResponse.json({ success: true, result });
      }
      case "cart.delete": {
        await client.mutation(api.abandonedCartRecovery.deleteAdmin, {
          adminSecret,
          id: stringValue(body.id, "Sepet") as Id<"abandonedCarts">,
        });
        return NextResponse.json({ success: true });
      }
      case "product-question.answer": {
        await client.mutation(api.productQuestions.answer, {
          adminSecret,
          id: stringValue(body.id, "Soru") as Id<"productQuestions">,
          answer: stringValue(input.answer, "Yanıt"),
        });
        return NextResponse.json({ success: true });
      }
      case "product-question.status": {
        const status = input.status;
        if (status !== "pending" && status !== "approved" && status !== "rejected") {
          throw new Error("Soru durumu geçersiz.");
        }
        await client.mutation(api.productQuestions.updateStatus, {
          adminSecret,
          id: stringValue(body.id, "Soru") as Id<"productQuestions">,
          status,
        });
        return NextResponse.json({ success: true });
      }
      case "product-question.delete": {
        await client.mutation(api.productQuestions.remove, {
          adminSecret,
          id: stringValue(body.id, "Soru") as Id<"productQuestions">,
        });
        return NextResponse.json({ success: true });
      }
      case "settings.update": {
        const text = (value: unknown) =>
          typeof value === "string" ? value : "";
        const lowStockThreshold = Number(input.lowStockThreshold);
        const newBadgeDays = Number(input.newBadgeDays);
        const freeShippingThreshold = Number(input.freeShippingThreshold);
        const shippingFee = Number(input.shippingFee);
        const parsedShippingCutoffHour = Number(input.shippingCutoffHour);
        const shippingCutoffHour = Math.min(
          23,
          Math.max(0, Math.trunc(Number.isFinite(parsedShippingCutoffHour) ? parsedShippingCutoffHour : 0)),
        );
        const shippingEstimate = text(input.shippingEstimate);
        const result = await client.mutation(api.settings.updateStoreSettings, {
          adminSecret,
          phone: text(input.phone),
          email: text(input.email),
          announcement: text(input.announcement),
          lowStockThreshold: Number.isSafeInteger(lowStockThreshold) ? lowStockThreshold : DEFAULT_LOW_STOCK_THRESHOLD,
          ...(Number.isSafeInteger(newBadgeDays) ? { newBadgeDays } : {}),
          freeShippingThreshold: Number.isFinite(freeShippingThreshold) ? freeShippingThreshold : 0,
          shippingFee: Number.isFinite(shippingFee) ? shippingFee : 0,
          shippingCutoffHour,
          shippingEstimate,
        });
        revalidateTag("store-settings", { expire: 0 });
        return NextResponse.json({ success: true, ...result });
      }
      case "payments.update": {
        const cashOnDelivery = isRecord(input.cashOnDelivery) ? input.cashOnDelivery : {};
        const bankTransfer = isRecord(input.bankTransfer) ? input.bankTransfer : {};
        const paytr = isRecord(input.paytr) ? input.paytr : {};

        const accounts = Array.isArray(bankTransfer.accounts)
          ? bankTransfer.accounts.filter(isRecord).map((acc) => ({
              id: typeof acc.id === "string" ? acc.id : "",
              bankName: typeof acc.bankName === "string" ? acc.bankName : "",
              accountHolder: typeof acc.accountHolder === "string" ? acc.accountHolder : "",
              iban: typeof acc.iban === "string" ? acc.iban : "",
            }))
          : [];

        const result = await client.mutation(api.payments.updatePaymentSettings, {
          adminSecret,
          cashOnDelivery: {
            enabled: cashOnDelivery.enabled === true,
            fee: typeof cashOnDelivery.fee === "number" ? Math.max(0, cashOnDelivery.fee) : 0,
            description: typeof cashOnDelivery.description === "string" ? cashOnDelivery.description : "",
          },
          bankTransfer: {
            enabled: bankTransfer.enabled === true,
            description: typeof bankTransfer.description === "string" ? bankTransfer.description : "",
            accounts,
          },
          paytr: {
            enabled: paytr.enabled === true,
            testMode: paytr.testMode === true,
            merchantId: typeof paytr.merchantId === "string" ? paytr.merchantId : "",
            merchantKey: typeof paytr.merchantKey === "string" ? paytr.merchantKey : "",
            merchantSalt: typeof paytr.merchantSalt === "string" ? paytr.merchantSalt : "",
            description: typeof paytr.description === "string" ? paytr.description : "",
          },
        });
        return NextResponse.json({ success: true, ...result });
      }
      case "product.image-upload-url": {
        const uploadUrl = await client.mutation(api.products.generateImageUploadUrl, {
          adminSecret,
        });
        return NextResponse.json({ uploadUrl });
      }
      case "product.image-upload-urls": {
        const uploadUrls = await client.mutation(api.products.generateImageUploadUrls, {
          adminSecret, count: Number(input.count),
        });
        return NextResponse.json({ uploadUrls });
      }
      case "product.image-discard": {
        const storageId = stringValue(input.storageId, "Görsel kimliği") as Id<"_storage">;
        await client.mutation(api.products.discardImageUpload, { adminSecret, storageId });
        return NextResponse.json({ success: true });
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
      case "category-attribute-preset.create":
      case "category-attribute-preset.update": {
        const template = parseAttributeTemplate(input);
        const result = body.action === "category-attribute-preset.update"
          ? await client.mutation(api.categoryAttributePresets.update, {
            adminSecret, id: stringValue(input.id, "Özellik") as Id<"categoryAttributePresets">, ...template,
          })
          : await client.mutation(api.categoryAttributePresets.create, { adminSecret, ...template });
        return NextResponse.json({ success: true, result });
      }
      case "category-attribute-preset.delete": {
        const result = await client.mutation(api.categoryAttributePresets.remove, {
          adminSecret,
          id: stringValue(input.id, "Özellik") as Id<"categoryAttributePresets">,
        });
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
        if (status !== undefined && !ORDER_STATUS_KEYS.includes(status as OrderStatus)) {
          throw new Error("Sipariş lojistik durumu geçersiz.");
        }
        const paymentStatus = input.paymentStatus;
        if (paymentStatus !== undefined && !ORDER_PAYMENT_STATUS_KEYS.includes(paymentStatus as OrderPaymentStatus)) {
          throw new Error("Sipariş ödeme durumu geçersiz.");
        }
        if (!status && !paymentStatus && !input.carrier && !input.trackingNumber && !input.trackingUrl) {
          throw new Error("Güncellenecek bir durum veya kargo bilgisi belirtilmedi.");
        }
        const carrier = typeof input.carrier === "string" ? input.carrier.trim() : undefined;
        const trackingNumber = typeof input.trackingNumber === "string" ? input.trackingNumber.trim() : undefined;
        const trackingUrl = typeof input.trackingUrl === "string" ? input.trackingUrl.trim() : undefined;

        const result = await client.mutation(api.orders.updateStatus, {
          adminSecret,
          id: stringValue(input.id, "Sipariş") as Id<"orders">,
          ...(status ? { status: status as OrderStatus } : {}),
          ...(paymentStatus ? { paymentStatus: paymentStatus as OrderPaymentStatus } : {}),
          ...(carrier ? { carrier } : {}),
          ...(trackingNumber ? { trackingNumber } : {}),
          ...(trackingUrl ? { trackingUrl } : {}),
        });
        if (status || paymentStatus) invalidateCatalog("products");
        return NextResponse.json({ success: true, result });
      }

      case "email.retry": {
        const event = stringValue(input.event, "E-posta türü") as OrderEmailEvent;
        if (!isRetryableOrderEvent(event)) throw new Error("E-posta türü geçersiz.");
        const result = await client.mutation(api.notifications.retry, {
          adminSecret,
          orderId: stringValue(input.orderId, "Sipariş") as Id<"orders">,
          event,
        });
        return NextResponse.json({ success: true, result });
      }

      case "system.reset-all": {
        await client.mutation(api.settings.resetAllData, { adminSecret });
        invalidateCatalog("products");
        invalidateCatalog("categories");
        revalidateTag("store-settings", { expire: 0 });
        revalidatePath("/", "layout");
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: "Desteklenmeyen işlem." }, { status: 400 });
    }
  } catch (error) {
    return errorResponse(error);
  }
}
