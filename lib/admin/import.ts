import * as XLSX from "xlsx";
import sharp from "sharp";
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { slugify } from "./slug";
import type { Id } from "@/convex/_generated/dataModel";
import type {
  CategoryAttributeDefinition,
  ProductAttribute,
  ProductAttributeValue,
} from "@/lib/catalog/attributes";

export const MAX_IMPORT_IMAGES = 8;

export type ParsedVariant = {
  id: string;
  title: string;
  sku: string;
  barcode?: string;
  price: string;
  compareAtPrice?: string;
  stockQuantity: number;
  selectedOptions: Array<{ name: string; value: string }>;
};

export type ParsedOption = {
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

export type ImportSource = "shopify" | "woocommerce" | "standard";

export type ParseResult = {
  products: ParsedProduct[];
  allProducts: ParsedProduct[];
  errors: RowError[];
  totalRows: number;
  skippedProducts: number;
  detectedSource: ImportSource;
};

type SheetRow = {
  rowNumber: number;
  sheetRow: number;
  cells: string[];
};

type SheetTable = {
  headers: string[];
  rows: SheetRow[];
};

function normalizeHeaderKey(header: string): string {
  return header
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

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

function parseBooleanField(val: unknown): boolean {
  if (typeof val === "boolean") return val;
  const str = String(val ?? "").trim().toLocaleLowerCase("tr-TR");
  if (["evet", "true", "1", "aktif", "active", "yes", "y", "publish"].includes(str)) return true;
  if (["hayir", "false", "0", "pasif", "inactive", "no", "n", "archived", "draft", "taslak", "arsiv"].includes(str)) return false;
  return true;
}

function parseAttributeBoolean(value: string): boolean | null {
  const str = value.trim().toLocaleLowerCase("tr-TR");
  if (["evet", "true", "1", "aktif", "active", "yes", "y", "var"].includes(str)) return true;
  if (["hayir", "false", "0", "pasif", "inactive", "no", "n", "yok"].includes(str)) return false;
  return null;
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

function categoryKey(value: string): string {
  return normalizeHeaderKey(value);
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

export function extractCategoryLeaf(value: string): string {
  const segments = extractCategorySegments(value);
  return segments[segments.length - 1] ?? value.trim();
}

export function extractCategoryRoot(value: string): string {
  const segments = extractCategorySegments(value);
  return segments[0] ?? value.trim();
}

function categoryLookup(categories: ImportCategory[]): Map<string, ImportCategory> {
  const lookup = new Map<string, ImportCategory>();
  for (const category of categories) lookup.set(categoryKey(category.slug), category);
  for (const category of categories) {
    const titleKey = categoryKey(category.title);
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
    const labelKey = categoryKey(definition.label);
    const keyKey = categoryKey(definition.key);
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
    const value = parseAttributeBoolean(raw);
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
      const match = allowed.find((option) => categoryKey(option) === categoryKey(part));
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

function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b, c] = address.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0 && (c === 0 || c === 2)) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113);
  }
  if (isIP(address) === 6) {
    const host = address.toLowerCase();
    const mapped = host.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]!);
    return host === "::" || host === "::1" ||
      /^f[cd]/.test(host) || /^fe[89ab]/.test(host) || /^ff/.test(host);
  }
  return false;
}

const hostResolutionCache = new Map<string, boolean>();

async function isPrivateHost(hostname: string): Promise<boolean> {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return true;
  }
  if (isIP(host)) return isPrivateAddress(host);
  if (hostResolutionCache.has(host)) return hostResolutionCache.get(host)!;
  try {
    const addresses = await lookup(host, { all: true, verbatim: true });
    const isPrivate = addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address));
    hostResolutionCache.set(host, isPrivate);
    return isPrivate;
  } catch {
    return true;
  }
}

function detectDelimiter(text: string): string {
  let semicolon = 0;
  let comma = 0;
  let quoted = false;
  for (let i = 0; i < text.length && i < 2000; i++) {
    const char = text[i];
    if (char === '"') quoted = !quoted;
    else if (!quoted) {
      if (char === "\n" || char === "\r") break;
      if (char === ";") semicolon++;
      else if (char === ",") comma++;
    }
  }
  return semicolon >= comma && semicolon > 0 ? ";" : ",";
}

function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const len = text.length;

  for (let i = 0; i < len; i++) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\r" || char === "\n") && !inQuotes) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim());
      cell = "";
      if (row.some((c) => c.length > 0)) {
        rows.push(row);
      }
      row = [];
    } else {
      cell += char;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    if (row.some((c) => c.length > 0)) {
      rows.push(row);
    }
  }
  return rows;
}

function decodeCsvBuffer(buffer: Buffer): string {
  const utf8 = buffer.toString("utf8");
  if (!utf8.includes("\uFFFD")) return utf8;
  try {
    return new TextDecoder("windows-1254").decode(buffer);
  } catch {
    return utf8;
  }
}

function readCsvTable(text: string): SheetTable {
  const delimiter = detectDelimiter(text);
  const matrix = parseCsv(text, delimiter);
  if (matrix.length === 0) return { headers: [], rows: [] };

  const headers = matrix[0] ?? [];
  const rows: SheetRow[] = [];
  for (let index = 1; index < matrix.length; index++) {
    rows.push({
      rowNumber: index + 1,
      sheetRow: index,
      cells: matrix[index] ?? [],
    });
  }
  return { headers, rows };
}

export function detectSpreadsheetSource(headers: string[]): ImportSource {
  const normalized = new Set(headers.map(normalizeHeaderKey));
  if (normalized.has("handle") || normalized.has("variantprice") || normalized.has("bodyhtml")) {
    return "shopify";
  }
  if (normalized.has("posttitle") || normalized.has("taxproductcat") || normalized.has("regularprice")) {
    return "woocommerce";
  }
  return "standard";
}

function tableFromMatrix(matrix: unknown[][]): SheetTable {
  const nonEmpty = (row: unknown[] | undefined) =>
    Boolean(row?.some((cell) => String(cell ?? "").trim().length > 0));

  const headerIndex = matrix.findIndex(nonEmpty);
  if (headerIndex < 0) return { headers: [], rows: [] };

  const headers = (matrix[headerIndex] ?? []).map((cell) => String(cell ?? "").trim());
  const rows: SheetRow[] = [];
  for (let index = headerIndex + 1; index < matrix.length; index++) {
    if (!nonEmpty(matrix[index])) continue;
    rows.push({
      rowNumber: index + 1,
      sheetRow: index,
      cells: headers.map((_, column) => String(matrix[index]?.[column] ?? "").trim()),
    });
  }
  return { headers, rows };
}

function readTable(buffer: Buffer): { table: SheetTable; embedded: Map<number, Buffer[]> } {
  const isZip = buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
  const isLegacyXls = buffer.length > 4 && buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0;

  if (!isZip && !isLegacyXls) {
    return {
      table: readCsvTable(decodeCsvBuffer(buffer).replace(/^\uFEFF/, "")),
      embedded: new Map(),
    };
  }

  const workbook = XLSX.read(buffer, { type: "buffer", sheetRows: 5000 });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { table: { headers: [], rows: [] }, embedded: new Map() };
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
    header: 1,
    defval: "",
    blankrows: true,
  });

  return {
    table: tableFromMatrix(matrix),
    embedded: isZip ? extractEmbeddedImagesByRow(buffer) : new Map(),
  };
}

function resolveZipPath(baseDir: string, target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  const parts = `${baseDir}/${target}`.split("/");
  const stack: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") stack.pop();
    else stack.push(part);
  }
  return stack.join("/");
}

function relationshipTarget(xml: string, id: string): string | undefined {
  const tag = [...xml.matchAll(/<Relationship\b[^>]*>/g)]
    .map((match) => match[0])
    .find((entry) => new RegExp(`\\bId="${id}"`).test(entry));
  return tag ? /Target="([^"]+)"/.exec(tag)?.[1] : undefined;
}

function extractEmbeddedImagesByRow(buffer: Buffer): Map<number, Buffer[]> {
  const result = new Map<number, Buffer[]>();
  try {
    const zip = XLSX.CFB.read(buffer, { type: "buffer" });
    const files = new Map<string, Buffer>();
    for (let index = 0; index < zip.FileIndex.length; index++) {
      const entry = zip.FileIndex[index];
      const path = String(zip.FullPaths[index] ?? "").replace(/^Root Entry\//, "");
      if (!entry.content || !path) continue;
      files.set(path, Buffer.from(entry.content));
    }

    const workbookXml = files.get("xl/workbook.xml")?.toString("utf8") ?? "";
    const firstSheetId = /<sheet\b[^>]*r:id="([^"]+)"/.exec(workbookXml)?.[1];
    const workbookRels = files.get("xl/_rels/workbook.xml.rels")?.toString("utf8") ?? "";
    const sheetTarget = firstSheetId
      ? relationshipTarget(workbookRels, firstSheetId)
      : undefined;
    if (!sheetTarget) return result;
    const sheetPath = resolveZipPath("xl", sheetTarget);
    const sheetFile = sheetPath.split("/").pop() ?? "";
    const sheetRels = files.get(`xl/worksheets/_rels/${sheetFile}.rels`)?.toString("utf8") ?? "";

    const drawingTargets = [...sheetRels.matchAll(/<Relationship\b[^>]*>/g)]
      .map((match) => match[0])
      .filter((tag) => /Type="[^"]*\/drawing"/.test(tag))
      .map((tag) => /Target="([^"]+)"/.exec(tag)?.[1])
      .filter((target): target is string => Boolean(target));

    for (const drawingTarget of drawingTargets) {
      const drawingPath = resolveZipPath("xl/worksheets", drawingTarget);
      const drawingFile = drawingPath.split("/").pop() ?? "";
      const drawingXml = files.get(drawingPath)?.toString("utf8") ?? "";
      const drawingRels = files.get(`xl/drawings/_rels/${drawingFile}.rels`)?.toString("utf8") ?? "";

      for (const anchor of drawingXml.split(/<xdr:(?:twoCellAnchor|oneCellAnchor)\b/).slice(1)) {
        const row = Number(/<xdr:row>(\d+)<\/xdr:row>/.exec(anchor)?.[1]);
        if (!Number.isInteger(row) || row < 0) continue;
        for (const blip of anchor.matchAll(/r:embed="([^"]+)"/g)) {
          const target = relationshipTarget(drawingRels, blip[1]!);
          if (!target) continue;
          const media = files.get(resolveZipPath("xl/drawings", target));
          if (!media || media.length === 0) continue;
          const rowImages = result.get(row) ?? [];
          rowImages.push(media);
          result.set(row, rowImages);
        }
      }
    }
  } catch {
    return result;
  }
  return result;
}

function variantCombinationKey(selectedOptions: Array<{ name: string; value: string }>) {
  return JSON.stringify(
    [...selectedOptions]
      .map((option) => ({ name: categoryKey(option.name), value: option.value }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  );
}

function normalizedOption(
  product: ParsedProduct,
  name: string,
  value: string,
): { name: string; value: string } {
  const existing = product.options.find((option) => categoryKey(option.name) === categoryKey(name));
  const option = existing ?? { id: slugify(name), name, values: [] };
  if (!existing) product.options.push(option);
  const existingValue = option.values.find((entry) => categoryKey(entry) === categoryKey(value));
  if (existingValue === undefined) option.values.push(value);
  return { name: option.name, value: existingValue ?? value };
}

function parseImageUrls(value: string): string[] {
  return value
    .split(/[\s,;]+/)
    .map((url) => url.trim())
    .filter((url) => /^https?:\/\//i.test(url));
}

export function parseProductSpreadsheet(
  buffer: Buffer,
  categories: ImportCategory[] = [],
  overrides: ProductOverride[] = [],
): ParseResult {
  let table: SheetTable = { headers: [], rows: [] };
  let embeddedImages = new Map<number, Buffer[]>();
  try {
    const parsed = readTable(buffer);
    table = parsed.table;
    embeddedImages = parsed.embedded;
  } catch {
    return {
      products: [],
      allProducts: [],
      errors: [{ rowNumber: 1, error: "Dosya okunamadı. Geçerli bir Excel veya CSV dosyası seçin.", scope: "field" }],
      totalRows: 0,
      skippedProducts: 0,
      detectedSource: "standard",
    };
  }

  if (table.rows.length === 0) {
    return {
      products: [],
      allProducts: [],
      errors: [{ rowNumber: 1, error: "Tabloda veri satırı bulunamadı.", scope: "field" }],
      totalRows: 0,
      skippedProducts: 0,
      detectedSource: "standard",
    };
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
      if (segSlug && !lookup.has(categoryKey(segSlug)) && !lookup.has(categoryKey(seg))) {
        const segCategory: ImportCategory = { slug: segSlug, title: seg, attributes: [] };
        lookup.set(categoryKey(segSlug), segCategory);
        lookup.set(categoryKey(seg), segCategory);
      }
    }

    let category: ImportCategory | null = existingProduct?.categorySlug
      ? lookup.get(categoryKey(existingProduct.categorySlug)) ?? null
      : null;

    if (rawCategory) {
      const resolved = lookup.get(categoryKey(primaryCategory)) ??
        lookup.get(categoryKey(rawCategory)) ??
        (leafCategory ? lookup.get(categoryKey(leafCategory)) : null) ?? null;
      if (!resolved) {
        const autoTitle = primaryCategory;
        const autoSlug = slugify(autoTitle);
        if (autoSlug) {
          const autoCategory: ImportCategory = { slug: autoSlug, title: autoTitle, attributes: [] };
          lookup.set(categoryKey(autoSlug), autoCategory);
          lookup.set(categoryKey(autoTitle), autoCategory);
          lookup.set(categoryKey(rawCategory), autoCategory);
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
      category = nextSlug ? lookup.get(categoryKey(nextSlug)) ?? null : null;
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
      category = product.categorySlug ? lookup.get(categoryKey(product.categorySlug)) ?? null : null;
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
        const hasColumn = normalizedHeaders.has(categoryKey(definition.label));
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

export async function optimizeImageBuffer(buffer: Buffer): Promise<Buffer | null> {
  try {
    return await sharp(buffer)
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80, effort: 3 })
      .toBuffer();
  } catch {
    return null;
  }
}

export async function imagePreviewDataUrl(buffer: Buffer): Promise<string | null> {
  try {
    const thumbnail = await sharp(buffer)
      .resize({ width: 120, height: 120, fit: "cover" })
      .webp({ quality: 60 })
      .toBuffer();
    return `data:image/webp;base64,${thumbnail.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function downloadAndOptimizeImage(url: string): Promise<Buffer | null> {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (await isPrivateHost(parsed.hostname)) return null;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      redirect: "manual",
      headers: { "User-Agent": "Commerce16-Importer/1.0" },
    });

    if (res.status >= 300 && res.status < 400) return null;
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) return null;

    const contentLength = Number(res.headers.get("content-length"));
    if (contentLength && contentLength > 10 * 1024 * 1024) return null;

    const arrayBuf = await res.arrayBuffer();
    if (arrayBuf.byteLength > 10 * 1024 * 1024) return null;

    return await optimizeImageBuffer(Buffer.from(arrayBuf));
  } catch {
    return null;
  }
}

export type StorageImageResult = {
  storageId: Id<"_storage">;
  fileName: string;
};
