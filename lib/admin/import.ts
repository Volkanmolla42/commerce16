import { normalizeHeaderKey, slugify } from "../text";
import { readSpreadsheetTable, type SheetTable } from "./spreadsheet";
import type {
  CategoryAttributeDefinition,
  ProductAttribute,
  ProductAttributeValue,
} from "@/lib/catalog/attributes";

export const MAX_IMPORT_IMAGES = 8;

type ParsedVariant = {
  id: string;
  title: string;
  sku: string;
  barcode?: string;
  price: string;
  compareAtPrice?: string;
  stockQuantity: number;
  selectedOptions: Array<{ name: string; value: string }>;
};

type ParsedOption = {
  id: string;
  name: string;
  values: string[];
};

export type ParsedProduct = {
  slug: string;
  title: string;
  categoryValue?: string;
  categorySlug?: string;
  description?: string;
  availableForSale: boolean;
  attributes: ProductAttribute[];
  options: ParsedOption[];
  variants: ParsedVariant[];
  imageUrls: string[];
  embeddedImages: Buffer[];
  rowNumbers: number[];
};

export type ImportCategory = {
  slug: string;
  title: string;
  attributes?: CategoryAttributeDefinition[];
};

export type ProductOverride = {
  slug: string;
  categorySlug?: string;
  attributes?: ProductAttribute[];
};

export type ErrorScope = "field" | "category" | "attribute";

export type RowError = {
  rowNumber: number;
  slug?: string;
  error: string;
  scope?: ErrorScope;
};

type ImportSource = "shopify" | "woocommerce" | "standard";

type ParseResult = {
  products: ParsedProduct[];
  allProducts: ParsedProduct[];
  errors: RowError[];
  totalRows: number;
  skippedProducts: number;
  detectedSource: ImportSource;
};

function matchColumn(key: string): string | null {
  const normalized = normalizeHeaderKey(key);
  if (["urunadresi", "slug", "adres", "link", "url", "handle", "postname"].includes(normalized)) return "slug";
  if (["baslik", "title", "urunadi", "ad", "urun", "posttitle"].includes(normalized)) return "title";
  if (["kategori", "category", "kategoriadi", "kategoriad", "categoryname", "categorytitle", "kategoriadresi", "kategorislug", "productcategory", "type", "urunturu", "taxproductcat"].includes(normalized)) return "categorySlug";
  if (["aciklama", "description", "detay", "icerik", "bodyhtml", "body", "postcontent"].includes(normalized)) return "description";
  if (["satista", "available", "durum", "aktif", "satistami", "published", "status", "poststatus"].includes(normalized)) return "availableForSale";
  if (["varyantbasligi", "varianttitle", "varyant", "varyantadi"].includes(normalized)) return "variantTitle";
  if (["sku", "stokkodu", "kod", "urunkodu", "variantsku"].includes(normalized)) return "sku";
  if (["barkod", "barcode", "gtin", "ean", "variantbarcode"].includes(normalized)) return "barcode";
  if (["fiyat", "satisfiyati", "price", "tutar", "fiyattl", "satisfiyatitl", "variantprice", "regularprice"].includes(normalized)) return "price";
  if (["listefiyati", "eskifiyat", "piyasafiyati", "compareatprice", "variantcompareatprice", "listefiyatitl", "eskifiyattl", "piyasafiyatitl", "saleprice"].includes(normalized)) return "compareAtPrice";
  if (["stok", "stock", "stokadedi", "adet", "miktar", "variantinventoryqty", "stockquantity"].includes(normalized)) return "stockQuantity";
  if (["secenek1adi", "option1name", "ozellik1adi", "attribute1name"].includes(normalized)) return "opt1Name";
  if (["secenek1degeri", "option1value", "ozellik1degeri", "attribute1value"].includes(normalized)) return "opt1Val";
  if (["secenek2adi", "option2name", "ozellik2adi", "attribute2name"].includes(normalized)) return "opt2Name";
  if (["secenek2degeri", "option2value", "ozellik2degeri", "attribute2value"].includes(normalized)) return "opt2Val";
  if (["secenek3adi", "option3name", "ozellik3adi", "attribute3name"].includes(normalized)) return "opt3Name";
  if (["secenek3degeri", "option3value", "ozellik3degeri", "attribute3value"].includes(normalized)) return "opt3Val";
  if (["gorseller", "gorsellerurl", "gorselurl", "gorselurls", "urungorseli", "urungorselleri", "urunresmi", "resimler", "resimlerurl", "resimurl", "images", "imageurl", "gorsel", "imagesrc", "imagesource"].includes(normalized)) return "images";
  return null;
}

const TRUE_VALUES = new Set(["evet", "true", "1", "aktif", "active", "yes", "y", "publish", "var"]);
const FALSE_VALUES = new Set(["hayir", "false", "0", "pasif", "inactive", "no", "n", "archived", "draft", "taslak", "arsiv", "yok"]);

function parseBooleanValue(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  const normalized = String(value ?? "").trim().toLocaleLowerCase("tr-TR");
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return null;
}

function parseBooleanField(value: unknown): boolean {
  return parseBooleanValue(value) ?? true;
}

function parseDecimalAmount(value: string): number | null {
  let normalized = value.trim().replace(/\s/g, "");
  if (!normalized) return null;
  const lastComma = normalized.lastIndexOf(",");
  const lastDot = normalized.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    // Son ayırıcı ondalık kabul edilir: 1.299,90 ve 1,299.90 aynı şekilde okunur.
    normalized = lastComma > lastDot
      ? normalized.replace(/\./g, "").replace(",", ".")
      : normalized.replace(/,/g, "");
  } else {
    normalized = normalized.replace(",", ".");
  }
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

export function extractCategorySegments(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (trimmed.includes(">")) {
    return trimmed.split(">").map((p) => p.trim()).filter(Boolean);
  }
  if (trimmed.includes(" - ")) {
    return trimmed.split(" - ").map((p) => p.trim()).filter(Boolean);
  }
  return [trimmed];
}

function categoryLookup(categories: ImportCategory[]): Map<string, ImportCategory> {
  const lookup = new Map<string, ImportCategory>();
  for (const category of categories) lookup.set(normalizeHeaderKey(category.slug), category);
  for (const category of categories) {
    const titleKey = normalizeHeaderKey(category.title);
    if (!lookup.has(titleKey)) lookup.set(titleKey, category);
  }
  return lookup;
}

function attributeColumns(
  category: ImportCategory,
  standardHeaders: Set<string>,
): Map<string, CategoryAttributeDefinition> {
  const columns = new Map<string, CategoryAttributeDefinition>();
  for (const definition of category.attributes ?? []) {
    const labelKey = normalizeHeaderKey(definition.label);
    const keyKey = normalizeHeaderKey(definition.key);
    if (labelKey && !standardHeaders.has(labelKey)) columns.set(labelKey, definition);
    if (keyKey && keyKey !== labelKey && !standardHeaders.has(keyKey)) columns.set(keyKey, definition);
  }
  return columns;
}

function parseAttributeValue(
  definition: CategoryAttributeDefinition,
  raw: string,
): { value: ProductAttributeValue } | { error: string } {
  if (definition.type === "number") {
    const amount = parseDecimalAmount(raw);
    return amount === null
      ? { error: `${definition.label} sayısal bir değer olmalı.` }
      : { value: amount };
  }
  if (definition.type === "boolean") {
    const value = parseBooleanValue(raw);
    return value === null
      ? { error: `${definition.label} Evet veya Hayır olarak yazılmalı.` }
      : { value };
  }
  if (definition.type === "multiselect" || definition.type === "select") {
    const allowed = definition.options ?? [];
    const parts = definition.type === "multiselect"
      ? raw.split(/[,;|]/).map((part) => part.trim()).filter(Boolean)
      : [raw.trim()];
    const options: string[] = [];
    for (const part of parts) {
      if (allowed.length === 0) {
        options.push(part);
        continue;
      }
      const match = allowed.find((option) => normalizeHeaderKey(option) === normalizeHeaderKey(part));
      if (!match) {
        return {
          error: `${definition.label} için geçersiz seçenek: "${part}". Geçerli seçenekler: ${allowed.join(", ")}.`,
        };
      }
      options.push(match);
    }
    return { value: definition.type === "multiselect" ? [...new Set(options)] : options[0] ?? "" };
  }
  if (raw.length > 500) return { error: `${definition.label} en fazla 500 karakter olabilir.` };
  return { value: raw };
}

function attributeValueProblem(
  definition: CategoryAttributeDefinition,
  value: ProductAttributeValue,
): string | null {
  if (definition.type === "number") {
    return typeof value === "number" && Number.isFinite(value)
      ? null
      : `${definition.label} sayısal bir değer olmalı.`;
  }
  if (definition.type === "boolean") {
    return typeof value === "boolean" ? null : `${definition.label} Evet veya Hayır olmalı.`;
  }
  if (definition.type === "select") {
    if (typeof value !== "string") return `${definition.label} metin değeri olmalı.`;
    const allowed = definition.options ?? [];
    return allowed.length === 0 || allowed.includes(value)
      ? null
      : `${definition.label} için geçerli bir seçenek belirleyin.`;
  }
  if (definition.type === "multiselect") {
    if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
      return `${definition.label} bir seçenek listesi olmalı.`;
    }
    if (new Set(value).size !== value.length) return `${definition.label} içinde yinelenen seçenek olamaz.`;
    const allowed = definition.options ?? [];
    return allowed.length === 0 || value.every((item) => allowed.includes(item))
      ? null
      : `${definition.label} için yalnızca tanımlı seçenekler seçilebilir.`;
  }
  if (typeof value !== "string") return `${definition.label} metin değeri olmalı.`;
  return value.length <= 500 ? null : `${definition.label} en fazla 500 karakter olabilir.`;
}

function attributeValueIsEmpty(value: ProductAttributeValue | undefined) {
  return value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
}

function detectSpreadsheetSource(headers: string[]): ImportSource {
  const normalized = new Set(headers.map(normalizeHeaderKey));
  if (normalized.has("handle") || normalized.has("variantprice") || normalized.has("bodyhtml")) {
    return "shopify";
  }
  if (normalized.has("posttitle") || normalized.has("taxproductcat") || normalized.has("regularprice")) {
    return "woocommerce";
  }
  return "standard";
}

function variantCombinationKey(selectedOptions: Array<{ name: string; value: string }>) {
  return JSON.stringify(
    [...selectedOptions]
      .map((option) => ({ name: normalizeHeaderKey(option.name), value: option.value }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  );
}

function normalizedOption(
  product: ParsedProduct,
  name: string,
  value: string,
): { name: string; value: string } {
  const existing = product.options.find((option) => normalizeHeaderKey(option.name) === normalizeHeaderKey(name));
  const option = existing ?? { id: slugify(name), name, values: [] };
  if (!existing) product.options.push(option);
  const existingValue = option.values.find((entry) => normalizeHeaderKey(entry) === normalizeHeaderKey(value));
  if (existingValue === undefined) option.values.push(value);
  return { name: option.name, value: existingValue ?? value };
}

function parseImageUrls(value: string): string[] {
  return value
    .split(/[\s,;]+/)
    .map((url) => url.trim())
    .filter((url) => /^https?:\/\//i.test(url));
}

function emptyParseResult(error: string): ParseResult {
  return {
    products: [],
    allProducts: [],
    errors: [{ rowNumber: 1, error, scope: "field" }],
    totalRows: 0,
    skippedProducts: 0,
    detectedSource: "standard",
  };
}

export function parseProductSpreadsheet(
  buffer: Buffer,
  categories: ImportCategory[] = [],
  overrides: ProductOverride[] = [],
): ParseResult {
  let table: SheetTable = { headers: [], rows: [] };
  let embeddedImages = new Map<number, Buffer[]>();
  try {
    const parsed = readSpreadsheetTable(buffer);
    table = parsed.table;
    embeddedImages = parsed.embedded;
  } catch (cause) {
    return emptyParseResult(cause instanceof Error ? cause.message : "Dosya okunamadı. Geçerli bir Excel veya CSV dosyası seçin.");
  }

  if (table.rows.length === 0) {
    return emptyParseResult("Tabloda veri satırı bulunamadı.");
  }

  const detectedSource = detectSpreadsheetSource(table.headers);
  const lookup = categoryLookup(categories);
  const normalizedHeaders = new Set(table.headers.map(normalizeHeaderKey).filter(Boolean));
  const standardHeaders = new Set(
    table.headers.map(normalizeHeaderKey).filter((header) => matchColumn(header) !== null),
  );
  const errors: RowError[] = [];
  const productMap = new Map<string, ParsedProduct>();
  const attributeMaps = new Map<string, Map<string, ProductAttributeValue>>();
  const failedSlugs = new Set<string>();
  const reportedIssues = new Set<string>();
  const categoryIssues = new Map<string, RowError[]>();
  const attributeIssues = new Map<string, RowError[]>();
  const skuOwners = new Map<string, string>();
  const combinationKeys = new Map<string, Set<string>>();
  const columnCache = new Map<string, Map<string, CategoryAttributeDefinition>>();
  const overrideBySlug = new Map<string, ProductOverride>();
  for (const override of overrides) {
    if (override && typeof override.slug === "string") overrideBySlug.set(override.slug, override);
  }

  const recordIssue = (
    store: Map<string, RowError[]>,
    rowNumber: number,
    slug: string,
    key: string,
    error: string,
    scope: ErrorScope,
  ) => {
    const token = `${scope}:${slug}:${key}`;
    if (reportedIssues.has(token)) return;
    reportedIssues.add(token);
    store.set(slug, [...(store.get(slug) ?? []), { rowNumber, slug, error, scope }]);
  };

  let lastSlug = "";
  for (const row of table.rows) {
    const normalizedCells = new Map<string, string>();
    for (let index = 0; index < table.headers.length; index++) {
      const key = normalizeHeaderKey(table.headers[index] ?? "");
      if (key && !normalizedCells.has(key)) normalizedCells.set(key, row.cells[index] ?? "");
    }

    const mapped: Record<string, string> = {};
    for (const [key, value] of normalizedCells) {
      const field = matchColumn(key);
      if (field) {
        if (field === "categorySlug") {
          if (!mapped[field] || key === "type" || key === "kategori" || key === "category") {
            if (value.trim()) mapped[field] = value;
          }
        } else if (mapped[field] === undefined) {
          mapped[field] = value;
        }
      }
    }

    let slug = mapped.slug ? slugify(mapped.slug) : "";
    const title = mapped.title || "";
    if (!slug && title) slug = slugify(title);
    if (!slug && lastSlug) slug = lastSlug;
    if (!slug) {
      errors.push({ rowNumber: row.rowNumber, error: "Ürün adresi (slug) veya başlık belirtilmeli." });
      continue;
    }
    lastSlug = slug;

    const existingProduct = productMap.get(slug);

    // Ek görsel satırı kontrolü (Shopify gibi sistemlerde 2. ve sonraki görseller başlıksız/fiyatsız gelir)
    if (existingProduct && !mapped.price && !mapped.sku && !mapped.opt1Val) {
      existingProduct.rowNumbers.push(row.rowNumber);
      const rowImages = parseImageUrls(mapped.images ?? "");
      for (const url of rowImages) {
        if (!existingProduct.imageUrls.includes(url)) existingProduct.imageUrls.push(url);
      }
      const embedded = embeddedImages.get(row.sheetRow) ?? [];
      existingProduct.embeddedImages.push(...embedded);
      continue;
    }

    const priceNum = mapped.price ? parseDecimalAmount(mapped.price) : null;
    if (priceNum === null || priceNum < 0) {
      errors.push({ rowNumber: row.rowNumber, slug, error: `Geçersiz satış fiyatı: "${mapped.price ?? ""}"` });
      failedSlugs.add(slug);
      continue;
    }
    const price = priceNum.toFixed(2);

    let compareAtPrice: string | undefined;
    if (mapped.compareAtPrice) {
      const compareNum = parseDecimalAmount(mapped.compareAtPrice);
      if (compareNum === null || compareNum <= priceNum) {
        errors.push({
          rowNumber: row.rowNumber,
          slug,
          error: `Liste fiyatı (${mapped.compareAtPrice}) satış fiyatından (${price}) büyük olmalı.`,
        });
        failedSlugs.add(slug);
        continue;
      }
      compareAtPrice = compareNum.toFixed(2);
    }

    const stockNum = parseInt((mapped.stockQuantity || "0").replace(/[^0-9-]/g, ""), 10);
    const stockQuantity = Number.isFinite(stockNum) && stockNum >= 0 ? stockNum : 0;

    const rawCategory = mapped.categorySlug?.trim() ?? "";
    const segments = extractCategorySegments(rawCategory);
    const rootCategory = segments[0] ?? "";
    const leafCategory = segments[segments.length - 1] ?? "";
    const primaryCategory = rootCategory || leafCategory || rawCategory;

    for (const seg of segments) {
      const segSlug = slugify(seg);
      if (segSlug && !lookup.has(normalizeHeaderKey(segSlug)) && !lookup.has(normalizeHeaderKey(seg))) {
        const segCategory: ImportCategory = { slug: segSlug, title: seg, attributes: [] };
        lookup.set(normalizeHeaderKey(segSlug), segCategory);
        lookup.set(normalizeHeaderKey(seg), segCategory);
      }
    }

    let category: ImportCategory | null = existingProduct?.categorySlug
      ? lookup.get(normalizeHeaderKey(existingProduct.categorySlug)) ?? null
      : null;

    if (rawCategory) {
      const resolved = lookup.get(normalizeHeaderKey(primaryCategory)) ??
        lookup.get(normalizeHeaderKey(rawCategory)) ??
        (leafCategory ? lookup.get(normalizeHeaderKey(leafCategory)) : null) ?? null;
      if (!resolved) {
        const autoTitle = primaryCategory;
        const autoSlug = slugify(autoTitle);
        if (autoSlug) {
          const autoCategory: ImportCategory = { slug: autoSlug, title: autoTitle, attributes: [] };
          lookup.set(normalizeHeaderKey(autoSlug), autoCategory);
          lookup.set(normalizeHeaderKey(autoTitle), autoCategory);
          lookup.set(normalizeHeaderKey(rawCategory), autoCategory);
          category = autoCategory;
        } else {
          recordIssue(
            categoryIssues,
            row.rowNumber,
            slug,
            "category-missing",
            `"${primaryCategory}" kategorisi bulunamadı.`,
            "category",
          );
        }
      } else if (category && category.slug !== resolved.slug) {
        recordIssue(
          categoryIssues,
          row.rowNumber,
          slug,
          "category-conflict",
          `Aynı ürün için farklı kategoriler yazılmış: "${category.title}" ve "${resolved.title}".`,
          "category",
        );
      } else {
        category = resolved;
      }
    } else if (!existingProduct && !category) {
      recordIssue(
        categoryIssues,
        row.rowNumber,
        slug,
        "category-required",
        "Kategori seçin.",
        "category",
      );
    }

    const selectedOptions: Array<{ name: string; value: string }> = [];
    for (let i = 0; i < 3; i++) {
      const nameKey = `opt${i + 1}Name` as "opt1Name" | "opt2Name" | "opt3Name";
      const valKey = `opt${i + 1}Val` as "opt1Val" | "opt2Val" | "opt3Val";
      const optionName = mapped[nameKey] || existingProduct?.options[i]?.name;
      const optionValue = mapped[valKey];
      if (optionName && optionValue) {
        const normN = optionName.toLocaleLowerCase("en-US").trim();
        const normV = optionValue.toLocaleLowerCase("en-US").trim();
        if (
          (normN === "title" || normN === "baslik") &&
          (normV === "default title" || normV === "varsayilan baslik")
        ) {
          continue;
        }
        selectedOptions.push({ name: optionName, value: optionValue });
      }
    }

    let product = existingProduct;
    if (!product) {
      product = {
        slug,
        title: title || slug,
        categoryValue: rawCategory || undefined,
        categorySlug: category?.slug,
        description: mapped.description || undefined,
        availableForSale: mapped.availableForSale !== undefined
          ? parseBooleanField(mapped.availableForSale)
          : true,
        attributes: [],
        options: [],
        variants: [],
        imageUrls: [],
        embeddedImages: [],
        rowNumbers: [row.rowNumber],
      };
      productMap.set(slug, product);
      attributeMaps.set(slug, new Map());
    } else {
      product.rowNumbers.push(row.rowNumber);
      if (!product.title && title) product.title = title;
      if (!product.categoryValue && rawCategory) product.categoryValue = rawCategory;
      if (!product.categorySlug && category) product.categorySlug = category.slug;
      if (!product.description && mapped.description) product.description = mapped.description;
    }

    if (category) {
      const columns = columnCache.get(category.slug) ?? attributeColumns(category, standardHeaders);
      columnCache.set(category.slug, columns);
      const values = attributeMaps.get(slug)!;
      for (const [header, definition] of columns) {
        const raw = normalizedCells.get(header);
        if (!raw) continue;
        const parsed = parseAttributeValue(definition, raw);
        if ("error" in parsed) {
          recordIssue(
            attributeIssues,
            row.rowNumber,
            slug,
            `attribute-${definition.key}`,
            parsed.error,
            "attribute",
          );
          continue;
        }
        if (!values.has(definition.key)) values.set(definition.key, parsed.value);
      }
    }

    for (const selected of selectedOptions) {
      const canonical = normalizedOption(product, selected.name, selected.value);
      selected.name = canonical.name;
      selected.value = canonical.value;
    }

    const variantTitle = mapped.variantTitle ||
      (selectedOptions.length > 0 ? selectedOptions.map((option) => option.value).join(" / ") : "Standart");

    let sku = mapped.sku
      ? mapped.sku.trim().toLocaleUpperCase("en-US")
      : [slug, ...selectedOptions.map((option) => slugify(option.value))].filter(Boolean).join("-").toLocaleUpperCase("en-US");
    if (!/^[A-Z0-9][A-Z0-9._-]{0,63}$/.test(sku)) {
      errors.push({ rowNumber: row.rowNumber, slug, error: `Geçersiz SKU: "${sku}". SKU sütununu kontrol edin.` });
      failedSlugs.add(slug);
      continue;
    }
    const barcode = mapped.barcode ? mapped.barcode.trim() : undefined;
    if (barcode && barcode.length > 64) {
      errors.push({ rowNumber: row.rowNumber, slug, error: "Barkod en fazla 64 karakter olabilir." });
      failedSlugs.add(slug);
      continue;
    }

    const skuOwner = skuOwners.get(sku);
    if (skuOwner !== undefined) {
      if (skuOwner === slug && !mapped.sku) {
        sku = `${sku}-${product.variants.length + 1}`;
      } else {
        errors.push({ rowNumber: row.rowNumber, slug, error: `${sku} SKU kodu dosyada birden fazla kez kullanılmış.` });
        failedSlugs.add(slug);
        continue;
      }
    }
    skuOwners.set(sku, slug);

    const combination = variantCombinationKey(selectedOptions);
    const combinations = combinationKeys.get(slug) ?? new Set<string>();
    if (combinations.has(combination)) {
      errors.push({ rowNumber: row.rowNumber, slug, error: "Aynı varyant kombinasyonu birden fazla satırda yer alıyor." });
      failedSlugs.add(slug);
      continue;
    }
    combinations.add(combination);
    combinationKeys.set(slug, combinations);

    product.variants.push({
      id: `${slug}-${product.variants.length + 1}`,
      title: variantTitle,
      sku,
      ...(barcode ? { barcode } : {}),
      price,
      ...(compareAtPrice ? { compareAtPrice } : {}),
      stockQuantity,
      selectedOptions,
    });

    const rowImages = parseImageUrls(mapped.images ?? "");
    for (const url of rowImages) {
      if (!product.imageUrls.includes(url)) product.imageUrls.push(url);
    }
    const embedded = embeddedImages.get(row.sheetRow) ?? [];
    product.embeddedImages.push(...embedded);
  }

  for (const product of productMap.values()) {
    const override = overrideBySlug.get(product.slug);
    const hasCategoryOverride = override?.categorySlug !== undefined;
    const hasAttributeOverride = override?.attributes !== undefined;
    let category: ImportCategory | null = null;

    if (hasCategoryOverride) {
      const nextSlug = override.categorySlug!.trim();
      category = nextSlug ? lookup.get(normalizeHeaderKey(nextSlug)) ?? null : null;
      if (!category) {
        errors.push({
          rowNumber: product.rowNumbers[0] ?? 0,
          slug: product.slug,
          error: nextSlug ? `Seçilen "${nextSlug}" kategorisi bulunamadı.` : "Kategori seçin.",
          scope: "category",
        });
        failedSlugs.add(product.slug);
      } else {
        product.categorySlug = category.slug;
      }
    } else {
      category = product.categorySlug ? lookup.get(normalizeHeaderKey(product.categorySlug)) ?? null : null;
      for (const issue of categoryIssues.get(product.slug) ?? []) {
        errors.push(issue);
        failedSlugs.add(product.slug);
      }
    }

    const values = new Map<string, ProductAttributeValue>();
    const invalidKeys = new Set<string>();

    if (hasAttributeOverride && category) {
      const definitions = new Map((category.attributes ?? []).map((definition) => [definition.key, definition]));
      for (const attribute of override.attributes!) {
        const definition = definitions.get(attribute.key);
        if (!definition) {
          errors.push({
            rowNumber: product.rowNumbers[0] ?? 0,
            slug: product.slug,
            error: `"${attribute.key}" özelliği ${category.title} kategorisinde tanımlı değil.`,
            scope: "attribute",
          });
          failedSlugs.add(product.slug);
          continue;
        }
        if (attributeValueIsEmpty(attribute.value)) continue;
        const problem = attributeValueProblem(definition, attribute.value);
        if (problem) {
          errors.push({
            rowNumber: product.rowNumbers[0] ?? 0,
            slug: product.slug,
            error: problem,
            scope: "attribute",
          });
          failedSlugs.add(product.slug);
          invalidKeys.add(definition.key);
          continue;
        }
        values.set(definition.key, attribute.value);
      }
    } else if (!hasAttributeOverride && !hasCategoryOverride) {
      for (const [key, value] of attributeMaps.get(product.slug) ?? []) values.set(key, value);
      for (const issue of attributeIssues.get(product.slug) ?? []) {
        errors.push(issue);
        failedSlugs.add(product.slug);
      }
    }

    product.attributes = [...values].map(([key, value]) => ({ key, value }));

    if (category) {
      for (const definition of category.attributes ?? []) {
        if (invalidKeys.has(definition.key)) continue;
        const value = values.get(definition.key);
        if (!attributeValueIsEmpty(value) || !definition.required) continue;
        const hasColumn = normalizedHeaders.has(normalizeHeaderKey(definition.label));
        errors.push({
          rowNumber: product.rowNumbers[0] ?? 0,
          slug: product.slug,
          error: hasAttributeOverride || hasColumn
            ? `${definition.label} alanı zorunludur (${category.title} kategorisi).`
            : `${definition.label} alanı zorunludur. Dosyaya "${definition.label}" sütunu ekleyin (${category.title} kategorisi).`,
          scope: "attribute",
        });
        failedSlugs.add(product.slug);
      }
    }

    const combinationCount = product.options.reduce((total, option) => total * option.values.length, 1);
    if (combinationCount > 100) {
      errors.push({
        rowNumber: product.rowNumbers[0] ?? 0,
        slug: product.slug,
        error: "Bir üründe en fazla 100 varyant kombinasyonu olabilir.",
        scope: "field",
      });
      failedSlugs.add(product.slug);
    }
    if (product.variants.some((variant) => variant.selectedOptions.length !== product.options.length)) {
      errors.push({
        rowNumber: product.rowNumbers[0] ?? 0,
        slug: product.slug,
        error: "Bazı satırlarda varyant seçenekleri eksik. Seçenek Adı ve Değeri sütunlarını her varyant satırında doldurun.",
        scope: "field",
      });
      failedSlugs.add(product.slug);
    }

    if (product.imageUrls.length + product.embeddedImages.length > MAX_IMPORT_IMAGES) {
      product.imageUrls = product.imageUrls.slice(0, MAX_IMPORT_IMAGES);
      product.embeddedImages = product.embeddedImages.slice(0, MAX_IMPORT_IMAGES - product.imageUrls.length);
    }
  }

  const allProducts = [...productMap.values()];
  const products = allProducts.filter((product) => !failedSlugs.has(product.slug));

  return {
    products,
    allProducts,
    errors,
    totalRows: table.rows.length,
    skippedProducts: allProducts.length - products.length,
    detectedSource,
  };
}
