import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getAdminBackend, adminErrorResponse } from "@/lib/admin/backend";
import { hasAdminSession } from "@/lib/admin/session";
import { toCsv } from "@/lib/admin/csv";
import { api } from "@/convex/_generated/api";
import {
  parseProductSpreadsheet,
  downloadAndOptimizeImage,
  type StorageImageResult,
  type RowError,
} from "@/lib/admin/import";
import type { Id } from "@/convex/_generated/dataModel";

export async function GET(request: NextRequest) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Yönetici oturumu gerekli." }, { status: 401 });
  }

  const format = request.nextUrl.searchParams.get("format") || "xlsx";

  // Örnek şablon başlıkları ve satırları
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

  const sampleRows = [
    [
      "ornek-tisort",
      "Örnek Pamuklu Tişört",
      "giyim",
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
      "mutfak",
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

  if (format === "xlsx") {
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ürün Şablonu");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    return new NextResponse(new Uint8Array(buf), {
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

export async function POST(request: NextRequest) {
  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite === "cross-site") {
    return NextResponse.json({ error: "Yetkisiz istek kaynağı." }, { status: 403 });
  }

  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Yönetici oturumu gerekli." }, { status: 401 });
  }

  try {
    const { client, adminSecret } = getAdminBackend();

    const rateLimit = await client.mutation(api.adminAuth.checkExportRateLimit, {
      adminSecret,
      key: "admin-product-import",
    });
    if (!rateLimit.ok) {
      return NextResponse.json(
        { error: "Çok sık içe aktarma isteği yapıldı. Lütfen biraz bekleyin." },
        { status: 429 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const dryRun = formData.get("dryRun") === "true";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Lütfen bir Excel veya CSV dosyası yükleyin." }, { status: 400 });
    }
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: "Dosya en fazla 20 MB olabilir." }, { status: 413 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const parseResult = parseProductSpreadsheet(buffer);
    if (parseResult.products.length === 0 && parseResult.errors.length > 0) {
      return NextResponse.json(
        {
          error: "Dosya içeriği geçerli ürün verisi içermiyor.",
          details: parseResult.errors,
        },
        { status: 400 },
      );
    }

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        totalRows: parseResult.totalRows,
        productCount: parseResult.products.length,
        variantCount: parseResult.products.reduce((acc, p) => acc + p.variants.length, 0),
        products: parseResult.products.map((p) => ({
          slug: p.slug,
          title: p.title,
          categorySlug: p.categorySlug,
          variantCount: p.variants.length,
          imageCount: p.imageUrls.length,
        })),
        errors: parseResult.errors,
      });
    }

    // Gerçek içe aktarma: Görselleri yükle ve Convex batch mutation çalıştır
    const batchPayload = [];
    const allErrors: RowError[] = [...parseResult.errors];

    for (const product of parseResult.products) {
      const uploadedImages: StorageImageResult[] = [];

      for (let i = 0; i < product.imageUrls.length && i < 8; i++) {
        const url = product.imageUrls[i];
        try {
          const webpBuffer = await downloadAndOptimizeImage(url);
          if (webpBuffer) {
            const uploadUrl = await client.mutation(api.products.generateImageUploadUrl, {
              adminSecret,
            });
            const uploadRes = await fetch(uploadUrl, {
              method: "POST",
              headers: { "Content-Type": "image/webp" },
              body: new Uint8Array(webpBuffer),
            });
            if (uploadRes.ok) {
              const { storageId } = (await uploadRes.json()) as { storageId: Id<"_storage"> };
              uploadedImages.push({
                storageId,
                fileName: `${product.slug}-${i + 1}.webp`,
              });
            }
          }
        } catch {
          // Görsel indirilemezse ürünün kendisini iptal etmiyoruz, görsel atlanır
        }
      }

      batchPayload.push({
        slug: product.slug,
        title: product.title,
        categorySlug: product.categorySlug,
        description: product.description,
        availableForSale: product.availableForSale,
        options: product.options,
        variants: product.variants,
        ...(uploadedImages.length > 0 ? { images: uploadedImages } : {}),
      });
    }

    const result = await client.mutation(api.products.importBatchAdmin, {
      adminSecret,
      products: batchPayload,
    });

    if (result.errors.length > 0) {
      for (const err of result.errors) {
        allErrors.push({
          rowNumber: 0,
          slug: err.slug,
          error: err.error,
        });
      }
    }

    return NextResponse.json({
      success: true,
      total: result.total,
      created: result.created,
      updated: result.updated,
      errors: allErrors,
    });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
