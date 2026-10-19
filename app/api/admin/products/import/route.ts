import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import * as XLSX from "xlsx";
import { getAdminBackend, adminErrorResponse } from "@/lib/admin/backend";
import { hasAdminSession } from "@/lib/admin/session";
import { toCsv } from "@/lib/admin/csv";
import { ATTRIBUTE_TYPES, type ProductAttributeValue } from "@/lib/catalog/attributes";
import { api } from "@/convex/_generated/api";
import {
  MAX_IMPORT_IMAGES,
  parseProductSpreadsheet,
  downloadAndOptimizeImage,
  optimizeImageBuffer,
  imagePreviewDataUrl,
  type ImportCategory,
  type ParsedProduct,
  type ProductOverride,
  type RowError,
  type StorageImageResult,
} from "@/lib/admin/import";
import type { Id } from "@/convex/_generated/dataModel";

const PREVIEW_PRODUCT_LIMIT = 60;
const PREVIEW_IMAGE_LIMIT = 4;
const IMPORT_CHUNK_SIZE = 25;

async function loadCategories(client: ReturnType<typeof getAdminBackend>["client"], adminSecret: string) {
  return await client.query(api.categories.listAdmin, { adminSecret });
}

async function previewProductImageUrls(product: ParsedProduct) {
  const images = product.imageUrls.slice(0, PREVIEW_IMAGE_LIMIT);
  for (const buffer of product.embeddedImages.slice(0, PREVIEW_IMAGE_LIMIT - images.length)) {
    const dataUrl = await imagePreviewDataUrl(buffer);
    if (dataUrl) images.push(dataUrl);
  }
  return images;
}

function parsedProductSummary(products: ParsedProduct[]) {
  return {
    parsedProductCount: products.length,
    parsedVariantCount: products.reduce((total, product) => total + product.variants.length, 0),
  };
}

function parseOverrides(value: FormDataEntryValue | null): ProductOverride[] {
  if (typeof value !== "string" || !value.trim()) return [];
  if (value.length > 1_000_000) throw new Error("Düzenleme verisi çok büyük.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("Düzenleme verisi geçersiz.");
  }
  if (!Array.isArray(parsed)) throw new Error("Düzenleme verisi geçersiz.");

  const overrides: ProductOverride[] = [];
  for (const item of parsed.slice(0, 500)) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    if (typeof record.slug !== "string" || !record.slug) continue;

    const categorySlug = typeof record.categorySlug === "string" ? record.categorySlug : undefined;
    let attributes: ProductOverride["attributes"];
    if (record.attributes !== undefined) {
      if (!Array.isArray(record.attributes) || record.attributes.length > 30) {
        throw new Error("Ürün özellikleri geçersiz.");
      }
      attributes = record.attributes.map((attribute) => {
        if (!attribute || typeof attribute !== "object" || Array.isArray(attribute)) {
          throw new Error("Ürün özelliği geçersiz.");
        }
        const entry = attribute as Record<string, unknown>;
        if (typeof entry.key !== "string" || !entry.key) throw new Error("Ürün özelliği geçersiz.");
        const attributeValue = entry.value;
        const valid = typeof attributeValue === "string" ||
          typeof attributeValue === "number" ||
          typeof attributeValue === "boolean" ||
          (Array.isArray(attributeValue) && attributeValue.every((value) => typeof value === "string"));
        if (!valid) throw new Error("Ürün özelliği değeri geçersiz.");
        return { key: entry.key, value: attributeValue as ProductAttributeValue };
      });
    }

    overrides.push({
      slug: record.slug,
      ...(categorySlug !== undefined ? { categorySlug } : {}),
      ...(attributes !== undefined ? { attributes } : {}),
    });
  }
  return overrides;
}

export async function GET(request: NextRequest) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Yönetici oturumu gerekli." }, { status: 401 });
  }

  const format = request.nextUrl.searchParams.get("format") || "xlsx";
  const { client, adminSecret } = getAdminBackend();
  const categories = await loadCategories(client, adminSecret).catch(() => []);
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
    const overrides = parseOverrides(formData.get("overrides"));

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Lütfen bir Excel veya CSV dosyası yükleyin." }, { status: 400 });
    }
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: "Dosya en fazla 20 MB olabilir." }, { status: 413 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const categories = await loadCategories(client, adminSecret);
    const importCategories: ImportCategory[] = categories.map((category) => ({
      slug: category.slug,
      title: category.title,
      attributes: category.attributes,
    }));
    const parseResult = parseProductSpreadsheet(buffer, importCategories, overrides);

    if (parseResult.totalRows === 0) {
      return NextResponse.json(
        {
          error: parseResult.errors[0]?.error ?? "Dosya içeriği geçerli ürün verisi içermiyor.",
          totalRows: 0,
          productCount: 0,
          parsedProductCount: 0,
          parsedVariantCount: 0,
          skippedProducts: 0,
          products: [],
          errors: parseResult.errors,
        },
        { status: 400 },
      );
    }

    if (dryRun) {
      const previewProducts = parseResult.allProducts.slice(0, PREVIEW_PRODUCT_LIMIT);
      const validSlugs = new Set(parseResult.products.map((product) => product.slug));
      const existingSlugs = new Set(await client.query(api.products.existingSlugsAdmin, {
        adminSecret,
        slugs: previewProducts.map((product) => product.slug),
      }));
      const categoryBySlug = new Map(categories.map((category) => [category.slug, category]));
      const products = await Promise.all(previewProducts.map(async (product) => {
        const category = product.categorySlug ? categoryBySlug.get(product.categorySlug) : undefined;
        const attributeLabels = new Map(
          (category?.attributes ?? []).map((attribute) => [attribute.key, attribute.label]),
        );
        const prices = product.variants.map((variant) => Number(variant.price));
        const images = await previewProductImageUrls(product);

        return {
          slug: product.slug,
          title: product.title,
          categoryValue: product.categoryValue,
          category: category ? { slug: category.slug, title: category.title } : null,
          exists: existingSlugs.has(product.slug),
          valid: validSlugs.has(product.slug),
          rowNumbers: product.rowNumbers,
          variants: product.variants.slice(0, 8).map((variant) => ({
            title: variant.title,
            price: variant.price,
            stockQuantity: variant.stockQuantity,
            sku: variant.sku,
          })),
          variantCount: product.variants.length,
          options: product.options,
          attributes: product.attributes.map((attribute) => ({
            key: attribute.key,
            label: attributeLabels.get(attribute.key) ?? attribute.key,
            value: attribute.value,
          })),
          priceMin: Math.min(...prices).toFixed(2),
          priceMax: Math.max(...prices).toFixed(2),
          stockTotal: product.variants.reduce((total, variant) => total + variant.stockQuantity, 0),
          imageCount: product.imageUrls.length + product.embeddedImages.length,
          images,
        };
      }));

      return NextResponse.json({
        success: true,
        dryRun: true,
        totalRows: parseResult.totalRows,
        productCount: parseResult.products.length,
        ...parsedProductSummary(parseResult.allProducts),
        skippedProducts: parseResult.skippedProducts,
        productsTruncated: parseResult.allProducts.length > PREVIEW_PRODUCT_LIMIT,
        previewLimit: PREVIEW_PRODUCT_LIMIT,
        products,
        categoryOptions: categories.map((category) => ({
          slug: category.slug,
          title: category.title,
          attributes: category.attributes ?? [],
        })),
        errors: parseResult.errors,
      });
    }

    if (parseResult.products.length === 0) {
      return NextResponse.json(
        {
          error: "Aktarılabilir ürün bulunamadı. Hata listesini inceleyip dosyayı düzeltin.",
          skippedProducts: parseResult.skippedProducts,
          errors: parseResult.errors,
        },
        { status: 400 },
      );
    }

    const uploadImage = async (webp: Buffer, fileName: string): Promise<StorageImageResult | null> => {
      const uploadUrl = await client.mutation(api.products.generateImageUploadUrl, { adminSecret });
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "image/webp" },
        body: new Uint8Array(webp),
      });
      if (!uploadResponse.ok) return null;
      const { storageId } = (await uploadResponse.json()) as { storageId: Id<"_storage"> };
      return { storageId, fileName };
    };

    const batchPayload = [];
    const allErrors: RowError[] = [...parseResult.errors];
    const rowBySlug = new Map(parseResult.products.map((product) => [product.slug, product.rowNumbers[0] ?? 0]));
    const uploadedBySlug = new Map<string, StorageImageResult[]>();
    let imagesImported = 0;
    let imagesFailed = 0;

    for (const product of parseResult.products) {
      const uploadedImages: StorageImageResult[] = [];

      for (const url of product.imageUrls) {
        if (uploadedImages.length >= MAX_IMPORT_IMAGES) break;
        const webp = await downloadAndOptimizeImage(url);
        if (!webp) {
          imagesFailed++;
          continue;
        }
        const uploaded = await uploadImage(webp, `${product.slug}-${uploadedImages.length + 1}.webp`);
        if (uploaded) {
          uploadedImages.push(uploaded);
          imagesImported++;
        } else {
          imagesFailed++;
        }
      }

      for (const image of product.embeddedImages) {
        if (uploadedImages.length >= MAX_IMPORT_IMAGES) break;
        const webp = await optimizeImageBuffer(image);
        if (!webp) {
          imagesFailed++;
          continue;
        }
        const uploaded = await uploadImage(webp, `${product.slug}-${uploadedImages.length + 1}.webp`);
        if (uploaded) {
          uploadedImages.push(uploaded);
          imagesImported++;
        } else {
          imagesFailed++;
        }
      }

      uploadedBySlug.set(product.slug, uploadedImages);
      batchPayload.push({
        slug: product.slug,
        title: product.title,
        categorySlug: product.categorySlug,
        description: product.description,
        availableForSale: product.availableForSale,
        options: product.options,
        variants: product.variants,
        ...(product.attributes.length > 0 ? { attributes: product.attributes } : {}),
        ...(uploadedImages.length > 0 ? { images: uploadedImages } : {}),
      });
    }

    let created = 0;
    let updated = 0;
    const failedSlugs = new Set<string>();
    for (let index = 0; index < batchPayload.length; index += IMPORT_CHUNK_SIZE) {
      const result = await client.mutation(api.products.importBatchAdmin, {
        adminSecret,
        products: batchPayload.slice(index, index + IMPORT_CHUNK_SIZE),
      });
      created += result.created;
      updated += result.updated;
      for (const error of result.errors) {
        failedSlugs.add(error.slug);
        allErrors.push({
          rowNumber: rowBySlug.get(error.slug) ?? 0,
          slug: error.slug,
          error: error.error,
        });
      }
    }

    for (const slug of failedSlugs) {
      for (const image of uploadedBySlug.get(slug) ?? []) {
        imagesImported--;
        await client.mutation(api.products.discardImageUpload, {
          adminSecret,
          storageId: image.storageId,
        }).catch(() => {});
      }
    }

    if (created > 0 || updated > 0) {
      revalidateTag("products", { expire: 0 });
      revalidatePath("/sitemap.xml");
    }

    return NextResponse.json({
      success: true,
      total: batchPayload.length,
      created,
      updated,
      skippedProducts: parseResult.skippedProducts,
      failedProducts: failedSlugs.size,
      imagesImported: Math.max(0, imagesImported),
      imagesFailed,
      errors: allErrors,
    });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
