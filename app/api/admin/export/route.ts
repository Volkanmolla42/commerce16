import * as XLSX from "xlsx";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { getAdminBackend, adminErrorResponse } from "@/lib/admin/backend";
import { hasAdminSession } from "@/lib/admin/session";
import { toCsv } from "@/lib/admin/csv";
import { orderStatusLabels, orderPaymentStatusLabels, getOrderCode, getOrderPaymentMethodTitle } from "@/lib/orders";
import { kurusToLira } from "@/lib/format-money";
import { formatDate, formatDateTime } from "@/lib/format-date";
import { NextRequest, NextResponse } from "next/server";

type ExportOrder = Doc<"orders">;

type ExportProduct = {
  slug: string;
  title: string;
  categorySlug?: string;
  description?: string;
  availableForSale: boolean;
  options: Array<{
    id: string;
    name: string;
    values: string[];
  }>;
  variants: Array<{
    id: string;
    title: string;
    sku?: string;
    barcode?: string;
    price: string;
    compareAtPrice?: string;
    stockQuantity: number;
    selectedOptions: Array<{ name: string; value: string }>;
  }>;
  imageUrls: string[];
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

function xlsxResponse(filename: string, buffer: Buffer) {
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
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
  const format = request.nextUrl.searchParams.get("format");

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

      const headers = [
        "Sipariş No",
        "Tarih",
        "Lojistik Durumu",
        "Ödeme Durumu",
        "Ödeme Yöntemi",
        "Müşteri",
        "E-posta",
        "Telefon",
        "Ürün adedi",
        "Tutar (TL)",
        "Kupon",
        "İndirim (TL)",
        "Kargo (TL)",
        "Teslimat adresi",
        "Fatura Türü",
        "Firma Unvanı",
        "Vergi No / TCKN",
        "Vergi Dairesi",
        "Fatura Adresi",
      ];
      const rows = allOrders.map((order) => [
        getOrderCode(order, true),
        formatDateTime(order._creationTime, { dateStyle: "short", timeStyle: "short" }),
        orderStatusLabels[order.status],
        orderPaymentStatusLabels[order.paymentStatus],
        getOrderPaymentMethodTitle(order),
        order.customerName,
        order.customerEmail,
        order.customerPhone ?? "",
        order.items.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0),
        order.total,
        order.couponCode ?? "",
        order.couponDiscountKurus ? kurusToLira(order.couponDiscountKurus) : "",
        order.shippingFee !== undefined && order.shippingFee !== null ? String(order.shippingFee) : "0",
        order.shippingAddress ?? "",
        order.billingType === "corporate" ? "Kurumsal" : "Bireysel",
        order.companyName ?? "",
        order.taxNumber ?? "",
        order.taxOffice ?? "",
        order.billingAddress ?? order.shippingAddress ?? "",
      ]);

      if (format === "xlsx") {
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Siparişler");
        const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
        return xlsxResponse("siparisler.xlsx", buf);
      }

      return csvResponse("siparisler.csv", toCsv(headers, rows));
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

      const headers = [
        "Ürün Adresi",
        "Başlık",
        "Kategori",
        "Açıklama",
        "Satışta",
        "Varyant Başlığı",
        "SKU",
        "Barkod",
        "Fiyat (TL)",
        "Liste Fiyatı (TL)",
        "Stok",
        "Seçenek 1 Adı",
        "Seçenek 1 Değeri",
        "Seçenek 2 Adı",
        "Seçenek 2 Değeri",
        "Görseller",
      ];

      const rows: Array<Array<string | number>> = [];
      for (const product of allProducts) {
        const opt1Name = product.options[0]?.name ?? "";
        const opt2Name = product.options[1]?.name ?? "";
        const imagesStr = product.imageUrls.join(", ");

        if (product.variants.length === 0) {
          rows.push([
            product.slug,
            product.title,
            product.categorySlug ?? "",
            product.description ?? "",
            product.availableForSale ? "Evet" : "Hayır",
            "Standart",
            "",
            "",
            "0",
            "",
            0,
            "",
            "",
            "",
            "",
            imagesStr,
          ]);
        } else {
          for (let i = 0; i < product.variants.length; i++) {
            const v = product.variants[i];
            const opt1Val = v.selectedOptions.find((so) => so.name === opt1Name)?.value ?? "";
            const opt2Val = v.selectedOptions.find((so) => so.name === opt2Name)?.value ?? "";

            rows.push([
              product.slug,
              i === 0 ? product.title : "",
              i === 0 ? (product.categorySlug ?? "") : "",
              i === 0 ? (product.description ?? "") : "",
              product.availableForSale ? "Evet" : "Hayır",
              v.title,
              v.sku ?? "",
              v.barcode ?? "",
              v.price,
              v.compareAtPrice ?? "",
              v.stockQuantity,
              opt1Name,
              opt1Val,
              opt2Name,
              opt2Val,
              i === 0 ? imagesStr : "",
            ]);
          }
        }
      }

      if (format === "xlsx") {
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Ürünler");
        const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
        return xlsxResponse("urunler.xlsx", buf);
      }

      return csvResponse("urunler.csv", toCsv(headers, rows));
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
