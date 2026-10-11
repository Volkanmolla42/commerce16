import { api } from "@/convex/_generated/api";
import { getAdminBackend } from "@/lib/admin/backend";
import { hasAdminSession } from "@/lib/admin/session";
import { toCsv } from "@/lib/admin/csv";
import { orderStatusLabels } from "@/lib/orders";
import { getProductPriceRange } from "@/lib/catalog/variants";
import { NextRequest, NextResponse } from "next/server";

const dateFormatter = new Intl.DateTimeFormat("tr-TR", { dateStyle: "short" });
const dateTimeFormatter = new Intl.DateTimeFormat("tr-TR", { dateStyle: "short", timeStyle: "short" });

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
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Yönetici oturumu gerekli." }, { status: 401 });
  }

  const type = request.nextUrl.searchParams.get("type");

  try {
    const { client, adminSecret } = getAdminBackend();

    if (type === "orders") {
      const orders = await client.query(api.orders.listAllAdmin, { adminSecret });
      const rows = orders.map((order) => [
        `#${order._id.slice(-8).toUpperCase()}`,
        dateTimeFormatter.format(new Date(order._creationTime)),
        orderStatusLabels[order.status],
        order.customerName,
        order.customerEmail,
        order.customerPhone ?? "",
        order.items.reduce((sum, item) => sum + item.quantity, 0),
        order.total,
        order.couponCode ?? "",
        order.couponDiscountKurus ? (order.couponDiscountKurus / 100).toFixed(2) : "",
        order.shippingAddress ?? "",
      ]);
      return csvResponse(
        "siparisler.csv",
        toCsv(
          ["Sipariş No", "Tarih", "Durum", "Müşteri", "E-posta", "Telefon", "Ürün adedi", "Tutar (TL)", "Kupon", "İndirim (TL)", "Teslimat adresi"],
          rows,
        ),
      );
    }

    if (type === "products") {
      const products = await client.query(api.products.listAllAdmin, { adminSecret });
      const rows = products.map((product) => {
        const range = getProductPriceRange({ variants: product.variants });
        return [
          product.slug,
          product.title,
          product.categorySlug ?? "",
          product.availableForSale ? "Evet" : "Hayır",
          range.min === range.max ? range.min : `${range.min} - ${range.max}`,
          product.variants.length,
          product.variants.reduce((sum, variant) => sum + variant.stockQuantity, 0),
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
      const result = await client.query(api.customers.listAdmin, { adminSecret, query: "", numItems: 24, all: true });
      const rows = result.page.map((customer) => [
        customer.name,
        customer.email,
        customer.phone,
        customer.registeredAt ? dateFormatter.format(new Date(customer.registeredAt)) : "",
        customer.orderCount,
        customer.totalSpent,
        customer.addressCount,
        customer.lastOrderAt ? dateFormatter.format(new Date(customer.lastOrderAt)) : "",
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Rapor oluşturulamadı." },
      { status: 400 },
    );
  }
}
