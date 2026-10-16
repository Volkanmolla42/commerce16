import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { getAdminBackend, adminErrorResponse } from "@/lib/admin/backend";
import { hasAdminSession } from "@/lib/admin/session";
import { toCsv } from "@/lib/admin/csv";
import { orderStatusLabels, getOrderCode } from "@/lib/orders";
import { kurusToLira } from "@/lib/format-money";
import { formatDate, formatDateTime } from "@/lib/format-date";
import { getProductPriceRange } from "@/lib/catalog/variants";
import { NextRequest, NextResponse } from "next/server";

type ExportOrder = Doc<"orders">;

type ExportProduct = {
  slug: string;
  title: string;
  categorySlug?: string;
  availableForSale: boolean;
  variants: Array<{
    id: string;
    title: string;
    price: string;
    stockQuantity: number;
  }>;
  updatedAt: string;
};

type ExportCustomer = {
  key: string;
  name: string;
  email: string;
  phone: string;
  registeredAt?: number;
  firstOrderAt?: number;
  lastOrderAt?: number;
  orderCount: number;
  totalSpent: string;
  addressCount: number;
};

function csvResponse(filename: string, body: string) {
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: NextRequest) {
  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite === "cross-site") {
    return NextResponse.json({ error: "Yetkisiz istek kaynağı." }, { status: 403 });
  }

  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Yönetici oturumu gerekli." }, { status: 401 });
  }

  const type = request.nextUrl.searchParams.get("type");

  try {
    const { client, adminSecret } = getAdminBackend();

    const rateLimit = await client.mutation(api.adminAuth.checkExportRateLimit, {
      adminSecret,
      key: "admin-csv-export",
    });
    if (!rateLimit.ok) {
      return NextResponse.json(
        { error: "Çok sık dışa aktarma isteği yapıldı. Lütfen birkaç dakika sonra tekrar deneyin." },
        { status: 429 },
      );
    }

    if (type === "orders") {
      const allOrders: Array<ExportOrder> = [];
      let cursor: string | null = null;
      do {
        const result: { page: ExportOrder[]; isDone: boolean; continueCursor: string } = await client.query(
          api.orders.listForExportAdmin,
          {
            adminSecret,
            cursor,
            limit: 250,
          },
        );
        allOrders.push(...result.page);
        cursor = result.isDone ? null : result.continueCursor;
      } while (cursor && allOrders.length < 10000);

      const rows = allOrders.map((order) => [
        getOrderCode(order, true),
        formatDateTime(order._creationTime, { dateStyle: "short", timeStyle: "short" }),
        orderStatusLabels[order.status as keyof typeof orderStatusLabels] ?? order.status,
        order.customerName,
        order.customerEmail,
        order.customerPhone ?? "",
        order.items.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0),
        order.total,
        order.couponCode ?? "",
        order.couponDiscountKurus ? kurusToLira(order.couponDiscountKurus) : "",
        order.shippingFee !== undefined && order.shippingFee !== null ? String(order.shippingFee) : "0",
        order.shippingAddress ?? "",
      ]);
      return csvResponse(
        "siparisler.csv",
        toCsv(
          ["Sipariş No", "Tarih", "Durum", "Müşteri", "E-posta", "Telefon", "Ürün adedi", "Tutar (TL)", "Kupon", "İndirim (TL)", "Kargo (TL)", "Teslimat adresi"],
          rows,
        ),
      );
    }

    if (type === "products") {
      const allProducts: Array<ExportProduct> = [];
      let cursor: string | null = null;
      do {
        const result: { page: ExportProduct[]; isDone: boolean; continueCursor: string } = await client.query(
          api.products.listForExportAdmin,
          {
            adminSecret,
            cursor,
            limit: 250,
          },
        );
        allProducts.push(...result.page);
        cursor = result.isDone ? null : result.continueCursor;
      } while (cursor && allProducts.length < 10000);

      const rows = allProducts.map((product) => {
        const range = getProductPriceRange({ variants: product.variants });
        return [
          product.slug,
          product.title,
          product.categorySlug ?? "",
          product.availableForSale ? "Evet" : "Hayır",
          range.min === range.max ? range.min : `${range.min} - ${range.max}`,
          product.variants.length,
          product.variants.reduce((sum: number, variant: { stockQuantity: number }) => sum + variant.stockQuantity, 0),
          product.updatedAt,
        ];
      });
      return csvResponse(
        "urunler.csv",
        toCsv(
          ["Adres", "Başlık", "Kategori", "Satışta", "Fiyat (TL)", "Varyant sayısı", "Toplam stok", "Güncelleme"],
          rows,
        ),
      );
    }

    if (type === "customers") {
      const allCustomers: Array<ExportCustomer> = [];
      let cursor: string | null = null;
      do {
        const result: { page: ExportCustomer[]; isDone: boolean; continueCursor: string } = await client.query(
          api.customers.listAdmin,
          {
            adminSecret,
            query: "",
            numItems: 100,
            ...(cursor ? { cursor } : {}),
          },
        );
        allCustomers.push(...result.page);
        cursor = result.isDone ? null : result.continueCursor;
      } while (cursor && allCustomers.length < 10000);

      const rows = allCustomers.map((customer) => [
        customer.name,
        customer.email,
        customer.phone,
        formatDate(customer.registeredAt, { dateStyle: "short" }, ""),
        customer.orderCount,
        customer.totalSpent,
        customer.addressCount,
        formatDate(customer.lastOrderAt, { dateStyle: "short" }, ""),
      ]);
      return csvResponse(
        "musteriler.csv",
        toCsv(
          ["Ad", "E-posta", "Telefon", "Kayıt tarihi", "Sipariş sayısı", "Toplam harcama (TL)", "Adres sayısı", "Son sipariş"],
          rows,
        ),
      );
    }

    return NextResponse.json({ error: "Bilinmeyen rapor türü." }, { status: 404 });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
