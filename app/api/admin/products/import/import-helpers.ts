import { getAdminBackend } from "@/lib/admin/backend";
import { api } from "@/convex/_generated/api";
import { slugify } from "@/lib/text";
import { extractCategorySegments, type ParsedProduct, type ProductOverride } from "@/lib/admin/import";
import { imagePreviewDataUrl } from "@/lib/admin/import-images";
import type { ProductAttributeValue } from "@/lib/catalog/attributes";

const PREVIEW_IMAGE_LIMIT = 4;

export async function loadCategories(client: ReturnType<typeof getAdminBackend>["client"], adminSecret: string) {
  return await client.query(api.categories.listAdmin, { adminSecret });
}

export async function previewProductImageUrls(product: ParsedProduct) {
  const images = product.imageUrls.slice(0, PREVIEW_IMAGE_LIMIT);
  for (const buffer of product.embeddedImages.slice(0, PREVIEW_IMAGE_LIMIT - images.length)) {
    const dataUrl = await imagePreviewDataUrl(buffer);
    if (dataUrl) images.push(dataUrl);
  }
  return images;
}

export function parsedProductSummary(products: ParsedProduct[]) {
  return {
    parsedProductCount: products.length,
    parsedVariantCount: products.reduce((total, product) => total + product.variants.length, 0),
  };
}

export function findCategoryTitle(categoryValue: string | undefined, categorySlug: string): string {
  if (!categoryValue) return categorySlug;
  const segs = extractCategorySegments(categoryValue);
  for (const seg of segs) {
    if (slugify(seg) === categorySlug) return seg;
  }
  return segs[0] || categoryValue;
}

export function parseOverrides(value: FormDataEntryValue | null): ProductOverride[] {
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
