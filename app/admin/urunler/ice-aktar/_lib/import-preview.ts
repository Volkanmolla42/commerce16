import type { CategoryAttributeDefinition, ProductAttribute } from "@/lib/catalog/attributes";

export const MAX_FILE_SIZE = 20 * 1024 * 1024;
export const ACCEPTED_EXTENSIONS = [".csv", ".xlsx", ".xls"];
export const ERROR_DISPLAY_LIMIT = 200;

type ErrorScope = "field" | "category" | "attribute";
export type RowFilter = "all" | "ready" | "problem" | "new" | "update";

export type ImportError = {
  rowNumber: number;
  slug?: string;
  error: string;
  scope?: ErrorScope;
};

type PreviewProduct = {
  slug: string;
  title: string;
  categoryValue?: string;
  category: { slug: string; title: string } | null;
  exists: boolean;
  valid: boolean;
  rowNumbers: number[];
  variants: Array<{ title: string; price: string; stockQuantity: number; sku: string }>;
  variantCount: number;
  options: Array<{ name: string; values: string[] }>;
  attributes: Array<{ key: string; label: string; value: ProductAttribute["value"] }>;
  priceMin: string;
  priceMax: string;
  stockTotal: number;
  imageCount: number;
  images: string[];
};

type CategoryOption = {
  slug: string;
  title: string;
  attributes: CategoryAttributeDefinition[];
};

export type PreviewResult = {
  success: true;
  dryRun: true;
  detectedSource?: "shopify" | "woocommerce" | "standard";
  totalRows: number;
  productCount: number;
  parsedProductCount: number;
  parsedVariantCount: number;
  skippedProducts: number;
  productsTruncated: boolean;
  previewLimit: number;
  products: PreviewProduct[];
  categoryOptions: CategoryOption[];
  errors: ImportError[];
};

export type ImportResult = {
  success?: boolean;
  total?: number;
  created?: number;
  updated?: number;
  skippedProducts?: number;
  failedProducts?: number;
  imagesImported?: number;
  imagesFailed?: number;
  errors?: ImportError[];
  error?: string;
};

export type Step = "select" | "preview" | "importing" | "result";

export type RowState = {
  categorySlug: string;
  values: Record<string, string | string[]>;
};

type RowValidation = {
  messages: string[];
  fieldErrors: ImportError[];
  ready: boolean;
};

export type TableRow = {
  product: PreviewProduct;
  edit: RowState;
  category: CategoryOption | undefined;
  categoryMessage: string | null;
  attributeErrors: Record<string, string[]>;
  validation: RowValidation;
};

export function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function toEditorValue(value: ProductAttribute["value"]): string | string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

export function defaultRowState(product: PreviewProduct): RowState {
  const values: Record<string, string | string[]> = {};
  for (const attribute of product.attributes) {
    values[attribute.key] = toEditorValue(attribute.value);
  }
  return { categorySlug: product.category?.slug ?? "", values };
}

function parseNumberInput(value: string) {
  const normalized = value.trim().replace(",", ".");
  return normalized ? Number(normalized) : Number.NaN;
}

export function attributeMessages(attribute: CategoryAttributeDefinition, raw: string | string[] | undefined) {
  const empty = raw === undefined || raw === "" || (Array.isArray(raw) && raw.length === 0);
  if (empty) return attribute.required ? [`${attribute.label} alanı zorunludur.`] : [];

  if (attribute.type === "number") {
    return Number.isFinite(parseNumberInput(String(raw))) ? [] : [`${attribute.label} geçerli bir sayı olmalıdır.`];
  }
  if (attribute.type === "boolean") {
    return raw === "true" || raw === "false" ? [] : [`${attribute.label} için Evet veya Hayır seçin.`];
  }
  if (attribute.type === "select") {
    return (attribute.options ?? []).includes(String(raw))
      ? []
      : [`${attribute.label} için geçerli bir seçenek belirleyin.`];
  }
  if (attribute.type === "multiselect") {
    if (!Array.isArray(raw)) return [`${attribute.label} seçimi geçersiz.`];
    const options = attribute.options ?? [];
    return raw.every((item) => options.includes(item))
      ? []
      : [`${attribute.label} için geçerli seçenekler belirleyin.`];
  }
  return String(raw).length <= 500 ? [] : [`${attribute.label} en fazla 500 karakter olabilir.`];
}

function buildAttributes(
  definitions: CategoryAttributeDefinition[],
  values: Record<string, string | string[]>,
): ProductAttribute[] {
  const attributes: ProductAttribute[] = [];
  for (const definition of definitions) {
    const raw = values[definition.key];
    if (definition.type === "multiselect") {
      const list = Array.isArray(raw) ? raw.filter(Boolean) : [];
      if (list.length > 0) attributes.push({ key: definition.key, value: list });
      continue;
    }
    if (definition.type === "boolean") {
      if (raw === "true" || raw === "false") attributes.push({ key: definition.key, value: raw === "true" });
      continue;
    }
    if (definition.type === "number") {
      const text = typeof raw === "string" ? raw.trim() : "";
      if (!text) continue;
      const value = parseNumberInput(text);
      if (Number.isFinite(value)) attributes.push({ key: definition.key, value });
      continue;
    }
    const text = typeof raw === "string" ? raw.trim() : "";
    if (text) attributes.push({ key: definition.key, value: text });
  }
  return attributes;
}

function sameValues(
  left: Record<string, string | string[]>,
  right: Record<string, string | string[]>,
) {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...keys].every((key) => JSON.stringify(left[key]) === JSON.stringify(right[key]));
}

export function buildOverrides(
  products: PreviewProduct[],
  edits: Record<string, RowState>,
  categories: CategoryOption[],
) {
  const categoryBySlug = new Map(categories.map((category) => [category.slug, category]));
  return products.map((product) => {
    const defaults = defaultRowState(product);
    const state = edits[product.slug] ?? defaults;
    const category = categoryBySlug.get(state.categorySlug);
    const attributesChanged = !sameValues(state.values, defaults.values);
    const categoryChanged = state.categorySlug !== defaults.categorySlug;
    return {
      slug: product.slug,
      categorySlug: state.categorySlug,
      ...(attributesChanged || categoryChanged
        ? { attributes: category ? buildAttributes(category.attributes ?? [], state.values) : [] }
        : {}),
    };
  });
}

export function getImportStatusMessage(progress: number): string {
  if (progress < 25) return "Dosya taranıyor ve kategoriler hazırlanıyor…";
  if (progress < 60) return "Ürün görselleri indiriliyor ve WebP formatına dönüştürülüyor…";
  if (progress < 85) return "Varyantlar, stoklar ve özellikler kaydediliyor…";
  if (progress < 100) return "Veritabanı kayıtları tamamlanıyor…";
  return "Aktarım tamamlandı!";
}
