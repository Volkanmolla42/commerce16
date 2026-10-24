import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { toCsv } from "@/lib/admin/csv";
import { ATTRIBUTE_TYPES } from "@/lib/catalog/attributes";
import { loadCategories } from "./import-helpers";

type TemplateCategory = Awaited<ReturnType<typeof loadCategories>>[number];

export async function buildProductImportTemplate(format: string, categories: TemplateCategory[]) {
  const sampleCategory = categories[0];
  const sampleCategorySlug = sampleCategory?.slug || "giyim";
  const requiredAttributes = (sampleCategory?.attributes ?? []).filter((attribute) => attribute.required);
  const attributeSample = (attribute: (typeof requiredAttributes)[number]) => {
    if (attribute.type === "boolean") return "Evet";
    if (attribute.type === "number") return "1";
    return attribute.options?.[0] ?? "Örnek";
  };

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
    ...requiredAttributes.map((attribute) => attribute.label),
  ];

  const baseRows = [
    [
      "ornek-tisort",
      "Örnek Pamuklu Tişört",
      sampleCategorySlug,
      "Yüksek kaliteli %100 pamuklu tişört.",
      "Evet",
      "S / Beyaz",
      "TIS-BEYAZ-S",
      "8680001001",
      "299.90",
      "399.90",
      "50",
      "Beden",
      "S",
      "Renk",
      "Beyaz",
      "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800",
    ],
    [
      "ornek-tisort",
      "",
      "",
      "",
      "Evet",
      "M / Beyaz",
      "TIS-BEYAZ-M",
      "8680001002",
      "299.90",
      "399.90",
      "40",
      "Beden",
      "M",
      "Renk",
      "Beyaz",
      "",
    ],
    [
      "ornek-kupa",
      "Örnek Seramik Kupa",
      sampleCategorySlug,
      "350 ml dayanıklı seramik kupa.",
      "Evet",
      "Standart",
      "KUP-STD",
      "8680002001",
      "149.00",
      "",
      "100",
      "",
      "",
      "",
      "",
      "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800",
    ],
  ];
  const sampleRows = baseRows.map((row) => [...row, ...requiredAttributes.map(attributeSample)]);

  if (format === "xlsx") {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
    XLSX.utils.book_append_sheet(workbook, sheet, "Ürün Şablonu");

    const categoryRows = categories.map((category) => [
      category.title,
      category.slug,
      (category.attributes ?? []).filter((attribute) => attribute.required).map((attribute) => attribute.label).join(", ") || "—",
      (category.attributes ?? []).map((attribute) => `${attribute.label} (${ATTRIBUTE_TYPES[attribute.type]})`).join(", ") || "—",
    ]);
    const categorySheet = XLSX.utils.aoa_to_sheet([
      ["Kategori", "Adres (slug)", "Zorunlu Özellikler", "Tüm Özellikler"],
      ...(categoryRows.length > 0
        ? categoryRows
        : [["Henüz kategori yok", "", "", "Önce Kategoriler bölümünden kategori oluşturun."]]),
    ]);
    XLSX.utils.book_append_sheet(workbook, categorySheet, "Kategoriler");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="urun_ice_aktarma_sablonu.xlsx"',
        "Cache-Control": "no-store",
      },
    });
  }

  return new NextResponse(toCsv(headers, sampleRows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="urun_ice_aktarma_sablonu.csv"',
      "Cache-Control": "no-store",
    },
  });

}
