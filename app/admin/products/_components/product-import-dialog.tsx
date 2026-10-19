"use client";

import { useState } from "react";
import {
  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type PreviewResult = {
  totalRows: number;
  productCount: number;
  variantCount: number;
  products: Array<{
    slug: string;
    title: string;
    categorySlug?: string;
    variantCount: number;
    imageCount: number;
  }>;
  errors: Array<{
    rowNumber: number;
    slug?: string;
    error: string;
  }>;
};

type ImportResponse = {
  success?: boolean;
  total?: number;
  created?: number;
  updated?: number;
  errors?: Array<{
    rowNumber: number;
    slug?: string;
    error: string;
  }>;
  error?: string;
};

export function ProductImportDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<"select" | "preview" | "importing" | "result">("select");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const resetState = () => {
    setFile(null);
    setStep("select");
    setPreview(null);
    setResult(null);
    setErrorMsg(null);
    setLoading(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setErrorMsg(null);
    }
  };

  const runPreview = async () => {
    if (!file) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("dryRun", "true");

      const res = await fetch("/api/admin/products/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        setPreview(data);
        setStep("preview");
      } else {
        setErrorMsg(data.error || "Dosya ayrıştırılırken hata oluştu.");
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Dosya incelenemedi.");
    }
    setLoading(false);
  };

  const executeImport = async () => {
    if (!file) return;
    setLoading(true);
    setStep("importing");
    setErrorMsg(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("dryRun", "false");

      const res = await fetch("/api/admin/products/import", {
        method: "POST",
        body: formData,
      });

      const data = (await res.json()) as ImportResponse;
      if (res.ok) {
        setResult(data);
        setStep("result");
        onSuccess();
      } else {
        setErrorMsg(data.error || "İçe aktarma sırasında hata oluştu.");
        setStep("preview");
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "İçe aktarma başarısız oldu.");
      setStep("preview");
    }
    setLoading(false);
  };

  const downloadErrorReport = () => {
    const errorList = result?.errors || preview?.errors || [];
    if (errorList.length === 0) return;

    const headers = "Satır No;Ürün Adresi (Slug);Hata Açıklaması\r\n";
    const rows = errorList
      .map((e) => `${e.rowNumber || "-"};${e.slug || ""};"${(e.error || "").replace(/"/g, '""')}"`)
      .join("\r\n");

    const blob = new Blob(["\uFEFF" + headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ice_aktarma_hata_raporu.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!loading) {
          if (!isOpen) resetState();
          onOpenChange(isOpen);
        }
      }}
    >
      <DialogContent className="max-w-xl p-5 sm:p-6">
        <DialogHeader className="border-b border-border pb-3">
          <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
            <ArrowUpTrayIcon className="size-5 text-primary" />
            <span>Excel / CSV Ürün İçe Aktar</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Toplu ürünlerinizi, varyantlarınızı, fiyat, stok, barkod ve görsellerinizi Excel veya CSV ile içe aktarın.
          </DialogDescription>
        </DialogHeader>

        {errorMsg && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
            <ExclamationTriangleIcon className="size-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Adım 1: Dosya Seçimi */}
        {step === "select" && (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border-2 border-dashed border-border p-6 text-center hover:border-primary/50 transition-colors">
              <DocumentTextIcon className="size-10 mx-auto text-muted-foreground mb-2" />
              <label htmlFor="file-upload" className="cursor-pointer">
                <span className="text-sm font-medium text-primary hover:underline">
                  {file ? file.name : "Bir Excel (.xlsx) veya CSV dosyası seçin"}
                </span>
                <input
                  id="file-upload"
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  className="sr-only"
                  onChange={handleFileChange}
                />
              </label>
              <p className="text-xs text-muted-foreground mt-1">
                Desteklenen formatlar: .xlsx, .xls, .csv (Maks. 20MB)
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-lg bg-muted/40 text-xs">
              <span className="text-muted-foreground">Hazır formatı kullanmak için:</span>
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm" className="h-8 text-xs gap-1">
                  <a href="/api/admin/products/import?format=xlsx" download>
                    <ArrowDownTrayIcon className="size-3.5" />
                    <span>Excel Şablonu</span>
                  </a>
                </Button>
                <Button asChild variant="outline" size="sm" className="h-8 text-xs gap-1">
                  <a href="/api/admin/products/import?format=csv" download>
                    <ArrowDownTrayIcon className="size-3.5" />
                    <span>CSV Şablonu</span>
                  </a>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Adım 2: Önizleme */}
        {step === "preview" && preview && (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-2">
              <div className="p-3 rounded-lg border border-border bg-card text-center">
                <div className="text-xs text-muted-foreground">Toplam Satır</div>
                <div className="text-lg font-bold text-foreground">{preview.totalRows}</div>
              </div>
              <div className="p-3 rounded-lg border border-border bg-card text-center">
                <div className="text-xs text-muted-foreground">Ürün Sayısı</div>
                <div className="text-lg font-bold text-foreground">{preview.productCount}</div>
              </div>
              <div className="p-3 rounded-lg border border-border bg-card text-center">
                <div className="text-xs text-muted-foreground">Varyant Sayısı</div>
                <div className="text-lg font-bold text-foreground">{preview.variantCount}</div>
              </div>
            </div>

            {preview.errors.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-destructive flex items-center gap-1.5">
                    <ExclamationTriangleIcon className="size-4" />
                    {preview.errors.length} Satırda Hata Var
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={downloadErrorReport}
                  >
                    Hata Raporu İndir
                  </Button>
                </div>
                <div className="max-h-36 overflow-y-auto rounded-lg border border-destructive/20 bg-destructive/5 p-2 text-xs space-y-1">
                  {preview.errors.slice(0, 5).map((e, idx) => (
                    <div key={idx} className="text-destructive">
                      Satır {e.rowNumber}: {e.error}
                    </div>
                  ))}
                  {preview.errors.length > 5 && (
                    <div className="text-muted-foreground text-[11px] pt-1">
                      ... ve {preview.errors.length - 5} hata daha.
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="max-h-44 overflow-y-auto rounded-lg border border-border p-2 text-xs space-y-1.5">
              <div className="font-semibold text-muted-foreground pb-1 border-b border-border">
                Aktarılacak Ürünler (Örnek):
              </div>
              {preview.products.slice(0, 6).map((p) => (
                <div key={p.slug} className="flex items-center justify-between py-1 border-b border-border/40 last:border-0">
                  <div className="truncate pr-2">
                    <span className="font-medium text-foreground">{p.title}</span>
                    <span className="text-muted-foreground text-[11px] ml-1.5 font-mono">({p.slug})</span>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Badge variant="outline" className="text-[10px] h-5">
                      {p.variantCount} Varyant
                    </Badge>
                    {p.imageCount > 0 && (
                      <Badge variant="secondary" className="text-[10px] h-5">
                        {p.imageCount} Görsel
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Adım 3: İçe Aktarılıyor */}
        {step === "importing" && (
          <div className="py-12 text-center space-y-3">
            <div className="size-10 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <div className="text-sm font-semibold text-foreground">Ürünler İçe Aktarılıyor...</div>
            <p className="text-xs text-muted-foreground">
              Varyantlar, stoklar ve görseller işleniyor. Lütfen sayfayı kapatmayın.
            </p>
          </div>
        )}

        {/* Adım 4: Sonuç */}
        {step === "result" && result && (
          <div className="space-y-4 py-4 text-center">
            <CheckCircleIcon className="size-12 mx-auto text-emerald-500" />
            <div>
              <div className="text-base font-bold text-foreground">İçe Aktarma Tamamlandı</div>
              <p className="text-xs text-muted-foreground mt-1">
                {result.created ?? 0} yeni ürün eklendi, {result.updated ?? 0} mevcut ürün güncellendi.
              </p>
            </div>

            {result.errors && result.errors.length > 0 && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-left">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-destructive">
                    {result.errors.length} Satır Atlandı / Hata Aldı
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={downloadErrorReport}
                  >
                    Hata Raporunu İndir
                  </Button>
                </div>
                <div className="max-h-28 overflow-y-auto space-y-1 text-destructive/90 text-[11px]">
                  {result.errors.slice(0, 3).map((e, idx) => (
                    <div key={idx}>
                      {e.slug ? `[${e.slug}] ` : ""}Satır {e.rowNumber || "-"}: {e.error}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 border-t border-border pt-3">
          {step === "select" && (
            <>
              <Button
                type="button"
                variant="outline"
                className="cursor-pointer"
                onClick={() => onOpenChange(false)}
              >
                Vazgeç
              </Button>
              <Button
                type="button"
                disabled={!file || loading}
                className="cursor-pointer"
                onClick={runPreview}
              >
                Dosyayı İncele & Önizle
              </Button>
            </>
          )}

          {step === "preview" && (
            <>
              <Button
                type="button"
                variant="outline"
                className="cursor-pointer"
                onClick={() => setStep("select")}
              >
                Geri
              </Button>
              <Button
                type="button"
                disabled={loading || !preview || preview.productCount === 0}
                className="cursor-pointer"
                onClick={executeImport}
              >
                {preview?.productCount || 0} Ürünü İçe Aktar
              </Button>
            </>
          )}

          {step === "result" && (
            <Button
              type="button"
              className="w-full cursor-pointer"
              onClick={() => {
                resetState();
                onOpenChange(false);
              }}
            >
              Tamam
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
