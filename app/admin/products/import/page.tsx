"use client";

/* eslint-disable @next/next/no-img-element */

import { useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ArrowUpTrayIcon,
  CheckCircleIcon,
  CheckIcon,
  ChevronDownIcon,
  DocumentArrowDownIcon,
  DocumentTextIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  PhotoIcon,
  PlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AdminNotice } from "../../_components/admin-primitives";
import { AdminHeaderAction } from "../../_components/admin-header-action";
import { CategoryEditor } from "../../categories/_components/category-editor";
import { slugify } from "@/lib/admin/slug";
import { formatMoney } from "@/lib/format-money";
import { adminPath } from "@/lib/admin/routes";
import type { CategoryAttributeDefinition, ProductAttribute } from "@/lib/catalog/attributes";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = [".csv", ".xlsx", ".xls"];
const ERROR_DISPLAY_LIMIT = 200;

type ErrorScope = "field" | "category" | "attribute";
type RowFilter = "all" | "ready" | "problem" | "new" | "update";

type ImportError = {
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

type PreviewResult = {
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

type ImportResult = {
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

type Step = "select" | "preview" | "importing" | "result";

type RowState = {
  categorySlug: string;
  values: Record<string, string | string[]>;
};

type RowValidation = {
  messages: string[];
  fieldErrors: ImportError[];
  ready: boolean;
};

type TableRow = {
  product: PreviewProduct;
  edit: RowState;
  category: CategoryOption | undefined;
  categoryMessage: string | null;
  attributeErrors: Record<string, string[]>;
  validation: RowValidation;
};

function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function toEditorValue(value: ProductAttribute["value"]): string | string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function defaultRowState(product: PreviewProduct): RowState {
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

function attributeMessages(attribute: CategoryAttributeDefinition, raw: string | string[] | undefined) {
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

function buildOverrides(
  products: PreviewProduct[],
  edits: Record<string, RowState>,
  categories: CategoryOption[],
) {
  const categoryBySlug = new Map(categories.map((category) => [category.slug, category]));
  return products.map((product) => {
    const state = edits[product.slug] ?? defaultRowState(product);
    const category = categoryBySlug.get(state.categorySlug);
    return {
      slug: product.slug,
      categorySlug: state.categorySlug,
      attributes: category ? buildAttributes(category.attributes ?? [], state.values) : [],
    };
  });
}

function getImportStatusMessage(progress: number): string {
  if (progress < 25) return "Dosya taranıyor ve kategoriler hazırlanıyor…";
  if (progress < 60) return "Ürün görselleri indiriliyor ve WebP formatına dönüştürülüyor…";
  if (progress < 85) return "Varyantlar, stoklar ve özellikler kaydediliyor…";
  if (progress < 100) return "Veritabanı kayıtları tamamlanıyor…";
  return "Aktarım tamamlandı!";
}

function StepIndicator({ currentStep }: { currentStep: Step }) {
  const steps = [
    { label: "Dosya Yükle", desc: "Excel veya CSV seçimi" },
    { label: "Kontrol ve Düzenleme", desc: "Ürün & kategori eşleme" },
    { label: "Sonuç", desc: "Aktarım özeti" },
  ];
  const activeIdx = currentStep === "select" ? 0 : currentStep === "preview" || currentStep === "importing" ? 1 : 2;

  return (
    <div className="flex items-center rounded-2xl border border-border bg-card p-4 sm:px-6">
      <div className="flex flex-wrap items-center gap-3 sm:gap-6">
        {steps.map((st, idx) => {
          const isDone = idx < activeIdx || (idx === 2 && currentStep === "result");
          const isActive = idx === activeIdx && !(idx === 2 && currentStep === "result");
          return (
            <div key={st.label} className="flex items-center gap-2.5">
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                  isDone
                    ? "bg-primary text-primary-foreground"
                    : isActive
                      ? "border-2 border-primary bg-primary/10 text-primary font-bold"
                      : "border border-border bg-muted/50 text-muted-foreground"
                }`}
              >
                {isDone ? <CheckIcon className="size-4 stroke-[2.5]" aria-hidden="true" /> : idx + 1}
              </span>
              <div>
                <p className={`text-xs font-medium leading-none ${isActive ? "text-foreground font-semibold" : isDone ? "text-foreground" : "text-muted-foreground"}`}>
                  {st.label}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground hidden md:block">{st.desc}</p>
              </div>
              {idx < steps.length - 1 && (
                <div className="h-px w-6 sm:w-10 bg-border ml-2" aria-hidden="true" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActionBadge({ exists }: { exists: boolean }) {
  return (
    <Badge
      variant="outline"
      className={`h-5 gap-1 px-2 py-0 text-[10px] font-medium ${
        exists
          ? "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-400"
          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
      }`}
    >
      {exists ? (
        <ArrowPathIcon className="size-3" aria-hidden="true" />
      ) : (
        <PlusIcon className="size-3" aria-hidden="true" />
      )}
      {exists ? "Güncellenecek" : "Yeni Ürün"}
    </Badge>
  );
}

function AttributeEditor({
  attribute,
  value,
  error,
  onChange,
}: {
  attribute: CategoryAttributeDefinition;
  value: string | string[] | undefined;
  error?: string;
  onChange: (next: string | string[]) => void;
}) {
  const controlClass = `h-9 w-full rounded-lg border bg-background px-3 text-xs text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/30 ${
    error ? "border-amber-500/60 ring-1 ring-amber-500/20" : "border-input hover:border-border focus-visible:border-ring"
  }`;

  if (attribute.type === "multiselect") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className="space-y-1.5">
        <span className="block text-xs font-medium text-foreground">
          {attribute.label}
          {attribute.required && <span className="text-destructive font-bold"> *</span>}
        </span>
        <div
          role="group"
          aria-label={attribute.label}
          className={`flex max-h-28 flex-wrap gap-1.5 overflow-y-auto rounded-lg border bg-background p-2 ${
            error ? "border-amber-500/60 ring-1 ring-amber-500/20" : "border-input"
          }`}
        >
          {(attribute.options ?? []).map((option) => {
            const active = selected.includes(option);
            return (
              <button
                key={option}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  onChange(active ? selected.filter((item) => item !== option) : [...selected, option])
                }
                className={`rounded-md border px-2.5 py-1 text-xs transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${
                  active
                    ? "border-primary bg-primary text-primary-foreground font-medium shadow-2xs"
                    : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
        {error && <span className="block text-[11px] leading-4 text-amber-600 dark:text-amber-400 font-medium">{error}</span>}
      </div>
    );
  }

  return (
    <label className="block space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="block text-xs font-medium text-foreground">
          {attribute.label}
          {attribute.required && <span className="text-destructive font-bold"> *</span>}
        </span>
        {attribute.unit && (
          <span className="text-[10px] text-muted-foreground font-mono">Birim: {attribute.unit}</span>
        )}
      </div>

      {attribute.type === "boolean" ? (
        <select
          aria-label={attribute.label}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          className={`${controlClass} cursor-pointer`}
        >
          <option value="">Seçilmedi</option>
          <option value="true">Evet</option>
          <option value="false">Hayır</option>
        </select>
      ) : attribute.type === "select" ? (
        <select
          aria-label={attribute.label}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          className={`${controlClass} cursor-pointer`}
        >
          <option value="">Seçiniz</option>
          {(attribute.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          aria-label={attribute.label}
          type={attribute.type === "number" ? "number" : "text"}
          inputMode={attribute.type === "number" ? "decimal" : undefined}
          maxLength={attribute.type === "text" ? 500 : undefined}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder={attribute.type === "number" && attribute.unit ? `Örn: 10 ${attribute.unit}` : undefined}
          className={controlClass}
        />
      )}
      {error && <span className="block text-[11px] leading-4 text-amber-600 dark:text-amber-400 font-medium">{error}</span>}
    </label>
  );
}

export default function ProductImportPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const requestIdRef = useRef(0);
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<Step>("select");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [edits, setEdits] = useState<Record<string, RowState>>({});
  const [expandedSlugs, setExpandedSlugs] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<RowFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitErrors, setSubmitErrors] = useState<ImportError[]>([]);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [categoryEditorOpen, setCategoryEditorOpen] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  const reset = () => {
    requestIdRef.current++;
    setFile(null);
    setStep("select");
    setPreview(null);
    setEdits({});
    setExpandedSlugs({});
    setFilter("all");
    setSearchQuery("");
    setResult(null);
    setError(null);
    setSubmitErrors([]);
    setLoading(false);
    setDragActive(false);
    setCategoryEditorOpen(false);
    setImportProgress(0);
    if (inputRef.current) inputRef.current.value = "";
  };

  const loadPreview = async (selected: File) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    setSubmitErrors([]);
    setPreview(null);
    setEdits({});
    setExpandedSlugs({});
    setFilter("all");
    setSearchQuery("");
    setStep("select");

    try {
      const formData = new FormData();
      formData.append("file", selected);
      formData.append("dryRun", "true");
      const response = await fetch("/api/admin/products/import", { method: "POST", body: formData });
      const data = (await response.json().catch(() => null)) as (PreviewResult & { error?: string }) | null;
      if (requestId !== requestIdRef.current) return;
      if (!response.ok || !data) {
        setError(data?.error || "Dosya incelenemedi. Lütfen dosya formatını ve içeriğini kontrol edin.");
      } else {
        const nextEdits: Record<string, RowState> = {};
        for (const product of data.products) nextEdits[product.slug] = defaultRowState(product);
        setEdits(nextEdits);
        setPreview(data);
        setStep("preview");
      }
    } catch {
      if (requestId === requestIdRef.current) {
        setError("Dosya incelenemedi. Sunucu bağlantısını kontrol edip tekrar deneyin.");
      }
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  };

  const selectFile = (selected: File) => {
    if (loading) return;
    const extension = selected.name.slice(selected.name.lastIndexOf(".")).toLocaleLowerCase("tr-TR");
    if (!ACCEPTED_EXTENSIONS.includes(extension)) {
      setFile(null);
      setPreview(null);
      setStep("select");
      setError("Yalnızca .xlsx, .xls veya .csv uzantılı tablolar içe aktarılabilir.");
      return;
    }
    if (selected.size === 0) {
      setFile(null);
      setPreview(null);
      setStep("select");
      setError("Seçilen dosya boş görünüyor.");
      return;
    }
    if (selected.size > MAX_FILE_SIZE) {
      setFile(null);
      setPreview(null);
      setStep("select");
      setError("Dosya boyutu en fazla 20 MB olabilir.");
      return;
    }
    setFile(selected);
    setResult(null);
    void loadPreview(selected);
  };

  const changeCategory = (slug: string, nextCategory: string, fallback: RowState) => {
    setEdits((current) => {
      const existing = current[slug] ?? fallback;
      return {
        ...current,
        [slug]: {
          categorySlug: nextCategory,
          values: existing.categorySlug === nextCategory ? existing.values : {},
        },
      };
    });
  };

  const updateValue = (slug: string, key: string, value: string | string[], fallback: RowState) => {
    setEdits((current) => {
      const existing = current[slug] ?? fallback;
      return {
        ...current,
        [slug]: { ...existing, values: { ...existing.values, [key]: value } },
      };
    });
  };

  const toggleExpand = (slug: string) => {
    setExpandedSlugs((prev) => ({
      ...prev,
      [slug]: !prev[slug],
    }));
  };

  const toggleAllExpanded = (allRows: TableRow[]) => {
    const hasAnyCollapsed = allRows.some((row) => !expandedSlugs[row.product.slug]);
    const next: Record<string, boolean> = {};
    for (const row of allRows) {
      next[row.product.slug] = hasAnyCollapsed;
    }
    setExpandedSlugs(next);
  };

  const executeImport = async () => {
    if (!file || !preview) return;
    setLoading(true);
    setError(null);
    setSubmitErrors([]);
    setStep("importing");
    setImportProgress(10);

    const interval = setInterval(() => {
      setImportProgress((prev) => {
        if (prev >= 92) return 92;
        const remaining = 92 - prev;
        const stepAmount = Math.max(0.6, remaining * 0.08);
        return Math.min(92, prev + stepAmount);
      });
    }, 350);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("dryRun", "false");
      formData.append("overrides", JSON.stringify(buildOverrides(preview.products, edits, preview.categoryOptions)));
      const response = await fetch("/api/admin/products/import", { method: "POST", body: formData });
      const data = (await response.json().catch(() => null)) as ImportResult | null;
      clearInterval(interval);

      if (!response.ok || !data) {
        setImportProgress(0);
        setError(data?.error || "İçe aktarma sırasında bir sorun oluştu.");
        setSubmitErrors(data?.errors ?? []);
        setStep("preview");
      } else {
        setImportProgress(100);
        await new Promise((resolve) => setTimeout(resolve, 350));
        setResult(data);
        setSubmitErrors([]);
        setStep("result");
      }
    } catch {
      clearInterval(interval);
      setImportProgress(0);
      setError("İçe aktarma tamamlanamadı. Bağlantınızı kontrol edip tekrar deneyin.");
      setStep("preview");
    } finally {
      setLoading(false);
    }
  };

  const dropHandlers = {
    onDragOver: (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (!loading) setDragActive(true);
    },
    onDragLeave: (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
      setDragActive(false);
    },
    onDrop: (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragActive(false);
      const dropped = event.dataTransfer.files?.[0];
      if (dropped) selectFile(dropped);
    },
  };

  const categoryBySlug = new Map((preview?.categoryOptions ?? []).map((category) => [category.slug, category]));
  const errorsBySlug = new Map<string, ImportError[]>();
  for (const item of preview?.errors ?? []) {
    if (!item.slug) continue;
    errorsBySlug.set(item.slug, [...(errorsBySlug.get(item.slug) ?? []), item]);
  }


  const rows: TableRow[] = (preview?.products ?? []).map((product) => {
    const edit = edits[product.slug] ?? defaultRowState(product);
    const category = categoryBySlug.get(edit.categorySlug);
    const fieldErrors = (errorsBySlug.get(product.slug) ?? []).filter(
      (item) => item.scope !== "category" && item.scope !== "attribute",
    );
    const attributeErrors: Record<string, string[]> = {};
    const messages: string[] = [];
    if (!category) {
      messages.push("Kategori seçimi zorunludur.");
    } else {
      for (const definition of category.attributes ?? []) {
        const next = attributeMessages(definition, edit.values[definition.key]);
        attributeErrors[definition.key] = next;
        messages.push(...next);
      }
    }
    return {
      product,
      edit,
      category,
      categoryMessage: category ? null : "Kategori seçiniz.",
      attributeErrors,
      validation: {
        messages,
        fieldErrors,
        ready: messages.length === 0 && fieldErrors.length === 0,
      },
    };
  });

  const visibleReady = rows.filter((row) => row.validation.ready).length;
  const newCount = rows.filter((row) => !row.product.exists).length;
  const updateCount = rows.length - newCount;
  const visibleServerValid = preview?.products.filter((product) => product.valid).length ?? 0;
  const hiddenValid = Math.max(0, (preview?.productCount ?? 0) - visibleServerValid);
  const totalReady = visibleReady + hiddenValid;
  const orphanErrors = (preview?.errors ?? []).filter(
    (item) => !item.slug || !rows.some((row) => row.product.slug === item.slug),
  );
  const errors = (step === "result" ? result?.errors : preview?.errors) ?? [];

  const query = searchQuery.trim().toLocaleLowerCase("tr-TR");
  const filteredRows = rows.filter((row) => {
    if (filter === "new" && row.product.exists) return false;
    if (filter === "update" && !row.product.exists) return false;
    if (filter === "ready" && !row.validation.ready) return false;
    if (filter === "problem" && row.validation.ready) return false;
    if (query) {
      const matchTitle = row.product.title.toLocaleLowerCase("tr-TR").includes(query);
      const matchSlug = row.product.slug.toLocaleLowerCase("tr-TR").includes(query);
      const matchSku = row.product.variants.some((v) => v.sku.toLocaleLowerCase("tr-TR").includes(query));
      if (!matchTitle && !matchSlug && !matchSku) return false;
    }
    return true;
  });

  const filters: Array<{ id: RowFilter; label: string; count: number }> = [
    { id: "all", label: "Tümü", count: rows.length },
    { id: "ready", label: "Hazır", count: visibleReady },
    { id: "problem", label: "Düzeltme Gereken", count: rows.length - visibleReady },
    { id: "new", label: "Yeni Ürünler", count: newCount },
    { id: "update", label: "Güncellenecekler", count: updateCount },
  ];

  return (
    <div className="space-y-6">
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        tabIndex={-1}
        aria-label="Ürün dosyası"
        className="sr-only"
        onChange={(event) => {
          const selected = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (selected) selectFile(selected);
        }}
      />

      <StepIndicator currentStep={step} />

      {error && submitErrors.length === 0 && <AdminNotice kind="error">{error}</AdminNotice>}

      {/* ================= STEP 1: SELECT FILE ================= */}
      {step === "select" && (
        <div className="space-y-6">
          <Card className="overflow-hidden rounded-2xl border-2 border-dashed border-border transition-colors hover:border-primary/50">
            <div
              {...dropHandlers}
              role="button"
              tabIndex={0}
              aria-disabled={loading}
              aria-label="Excel veya CSV dosyası yükleyin"
              onClick={() => {
                if (!loading) inputRef.current?.click();
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                if (!loading) inputRef.current?.click();
              }}
              className={`relative flex flex-col items-center justify-center p-8 text-center transition-colors cursor-pointer outline-none sm:p-14 ${
                loading ? "cursor-wait bg-primary/[0.03]" : dragActive ? "bg-primary/[0.06] border-primary" : "hover:bg-muted/30"
              }`}
            >
              <div className="grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary shadow-xs">
                {loading ? (
                  <ArrowPathIcon className="size-8 animate-spin" aria-hidden="true" />
                ) : (
                  <ArrowUpTrayIcon className="size-8" aria-hidden="true" />
                )}
              </div>

              <h2 className="mt-5 text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                {loading ? `${file?.name ?? "Dosya"} inceleniyor…` : "Dosyanızı buraya sürükleyin veya seçin"}
              </h2>

              <p className="mt-1.5 max-w-md text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {loading
                  ? "Ürünler, varyantlar ve kategori eşleşmeleri taranıyor. Lütfen bekleyin…"
                  : "Excel veya CSV dosyanızı yükleyin. Standart tablolar, Shopify ve WooCommerce dışa aktarımları otomatik algılanır."}
              </p>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <span className="rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-foreground">
                  Excel (.xlsx, .xls)
                </span>
                <span className="rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-foreground">
                  Standart CSV
                </span>
                <span className="rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-foreground">
                  Shopify CSV
                </span>
                <span className="rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-foreground">
                  WooCommerce CSV
                </span>
                <span className="text-[11px] text-muted-foreground">· En fazla 20 MB</span>
              </div>

              {!loading && (
                <div className="mt-6">
                  <Button type="button" size="default" className="gap-2 pointer-events-none">
                    <DocumentArrowDownIcon className="size-4" />
                    <span>Dosya Seç</span>
                  </Button>
                </div>
              )}
            </div>
          </Card>

          {/* Quick template downloads & guidelines */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="p-5 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                    ÖNERİLEN
                  </span>
                  <h3 className="text-sm font-semibold text-foreground">Excel Şablonu (.xlsx)</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Çoklu varyantlar, gömülü ürün fotoğrafları ve kategori özellikleri için hazır tablo formatı.
                </p>
              </div>
              <Button asChild variant="outline" size="sm" className="h-9 shrink-0 gap-1.5 cursor-pointer">
                <a href="/api/admin/products/import?format=xlsx" download>
                  <ArrowDownTrayIcon className="size-4" />
                  <span>İndir</span>
                </a>
              </Button>
            </Card>

            <Card className="p-5 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-400">
                    STANDART
                  </span>
                  <h3 className="text-sm font-semibold text-foreground">CSV Şablonu (.csv)</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Basit metin tabanlı virgülle ayrılmış aktarımlar ve harici ERP entegrasyonları için şablon.
                </p>
              </div>
              <Button asChild variant="outline" size="sm" className="h-9 shrink-0 gap-1.5 cursor-pointer">
                <a href="/api/admin/products/import?format=csv" download>
                  <ArrowDownTrayIcon className="size-4" />
                  <span>İndir</span>
                </a>
              </Button>
            </Card>
          </div>

          {/* Simplified Column Guide */}
          <Card className="p-4 sm:px-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground">
              <div className="space-y-1">
                <p>
                  <strong className="text-foreground">Zorunlu sütunlar:</strong> Başlık (veya Ürün Adresi / Slug), Kategori, Fiyat.
                </p>
                <p>
                  <strong className="text-foreground">İsteğe bağlı:</strong> Varyantlar (Seçenek Adı / Değeri), Stok, Görseller (URL veya gömülü), Açıklama.
                </p>
              </div>
              <p className="text-[11px] text-muted-foreground/80 sm:text-right shrink-0">
                Aynı slug&apos;a sahip ürünler güncellenir, diğerleri yeni eklenir.
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* ================= STEP 2: PREVIEW & REVIEW TABLE ================= */}
      {step === "preview" && preview && (
        <>
          {/* Header Action Portal (Renders directly into the Shell Header) */}
          <AdminHeaderAction route={adminPath("products/import")}>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => inputRef.current?.click()}
                disabled={loading}
                className="h-9 gap-1.5 cursor-pointer"
              >
                <ArrowUpTrayIcon className="size-4" />
                <span>Değiştir</span>
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => void executeImport()}
                disabled={loading || totalReady === 0}
                className="h-9 gap-1.5 cursor-pointer"
              >
                <CheckCircleIcon className="size-4" />
                <span>{totalReady} Ürünü Aktar</span>
              </Button>
            </div>
          </AdminHeaderAction>

          {/* Blocking error banner */}
          {submitErrors.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-destructive/30 bg-destructive/5 p-4 sm:p-5">
              <div className="flex items-center gap-2 font-semibold text-destructive text-sm">
                <ExclamationCircleIcon className="size-5 shrink-0" />
                <span>Aktarım engellendi · {submitErrors.length} hata tespit edildi</span>
              </div>
              <div className="mt-3 max-h-40 divide-y divide-destructive/20 overflow-y-auto rounded-lg border border-destructive/20 bg-background text-xs">
                {submitErrors.slice(0, ERROR_DISPLAY_LIMIT).map((item, index) => (
                  <div key={`${item.rowNumber}-${index}`} className="flex gap-3 px-3 py-2">
                    <span className="w-16 shrink-0 font-mono text-muted-foreground font-medium">
                      {item.rowNumber > 0 ? `Satır ${item.rowNumber}` : "Genel"}
                    </span>
                    <span className="min-w-0 text-destructive">{item.error}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>Tablodaki eksik alanları tamamlayarak tekrar deneyebilirsiniz.</span>
                <button
                  type="button"
                  onClick={() => file && void loadPreview(file)}
                  className="font-medium text-primary hover:underline cursor-pointer"
                >
                  Yeniden Tara
                </button>
              </div>
            </div>
          )}

          {/* Metric Overview */}
          {preview.detectedSource === "shopify" && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-800 dark:text-emerald-300">
              <CheckCircleIcon className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span><strong>Shopify CSV formatı algılandı:</strong> Ürünler, varyantlar ve CDN fotoğrafları otomatik eşleştirildi.</span>
            </div>
          )}
          {preview.detectedSource === "woocommerce" && (
            <div className="flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-2.5 text-xs text-blue-800 dark:text-blue-300">
              <CheckCircleIcon className="size-4 shrink-0 text-blue-600 dark:text-blue-400" />
              <span><strong>WooCommerce CSV formatı algılandı:</strong> Ürünler ve varyantlar otomatik eşleştirildi.</span>
            </div>
          )}



          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-card px-4 py-3">
              <span className="text-xs font-medium text-muted-foreground">Toplam Ürün</span>
              <p className="mt-0.5 text-xl font-bold tabular-nums text-foreground">{preview.productCount}</p>
            </div>
            <div className="rounded-xl border border-border bg-card px-4 py-3">
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Aktarıma Hazır</span>
              <p className="mt-0.5 text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{totalReady}</p>
            </div>
            <div className={`rounded-xl border border-border bg-card px-4 py-3 ${rows.length - visibleReady > 0 ? "border-amber-500/40 bg-amber-500/[0.02]" : ""}`}>
              <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Düzeltme Gereken</span>
              <p className="mt-0.5 text-xl font-bold tabular-nums text-amber-600 dark:text-amber-400">{rows.length - visibleReady}</p>
            </div>
            <div className="rounded-xl border border-border bg-card px-4 py-3">
              <span className="text-xs font-medium text-muted-foreground">Yeni / Güncelleme</span>
              <p className="mt-0.5 text-xl font-bold tabular-nums text-foreground">{newCount} / {updateCount}</p>
            </div>
          </div>

          {/* Main Table Card */}
          <Card className="overflow-hidden rounded-2xl">
            {/* Top Toolbar */}
            <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              {/* File Info */}
              <div className="flex items-center gap-3">
                <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                  <DocumentTextIcon className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{file?.name}</p>
                  <p className="text-[11px] text-muted-foreground">{file ? formatFileSize(file.size) : ""}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => file && void loadPreview(file)}
                  disabled={loading}
                  className="h-8 gap-1.5 text-xs cursor-pointer"
                >
                  <ArrowPathIcon className="size-3.5" />
                  <span>Yeniden Tara</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => inputRef.current?.click()}
                  disabled={loading}
                  className="h-8 gap-1.5 text-xs cursor-pointer"
                >
                  <ArrowUpTrayIcon className="size-3.5" />
                  <span>Farklı Dosya Seç</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCategoryEditorOpen(true)}
                  disabled={loading}
                  className="h-8 gap-1.5 text-xs cursor-pointer"
                >
                  <PlusIcon className="size-3.5" />
                  <span>Yeni Kategori Ekle</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void executeImport()}
                  disabled={loading || totalReady === 0}
                  className="h-8 gap-1.5 text-xs cursor-pointer"
                >
                  <CheckCircleIcon className="size-4" />
                  <span>{totalReady} Ürünü Aktar</span>
                </Button>
              </div>
            </div>

            {/* Filter Tabs & Search Bar */}
            <div className="flex flex-col gap-3 border-b border-border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              {/* Status Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                {filters.map((item) => {
                  const active = filter === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setFilter(item.id)}
                      className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${
                        active
                          ? "border-primary bg-primary text-primary-foreground shadow-2xs font-semibold"
                          : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <span>{item.label}</span>
                      <span className={`rounded-full px-1.5 py-0.2 text-[10px] ${active ? "bg-primary-foreground/20 text-primary-foreground font-bold" : "bg-muted text-muted-foreground"}`}>
                        {item.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Search & Collapse Toggle */}
              <div className="flex items-center gap-2">
                <div className="relative min-w-52 flex-1 sm:w-64">
                  <MagnifyingGlassIcon
                    className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    type="search"
                    placeholder="Başlık, slug veya SKU ara…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 pl-8 pr-7 text-xs rounded-lg"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                      aria-label="Aramayı temizle"
                    >
                      <XMarkIcon className="size-3.5" />
                    </button>
                  )}
                </div>

                {filteredRows.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => toggleAllExpanded(filteredRows)}
                    className="h-8 shrink-0 text-xs gap-1 cursor-pointer"
                  >
                    <span>{filteredRows.some((r) => !expandedSlugs[r.product.slug]) ? "Tümünü Aç" : "Tümünü Kapat"}</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Structured Table */}
            <div role="table" aria-label="İçe aktarılacak ürün listesi">
              {rows.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <p className="text-base font-semibold text-foreground">Dosyada aktarılabilir ürün bulunamadı</p>
                  <p className="mx-auto mt-1.5 max-w-md text-xs text-muted-foreground leading-relaxed">
                    Dosyanızdaki sütun başlıklarını kontrol edin ve zorunlu alanların (Başlık, Kategori, Fiyat) yer aldığından emin olun.
                  </p>
                  <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => inputRef.current?.click()}>
                    Farklı Dosya Seç
                  </Button>
                </div>
              ) : (
                <>
                  {/* Table Column Headers */}
                  <div
                    role="row"
                    className="hidden border-b border-border bg-muted/40 px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground xl:grid xl:grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,1.4fr)_minmax(0,1.4fr)_140px] xl:gap-4 xl:items-center"
                  >
                    <span role="columnheader">Ürün Bilgisi</span>
                    <span role="columnheader">Fiyat & Varyant</span>
                    <span role="columnheader">Kategori</span>
                    <span role="columnheader">Özellikler</span>
                    <span role="columnheader" className="text-right">Durum & Detay</span>
                  </div>

                  {filteredRows.length === 0 ? (
                    <div className="px-6 py-14 text-center">
                      <p className="text-sm font-semibold text-foreground">Aramaya uygun ürün bulunamadı</p>
                      <p className="mt-1 text-xs text-muted-foreground">Filtreleri veya arama kriterini değiştirip tekrar deneyin.</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-3 cursor-pointer"
                        onClick={() => {
                          setFilter("all");
                          setSearchQuery("");
                        }}
                      >
                        Filtreleri Temizle
                      </Button>
                    </div>
                  ) : (
                    <div role="rowgroup" className="divide-y divide-border">
                      {filteredRows.map(({ product, edit, category, categoryMessage, attributeErrors, validation }) => {
                        const isExpanded = Boolean(expandedSlugs[product.slug]);
                        const totalAttributes = category?.attributes?.length ?? 0;
                        const filledAttributes = (category?.attributes ?? []).filter((attr) => {
                          const v = edit.values[attr.key];
                          return v !== undefined && v !== "" && (!Array.isArray(v) || v.length > 0);
                        }).length;
                        const missingRequired = (category?.attributes ?? []).filter((attr) => {
                          if (!attr.required) return false;
                          const v = edit.values[attr.key];
                          return v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
                        }).length;

                        return (
                          <div
                            key={product.slug}
                            role="row"
                            className={`transition-colors ${isExpanded ? "bg-muted/15" : "hover:bg-muted/20"}`}
                          >
                            {/* Main Row Content */}
                            <div className="grid gap-3 p-4 sm:p-5 xl:grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,1.4fr)_minmax(0,1.4fr)_140px] xl:gap-4 xl:items-center xl:px-6">
                              {/* Column 1: Product Thumbnail & Title */}
                              <div role="cell" className="min-w-0">
                                <div className="flex items-center gap-3">
                                  <div className="relative size-12 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
                                    {product.images[0] ? (
                                      <img
                                        src={product.images[0]}
                                        alt=""
                                        loading="lazy"
                                        referrerPolicy="no-referrer"
                                        className="size-full object-cover"
                                      />
                                    ) : (
                                      <div className="grid size-full place-items-center text-muted-foreground/60">
                                        <PhotoIcon className="size-5" aria-hidden="true" />
                                      </div>
                                    )}
                                    {product.imageCount > 1 && (
                                      <span className="absolute bottom-0.5 right-0.5 rounded-sm bg-background/90 px-1 text-[9px] font-semibold text-foreground shadow-2xs">
                                        +{product.imageCount - 1}
                                      </span>
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <ActionBadge exists={product.exists} />
                                      <span className="truncate text-sm font-semibold text-foreground" title={product.title}>
                                        {product.title}
                                      </span>
                                    </div>
                                    <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                                      /{product.slug}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              {/* Column 2: Variants & Price */}
                              <div role="cell" className="min-w-0">
                                <div className="space-y-0.5">
                                  <span className="font-semibold text-foreground tabular-nums text-sm">
                                    {product.priceMin === product.priceMax
                                      ? formatMoney(product.priceMin)
                                      : `${formatMoney(product.priceMin)} - ${formatMoney(product.priceMax)}`}
                                  </span>
                                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground">
                                      {product.variantCount} {product.variantCount > 1 ? "varyant" : "varyant"}
                                    </span>
                                    <span>·</span>
                                    <span>Stok: <strong className="font-semibold text-foreground tabular-nums">{product.stockTotal}</strong></span>
                                  </div>
                                </div>
                              </div>

                              {/* Column 3: Category Selector */}
                              <div role="cell" className="min-w-0 space-y-1">
                                <select
                                  aria-label={`${product.title} kategorisi`}
                                  value={edit.categorySlug}
                                  onChange={(event) => changeCategory(product.slug, event.target.value, edit)}
                                  className={`h-9 w-full rounded-lg border bg-background px-2.5 text-xs font-medium text-foreground outline-none transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-ring/30 ${
                                    categoryMessage ? "border-amber-500/60 ring-1 ring-amber-500/20" : "border-input hover:border-border"
                                  }`}
                                >
                                  <option value="">Kategori seçin</option>
                                  {preview.categoryOptions.map((option) => (
                                    <option key={option.slug} value={option.slug}>
                                      {option.title}
                                    </option>
                                  ))}
                                </select>
                                {product.categoryValue && (() => {
                                  const segments = product.categoryValue.includes(">")
                                    ? product.categoryValue.split(">").map((s) => s.trim()).filter(Boolean)
                                    : product.categoryValue.includes(" - ")
                                    ? product.categoryValue.split(" - ").map((s) => s.trim()).filter(Boolean)
                                    : [];
                                  return (
                                    <div className="space-y-1.5 pt-0.5">
                                      <p className="truncate text-[10px] text-muted-foreground" title={product.categoryValue}>
                                        Dosyadaki: <span className="font-medium text-foreground/80">{product.categoryValue}</span>
                                      </p>
                                      {segments.length > 1 && (
                                        <div className="flex flex-wrap items-center gap-1">
                                          <span className="text-[10px] text-muted-foreground font-medium">Hızlı Seçim:</span>
                                          {segments.map((seg) => {
                                            const segSlug = slugify(seg);
                                            const matchedOption = preview.categoryOptions.find(
                                              (c) => c.title.toLocaleLowerCase("tr-TR") === seg.toLocaleLowerCase("tr-TR") ||
                                                     c.slug === segSlug,
                                            );
                                            const targetSlug = matchedOption?.slug ?? segSlug;
                                            const isSelected = edit.categorySlug === targetSlug;
                                            return (
                                              <button
                                                key={seg}
                                                type="button"
                                                onClick={() => changeCategory(product.slug, targetSlug, edit)}
                                                className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition-all cursor-pointer ${
                                                  isSelected
                                                    ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                                                    : "border border-border bg-muted/60 text-foreground hover:bg-muted hover:border-foreground/30"
                                                }`}
                                              >
                                                {isSelected && <CheckIcon className="size-2.5" />}
                                                <span>{seg}</span>
                                              </button>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>

                              {/* Column 4: Attributes Status Summary */}
                              <div role="cell" className="min-w-0 flex items-center justify-between gap-2">
                                <div className="space-y-0.5 min-w-0">
                                  {!category ? (
                                    <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                                      Kategori bekleniyor
                                    </span>
                                  ) : totalAttributes === 0 ? (
                                    <span className="text-xs text-muted-foreground">
                                      Özellik gerekmiyor
                                    </span>
                                  ) : missingRequired > 0 ? (
                                    <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-medium">
                                      {missingRequired} zorunlu eksik
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-medium">
                                      {filledAttributes}/{totalAttributes} özellik dolu
                                    </Badge>
                                  )}
                                </div>

                                {category && totalAttributes > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => toggleExpand(product.slug)}
                                    className="text-xs font-medium text-primary hover:underline cursor-pointer shrink-0"
                                  >
                                    {isExpanded ? "Gizle" : "Düzenle"}
                                  </button>
                                )}
                              </div>

                              {/* Column 5: Status & Expand Action */}
                              <div role="cell" className="flex items-center justify-between xl:justify-end gap-2">
                                <div className="shrink-0">
                                  {validation.ready ? (
                                    <Badge variant="success" className="gap-1 px-2 py-0.5 text-[11px] font-semibold">
                                      <CheckIcon className="size-3" />
                                      Hazır
                                    </Badge>
                                  ) : validation.fieldErrors.length > 0 ? (
                                    <Badge variant="destructive" className="gap-1 px-2 py-0.5 text-[11px] font-semibold">
                                      Aktarılamaz
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="gap-1 border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2 py-0.5 text-[11px] font-semibold">
                                      Eksik Alan
                                    </Badge>
                                  )}
                                </div>

                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleExpand(product.slug)}
                                  className="h-8 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                                  aria-expanded={isExpanded}
                                  aria-label="Detayları göster/gizle"
                                >
                                  <span>{isExpanded ? "Kapat" : "Detay"}</span>
                                  <ChevronDownIcon className={`size-3.5 transition-transform duration-150 ${isExpanded ? "rotate-180" : ""}`} />
                                </Button>
                              </div>
                            </div>

                            {/* Expandable Detail Panel */}
                            {isExpanded && (
                              <div className="border-t border-border/80 bg-muted/20 p-4 sm:p-6 space-y-6">
                                {/* Blocking field errors inside the row */}
                                {validation.fieldErrors.length > 0 && (
                                  <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive">
                                    <p className="font-semibold">Aktarımı Engelleyen Hatalar:</p>
                                    <ul className="mt-1.5 list-inside list-disc space-y-0.5">
                                      {validation.fieldErrors.map((err, i) => (
                                        <li key={i}>{err.error}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                <div className="grid gap-6 lg:grid-cols-[1.1fr_1.9fr]">
                                  {/* Left: Variants Breakdown */}
                                  <div>
                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                                      Varyant Listesi ({product.variants.length} adet)
                                    </h4>
                                    {product.variants.length === 0 ? (
                                      <div className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">
                                        Bu ürün için tanımlı varyant bulunmuyor.
                                      </div>
                                    ) : (
                                      <div className="max-h-64 overflow-y-auto rounded-xl border border-border bg-card divide-y divide-border">
                                        {product.variants.map((v, i) => (
                                          <div key={v.sku || i} className="flex items-center justify-between p-3 text-xs">
                                            <div className="min-w-0 pr-3">
                                              <p className="font-semibold text-foreground truncate">{v.title}</p>
                                              <p className="font-mono text-[10px] text-muted-foreground mt-0.5">SKU: {v.sku || "-"}</p>
                                            </div>
                                            <div className="text-right shrink-0">
                                              <p className="font-bold tabular-nums text-foreground">{formatMoney(v.price)}</p>
                                              <p className="text-[10px] tabular-nums text-muted-foreground mt-0.5">Stok: {v.stockQuantity} adet</p>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  {/* Right: Dynamic Category Attributes Editor */}
                                  <div>
                                    <div className="flex items-center justify-between mb-2.5">
                                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        Kategori Özellikleri ({category?.title || "Kategori Seçilmedi"})
                                      </h4>
                                      {category && (
                                        <span className="text-[11px] text-muted-foreground">
                                          {category.attributes?.length ?? 0} tanımlı özellik
                                        </span>
                                      )}
                                    </div>

                                    {!category ? (
                                      <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center text-xs text-muted-foreground">
                                        Özellikleri belirleyebilmek için lütfen yukarıdan bir kategori seçin.
                                      </div>
                                    ) : (category.attributes ?? []).length === 0 ? (
                                      <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center text-xs text-muted-foreground">
                                        Bu kategoride tanımlanmış ek özellik bulunmamaktadır.
                                      </div>
                                    ) : (
                                      <div className="grid gap-3 sm:grid-cols-2">
                                        {(category.attributes ?? []).map((attribute) => (
                                          <AttributeEditor
                                            key={attribute.key}
                                            attribute={attribute}
                                            value={edit.values[attribute.key]}
                                            error={attributeErrors[attribute.key]?.[0]}
                                            onChange={(next) => updateValue(product.slug, attribute.key, next, edit)}
                                          />
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Truncated note */}
            {preview.productsTruncated && (
              <div className="border-t border-border bg-muted/20 px-6 py-3 text-xs text-muted-foreground">
                İlk {preview.previewLimit} ürün tabloda düzenlenebilir; kalan {preview.parsedProductCount - preview.previewLimit} ürün dosyadaki değerlerle aktarılacaktır.
              </div>
            )}
          </Card>

          {/* Orphan & Non-Row Errors Drawer */}
          {orphanErrors.length > 0 && (
            <details className="rounded-2xl border border-amber-500/30 bg-card overflow-hidden">
              <summary className="flex cursor-pointer items-center justify-between p-4 sm:px-6">
                <div className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400">
                  <ExclamationTriangleIcon className="size-4 shrink-0" aria-hidden="true" />
                  <span>Dosyada düzeltilmesi gereken {orphanErrors.length} satır hatası var</span>
                </div>
                <span className="text-xs text-muted-foreground">Görüntüle</span>
              </summary>
              <div className="max-h-48 divide-y divide-border overflow-y-auto border-t border-border bg-muted/10 text-xs">
                {orphanErrors.slice(0, ERROR_DISPLAY_LIMIT).map((item, index) => (
                  <div key={`${item.rowNumber}-${index}`} className="flex gap-3 px-6 py-2.5">
                    <span className="w-16 shrink-0 font-mono text-muted-foreground font-medium">
                      {item.rowNumber > 0 ? `Satır ${item.rowNumber}` : "Genel"}
                    </span>
                    <span className="min-w-0">
                      {item.slug && <span className="mr-1.5 font-mono text-muted-foreground">/{item.slug}</span>}
                      <span className="text-destructive font-medium">{item.error}</span>
                    </span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </>
      )}

      {/* ================= STEP 3: IMPORTING PROGRESS ================= */}
      {step === "importing" && (
        <div className="mx-auto max-w-xl py-12">
          <Card className="rounded-2xl p-8 sm:p-10 text-center shadow-lg border-border">
            <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary">
              <ArrowPathIcon className="size-8 animate-spin" aria-hidden="true" />
            </div>
            <h2 className="mt-5 text-lg font-bold tracking-tight text-foreground">Ürünler Mağazaya Aktarılıyor</h2>
            <p className="mt-1 text-xs font-mono text-muted-foreground">{file?.name}</p>

            <div className="mt-6 space-y-2">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-muted-foreground truncate">{getImportStatusMessage(importProgress)}</span>
                <span className="font-mono text-foreground font-semibold tabular-nums ml-2">%{Math.round(importProgress)}</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
                  style={{ width: `${Math.max(4, Math.min(100, importProgress))}%` }}
                />
              </div>
            </div>

            <p className="mx-auto mt-5 max-w-sm text-xs leading-relaxed text-muted-foreground">
              Görseller indiriliyor, varyantlar ve kategori özellikleri kaydediliyor. Bu işlem dosya boyutuna bağlı olarak biraz sürebilir; lütfen sayfayı kapatmayın.
            </p>
          </Card>
        </div>
      )}

      {/* ================= STEP 4: IMPORT RESULT ================= */}
      {step === "result" && result && (
        <div className="mx-auto max-w-3xl space-y-6">
          <Card className="rounded-2xl p-6 sm:p-8 text-center">
            {(() => {
              const imported = (result.created ?? 0) + (result.updated ?? 0);
              const hasErrors = (result.errors?.length ?? 0) > 0;
              return (
                <>
                  <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-muted">
                    {hasErrors || imported === 0 ? (
                      <ExclamationTriangleIcon className="size-8 text-amber-500" aria-hidden="true" />
                    ) : (
                      <CheckCircleIcon className="size-8 text-emerald-500" aria-hidden="true" />
                    )}
                  </div>

                  <h2 className="mt-4 text-lg font-bold text-foreground">
                    {imported === 0 ? "Hiçbir ürün aktarılamadı" : "İçe Aktarma Tamamlandı"}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {result.created ?? 0} yeni ürün eklendi, {result.updated ?? 0} mevcut ürün güncellendi.
                  </p>

                  <div className="mt-6 grid grid-cols-2 gap-3 text-left sm:grid-cols-4">
                    <div className="rounded-xl border border-border bg-card p-4">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Yeni Ürün</p>
                      <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{result.created ?? 0}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-4">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Güncellenen</p>
                      <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{result.updated ?? 0}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-4">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Görseller</p>
                      <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{result.imagesImported ?? 0}</p>
                      {(result.imagesFailed ?? 0) > 0 && (
                        <p className="mt-1 text-[11px] text-destructive font-medium">{result.imagesFailed} görsel yüklenemedi</p>
                      )}
                    </div>
                    <div className="rounded-xl border border-border bg-card p-4">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Atlanan / Hata</p>
                      <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                        {(result.skippedProducts ?? 0) + (result.failedProducts ?? 0)}
                      </p>
                    </div>
                  </div>
                </>
              );
            })()}
          </Card>

          {errors.length > 0 && (
            <Card className="overflow-hidden rounded-2xl border-destructive/30">
              <div className="border-b border-destructive/20 bg-destructive/5 px-6 py-3.5 flex items-center gap-2">
                <ExclamationTriangleIcon className="size-4 text-destructive" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-destructive">{errors.length} Hata Kaydı</h3>
              </div>
              <div className="max-h-64 divide-y divide-border overflow-y-auto text-xs">
                {errors.slice(0, ERROR_DISPLAY_LIMIT).map((item, index) => (
                  <div key={`${item.rowNumber}-${index}`} className="flex gap-3 px-6 py-2.5">
                    <span className="w-16 shrink-0 font-mono text-muted-foreground font-medium">
                      {item.rowNumber > 0 ? `Satır ${item.rowNumber}` : "Genel"}
                    </span>
                    <span className="min-w-0">
                      {item.slug && <span className="mr-1.5 font-mono text-muted-foreground">/{item.slug}</span>}
                      <span className="text-destructive font-medium">{item.error}</span>
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <div className="flex flex-col-reverse justify-end gap-3 sm:flex-row">
            <Button type="button" variant="outline" size="default" onClick={reset} className="cursor-pointer">
              Yeni Dosya İçe Aktar
            </Button>
            <Button asChild size="default" className="cursor-pointer">
              <Link href={adminPath("products")}>Ürünleri Görüntüle</Link>
            </Button>
          </div>
        </div>
      )}

      {categoryEditorOpen && (
        <CategoryEditor
          category={null}
          onClose={() => setCategoryEditorOpen(false)}
          onSaved={() => {
            setCategoryEditorOpen(false);
            if (file) void loadPreview(file);
          }}
        />
      )}
    </div>
  );
}
