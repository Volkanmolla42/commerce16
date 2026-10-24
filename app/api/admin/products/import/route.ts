import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { getAdminBackend, adminErrorResponse } from "@/lib/admin/backend";
import { findCategoryTitle, loadCategories, parseOverrides, parsedProductSummary, previewProductImageUrls } from "./import-helpers";
import { buildProductImportTemplate } from "./template";
import { hasAdminSession } from "@/lib/admin/session";
import { slugify } from "@/lib/text";
import { api } from "@/convex/_generated/api";
import {
  MAX_IMPORT_IMAGES,
  parseProductSpreadsheet,
  extractCategorySegments,
  type ImportCategory,
  type RowError,
} from "@/lib/admin/import";
import {
  downloadAndOptimizeImage,
  optimizeImageBuffer,
  type StorageImageResult,
} from "@/lib/admin/import-images";
import type { Id } from "@/convex/_generated/dataModel";

const PREVIEW_PRODUCT_LIMIT = 300;
const IMPORT_CHUNK_SIZE = 25;

export async function GET(request: NextRequest) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Yönetici oturumu gerekli." }, { status: 401 });
  }

  const format = request.nextUrl.searchParams.get("format") || "xlsx";
  const { client, adminSecret } = getAdminBackend();
  const categories = await loadCategories(client, adminSecret).catch(() => []);
  return await buildProductImportTemplate(format, categories);
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

    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > 24 * 1024 * 1024) {
      return NextResponse.json({ error: "İstek boyutu çok büyük. Dosya en fazla 20 MB olabilir." }, { status: 413 });
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
      const allCategoryOptions: ImportCategory[] = categories.map((category) => ({
        slug: category.slug,
        title: category.title,
        attributes: category.attributes ?? [],
      }));
      for (const product of parseResult.allProducts) {
        if (product.categoryValue) {
          const segs = extractCategorySegments(product.categoryValue);
          for (const seg of segs) {
            const segSlug = slugify(seg);
            if (segSlug && !allCategoryOptions.some((c) => c.slug === segSlug)) {
              allCategoryOptions.push({
                slug: segSlug,
                title: seg,
                attributes: [],
              });
            }
          }
        }
        if (product.categorySlug && !allCategoryOptions.some((c) => c.slug === product.categorySlug)) {
          allCategoryOptions.push({
            slug: product.categorySlug,
            title: findCategoryTitle(product.categoryValue, product.categorySlug),
            attributes: [],
          });
        }
      }
      const categoryBySlug = new Map(allCategoryOptions.map((category) => [category.slug, category]));
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
        detectedSource: parseResult.detectedSource,
        totalRows: parseResult.totalRows,
        productCount: parseResult.products.length,
        ...parsedProductSummary(parseResult.allProducts),
        skippedProducts: parseResult.skippedProducts,
        productsTruncated: parseResult.allProducts.length > PREVIEW_PRODUCT_LIMIT,
        previewLimit: PREVIEW_PRODUCT_LIMIT,
        products,
        categoryOptions: allCategoryOptions.map((category) => ({
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

    const existingCategorySlugs = new Set(categories.map((c) => c.slug));
    const missingCategories = new Map<string, string>();
    for (const product of parseResult.products) {
      if (product.categorySlug && !existingCategorySlugs.has(product.categorySlug)) {
        missingCategories.set(product.categorySlug, findCategoryTitle(product.categoryValue, product.categorySlug));
      }
    }
    for (const [slug, title] of missingCategories) {
      try {
        await client.mutation(api.categories.create, {
          adminSecret,
          title,
          slug,
          description: "",
        });
        existingCategorySlugs.add(slug);
      } catch {
        // Zaten varsa veya eşzamanlı eklendiyse devam et
      }
    }

    const batchPayload = [];
    const allErrors: RowError[] = [...parseResult.errors];
    const rowBySlug = new Map(parseResult.products.map((product) => [product.slug, product.rowNumbers[0] ?? 0]));
    const uploadedBySlug = new Map<string, StorageImageResult[]>();
    const uploadedImageCache = new Map<string, StorageImageResult>();
    let imagesImported = 0;
    let imagesFailed = 0;

    const PRODUCT_CONCURRENCY = 4;
    const productResults: Array<{
      product: (typeof parseResult.products)[number];
      uploadedImages: StorageImageResult[];
    }> = new Array(parseResult.products.length);

    for (let i = 0; i < parseResult.products.length; i += PRODUCT_CONCURRENCY) {
      const slice = parseResult.products.slice(i, i + PRODUCT_CONCURRENCY);
      await Promise.all(
        slice.map(async (product, sliceIdx) => {
          const globalIdx = i + sliceIdx;
          const uploadedImages: StorageImageResult[] = [];
          const imageUrlsToProcess = product.imageUrls.slice(0, MAX_IMPORT_IMAGES);

          if (imageUrlsToProcess.length > 0) {
            const results = await Promise.all(
              imageUrlsToProcess.map(async (url, idx) => {
                const cached = uploadedImageCache.get(url);
                if (cached) return cached;
                const webp = await downloadAndOptimizeImage(url);
                if (!webp) return null;
                const uploaded = await uploadImage(webp, `${product.slug}-${idx + 1}.webp`);
                if (uploaded) uploadedImageCache.set(url, uploaded);
                return uploaded;
              }),
            );
            for (const res of results) {
              if (res) {
                uploadedImages.push(res);
                imagesImported++;
              } else {
                imagesFailed++;
              }
            }
          }

          const remainingSlots = MAX_IMPORT_IMAGES - uploadedImages.length;
          if (remainingSlots > 0 && product.embeddedImages.length > 0) {
            const embeddedToProcess = product.embeddedImages.slice(0, remainingSlots);
            const results = await Promise.all(
              embeddedToProcess.map(async (image, idx) => {
                const webp = await optimizeImageBuffer(image);
                if (!webp) return null;
                return await uploadImage(webp, `${product.slug}-${uploadedImages.length + idx + 1}.webp`);
              }),
            );
            for (const res of results) {
              if (res) {
                uploadedImages.push(res);
                imagesImported++;
              } else {
                imagesFailed++;
              }
            }
          }

          productResults[globalIdx] = { product, uploadedImages };
        }),
      );
    }

    for (const item of productResults) {
      if (!item) continue;
      const { product, uploadedImages } = item;
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
