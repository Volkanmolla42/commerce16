import * as XLSX from "xlsx";
import sharp from "sharp";
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { slugify } from "./slug";
import type { Id } from "@/convex/_generated/dataModel";

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
  categorySlug?: string;
  description?: string;
  availableForSale: boolean;
  options: ParsedOption[];
  variants: ParsedVariant[];
  imageUrls: string[];
  rowNumbers: number[];
};

export type RowError = {
  rowNumber: number;
  slug?: string;
  error: string;
};

export type ParseResult = {
  products: ParsedProduct[];
  errors: RowError[];
  totalRows: number;
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
  if (["urunadresi", "slug", "adres", "link", "url"].includes(normalized)) return "slug";
  if (["baslik", "title", "urunadi", "ad", "urun"].includes(normalized)) return "title";
  if (["kategori", "category", "kategoriadresi", "kategorislug"].includes(normalized)) return "categorySlug";
  if (["aciklama", "description", "detay", "icerik"].includes(normalized)) return "description";
  if (["satista", "available", "durum", "aktif", "satistami"].includes(normalized)) return "availableForSale";
  if (["varyantbasligi", "varianttitle", "varyant", "varyantadi"].includes(normalized)) return "variantTitle";
  if (["sku", "stokkodu", "kod", "urunkodu"].includes(normalized)) return "sku";
  if (["barkod", "barcode", "gtin", "ean"].includes(normalized)) return "barcode";
  if (["fiyat", "satisfiyati", "price", "tutar", "fiyattl", "satisfiyatitl"].includes(normalized)) return "price";
  if (["listefiyati", "eskifiyat", "piyasafiyati", "compareatprice", "listefiyatitl", "eskifiyattl", "piyasafiyatitl"].includes(normalized)) return "compareAtPrice";
  if (["stok", "stock", "stokadedi", "adet", "miktar"].includes(normalized)) return "stockQuantity";
  if (["secenek1adi", "option1name", "ozellik1adi"].includes(normalized)) return "opt1Name";
  if (["secenek1degeri", "option1value", "ozellik1degeri"].includes(normalized)) return "opt1Val";
  if (["secenek2adi", "option2name", "ozellik2adi"].includes(normalized)) return "opt2Name";
  if (["secenek2degeri", "option2value", "ozellik2degeri"].includes(normalized)) return "opt2Val";
  if (["gorseller", "gorselurl", "resimler", "resimurl", "images", "imageurl", "gorsel"].includes(normalized)) return "images";
  return null;
}

function parseBooleanField(val: unknown): boolean {
  if (typeof val === "boolean") return val;
  const str = String(val ?? "").trim().toLocaleLowerCase("tr-TR");
  if (["evet", "true", "1", "aktif", "active", "yes", "y"].includes(str)) return true;
  if (["hayir", "false", "0", "pasif", "inactive", "no", "n"].includes(str)) return false;
  return true; // Varsayılan satışta
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

async function isPrivateHost(hostname: string): Promise<boolean> {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return true;
  }
  if (isIP(host)) return isPrivateAddress(host);
  try {
    const addresses = await lookup(host, { all: true, verbatim: true });
    return addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address));
  } catch {
    return true;
  }
}

function parseCsvRows(text: string): Array<Record<string, unknown>> {
  const clean = text.replace(/^\uFEFF/, "");
  const lines = clean.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  const firstLine = lines[0];
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const delimiter = semicolonCount >= commaCount ? ";" : ",";

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows: Array<Record<string, unknown>> = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseLine(lines[i]);
    const row: Record<string, unknown> = {};
    for (let h = 0; h < headers.length; h++) {
      row[headers[h]] = cells[h] ?? "";
    }
    rows.push(row);
  }
  return rows;
}

export function parseProductSpreadsheet(buffer: Buffer): ParseResult {
  let rawRows: Array<Record<string, unknown>> = [];

  const isZip = buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
  if (!isZip) {
    try {
      const text = buffer.toString("utf8");
      rawRows = parseCsvRows(text);
    } catch {
      rawRows = [];
    }
  }

  if (rawRows.length === 0) {
    try {
      const workbook = XLSX.read(buffer, { type: "buffer", sheetRows: 5000 });
      const sheetName = workbook.SheetNames[0];
      if (sheetName) {
        const sheet = workbook.Sheets[sheetName];
        rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      }
    } catch {
      rawRows = [];
    }
  }

  if (rawRows.length === 0) {
    return { products: [], errors: [{ rowNumber: 1, error: "Tabloda veri satırı bulunamadı." }], totalRows: 0 };
  }

  const errors: RowError[] = [];
  const productMap = new Map<string, ParsedProduct>();

  rawRows.forEach((row, index) => {
    const rowNumber = index + 2; // 1-indexed, satır 1 başlık

    // Eşleşen alanları çıkar
    const mapped: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      const field = matchColumn(key);
      if (field && mapped[field] === undefined) {
        mapped[field] = String(value ?? "").trim();
      }
    }

    let slug = mapped.slug ? slugify(mapped.slug) : "";
    const title = mapped.title || "";

    if (!slug && title) {
      slug = slugify(title);
    }

    if (!slug) {
      errors.push({ rowNumber, error: "Ürün adresi (slug) veya başlık belirtilmeli." });
      return;
    }

    const priceRaw = mapped.price ? mapped.price.replace(",", ".") : "";
    const priceNum = Number(priceRaw);
    if (!priceRaw || isNaN(priceNum) || priceNum < 0) {
      errors.push({ rowNumber, slug, error: `Geçersiz satış fiyatı: "${mapped.price}"` });
      return;
    }
    const price = priceNum.toFixed(2);

    let compareAtPrice: string | undefined = undefined;
    if (mapped.compareAtPrice) {
      const compareRaw = mapped.compareAtPrice.replace(",", ".");
      const compareNum = Number(compareRaw);
      if (isNaN(compareNum) || compareNum <= priceNum) {
        errors.push({ rowNumber, slug, error: `Liste fiyatı (${mapped.compareAtPrice}) satış fiyatından (${price}) büyük olmalı.` });
        return;
      }
      compareAtPrice = compareNum.toFixed(2);
    }

    const stockRaw = mapped.stockQuantity || "0";
    const stockNum = parseInt(stockRaw, 10);
    const stockQuantity = isNaN(stockNum) || stockNum < 0 ? 0 : stockNum;

    // Seçenekler
    const selectedOptions: Array<{ name: string; value: string }> = [];
    if (mapped.opt1Name && mapped.opt1Val) {
      selectedOptions.push({ name: mapped.opt1Name, value: mapped.opt1Val });
    }
    if (mapped.opt2Name && mapped.opt2Val) {
      selectedOptions.push({ name: mapped.opt2Name, value: mapped.opt2Val });
    }

    const variantTitle = mapped.variantTitle ||
      (selectedOptions.length > 0 ? selectedOptions.map((o) => o.value).join(" / ") : "Standart");

    const sku = mapped.sku ? mapped.sku.trim().toLocaleUpperCase("en-US") : `${slug.toUpperCase()}-${selectedOptions.map((o) => o.value).join("-") || "DEFAULT"}`;
    const barcode = mapped.barcode ? mapped.barcode.trim() : undefined;

    // Görseller
    const rowImages = mapped.images
      ? mapped.images.split(/[\s,]+/).map((u) => u.trim()).filter(Boolean)
      : [];

    let product = productMap.get(slug);
    if (!product) {
      product = {
        slug,
        title: title || slug,
        categorySlug: mapped.categorySlug ? slugify(mapped.categorySlug) : undefined,
        description: mapped.description || undefined,
        availableForSale: mapped.availableForSale !== undefined ? parseBooleanField(mapped.availableForSale) : true,
        options: [],
        variants: [],
        imageUrls: rowImages,
        rowNumbers: [rowNumber],
      };
      productMap.set(slug, product);
    } else {
      product.rowNumbers.push(rowNumber);
      if (!product.title && title) product.title = title;
      if (!product.categorySlug && mapped.categorySlug) product.categorySlug = slugify(mapped.categorySlug);
      if (!product.description && mapped.description) product.description = mapped.description;
      if (rowImages.length > 0 && product.imageUrls.length === 0) {
        product.imageUrls = rowImages;
      }
    }

    // Seçenekleri ürünün options dizisine ekle
    for (const so of selectedOptions) {
      let option = product.options.find((o) => o.name === so.name);
      if (!option) {
        option = { id: slugify(so.name), name: so.name, values: [] };
        product.options.push(option);
      }
      if (!option.values.includes(so.value)) {
        option.values.push(so.value);
      }
    }

    // Varyantı ekle
    product.variants.push({
      id: `${slug}-${product.variants.length + 1}`,
      title: variantTitle,
      sku,
      barcode,
      price,
      compareAtPrice,
      stockQuantity,
      selectedOptions,
    });
  });

  return {
    products: Array.from(productMap.values()),
    errors,
    totalRows: rawRows.length,
  };
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

    const webpBuffer = await sharp(Buffer.from(arrayBuf))
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    return webpBuffer;
  } catch {
    return null;
  }
}

export type StorageImageResult = {
  storageId: Id<"_storage">;
  fileName: string;
};
