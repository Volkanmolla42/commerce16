"use client";

/* eslint-disable @next/next/no-img-element */

import { useRef, useState } from "react";
import {
  ArrowPathIcon,
  ArrowUpTrayIcon,
  CheckCircleIcon,
  CheckIcon,
  ChevronDownIcon,
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
import { CategoryEditor } from "../../kategoriler/_components/category-editor";
import { slugify } from "@/lib/text";
import { formatMoney } from "@/lib/format-money";
import { adminPath } from "@/lib/admin/routes";

import {
  ACCEPTED_EXTENSIONS,
  ERROR_DISPLAY_LIMIT,
  MAX_FILE_SIZE,
  buildOverrides,
  defaultRowState,
  formatFileSize,
  type ImportError,
  type ImportResult,
  type PreviewResult,
  type RowFilter,
  type RowState,
  type Step,
  type TableRow,
} from "./_lib/import-preview";
import { buildImportRows, filterImportRows } from "./_lib/import-rows";
import { ActionBadge, AttributeEditor, StepIndicator } from "./_components/import-ui";
import { ImportSelectStep } from "./_components/import-select-step";
import { ImportProgress, ImportResultView } from "./_components/import-progress-result";


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

  const rows = buildImportRows(preview, edits);

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

  const filteredRows = filterImportRows(rows, filter, searchQuery);

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

      {step === "select" && (
        <ImportSelectStep
          loading={loading}
          fileName={file?.name}
          dragActive={dragActive}
          dropHandlers={dropHandlers}
          onChooseFile={() => inputRef.current?.click()}
        />
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
              <CheckCircleIcon className="size-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
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
              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Aktarıma Hazır</span>
              <p className="mt-0.5 text-xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{totalReady}</p>
            </div>
            <div className={`rounded-xl border border-border bg-card px-4 py-3 ${rows.length - visibleReady > 0 ? "border-amber-500/40 bg-amber-500/[0.02]" : ""}`}>
              <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Düzeltme Gereken</span>
              <p className="mt-0.5 text-xl font-bold tabular-nums text-amber-700 dark:text-amber-400">{rows.length - visibleReady}</p>
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
                                  className={`h-9 w-full rounded-lg border bg-background px-2.5 text-xs font-medium text-foreground outline-none transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-ring ${
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
                                    <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">
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

      {step === "importing" && <ImportProgress progress={importProgress} fileName={file?.name} />}

      {step === "result" && result && (
        <ImportResultView result={result} errors={errors} onReset={reset} />
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
