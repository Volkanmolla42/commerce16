"use client";

import type { HTMLAttributes } from "react";
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ArrowUpTrayIcon,
  DocumentArrowDownIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type DropHandlers = Pick<HTMLAttributes<HTMLDivElement>, "onDragOver" | "onDragLeave" | "onDrop">;

export function ImportSelectStep({
  loading,
  fileName,
  dragActive,
  dropHandlers,
  onChooseFile,
}: {
  loading: boolean;
  fileName?: string;
  dragActive: boolean;
  dropHandlers: DropHandlers;
  onChooseFile: () => void;
}) {
  return (
        <div className="space-y-6">
          <Card className="overflow-hidden rounded-2xl border-2 border-dashed border-border transition-colors hover:border-primary/50">
            <div
              {...dropHandlers}
              role="button"
              tabIndex={0}
              aria-disabled={loading}
              aria-label="Excel veya CSV dosyası yükleyin"
              onClick={() => {
                if (!loading) onChooseFile();
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                if (!loading) onChooseFile();
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
                {loading ? `${fileName ?? "Dosya"} inceleniyor…` : "Dosyanızı buraya sürükleyin veya seçin"}
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
                  <span className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm">
                    <DocumentArrowDownIcon className="size-4" aria-hidden="true" />
                    <span>Dosya Seç</span>
                  </span>
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
                <p>
                  <strong className="text-foreground">Görseller:</strong> Yalnızca telif hakkına sahip olduğunuz veya kullanım izni bulunan görselleri yükleyin.
                </p>
              </div>
              <p className="text-[11px] text-muted-foreground sm:text-right shrink-0">
                Aynı slug&apos;a sahip ürünler güncellenir, diğerleri yeni eklenir.
              </p>
            </div>
          </Card>
        </div>
  );
}
