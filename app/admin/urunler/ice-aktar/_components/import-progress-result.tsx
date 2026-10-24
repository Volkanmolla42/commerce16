"use client";

import Link from "next/link";
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { adminPath } from "@/lib/admin/routes";
import {
  ERROR_DISPLAY_LIMIT,
  getImportStatusMessage,
  type ImportError,
  type ImportResult,
} from "../_lib/import-preview";

export function ImportProgress({ progress, fileName }: { progress: number; fileName?: string }) {
  return (
        <div className="mx-auto max-w-xl py-12">
          <Card className="rounded-2xl p-8 sm:p-10 text-center shadow-lg border-border">
            <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary">
              <ArrowPathIcon className="size-8 animate-spin" aria-hidden="true" />
            </div>
            <h2 className="mt-5 text-lg font-bold tracking-tight text-foreground">Ürünler Mağazaya Aktarılıyor</h2>
            <p className="mt-1 text-xs font-mono text-muted-foreground">{fileName}</p>

            <div className="mt-6 space-y-2">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-muted-foreground truncate">{getImportStatusMessage(progress)}</span>
                <span className="font-mono text-foreground font-semibold tabular-nums ml-2">%{Math.round(progress)}</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
                  style={{ width: `${Math.max(4, Math.min(100, progress))}%` }}
                />
              </div>
            </div>

            <p className="mx-auto mt-5 max-w-sm text-xs leading-relaxed text-muted-foreground">
              Görseller indiriliyor, varyantlar ve kategori özellikleri kaydediliyor. Bu işlem dosya boyutuna bağlı olarak biraz sürebilir; lütfen sayfayı kapatmayın.
            </p>
          </Card>
        </div>
  );
}

export function ImportResultView({
  result,
  errors,
  onReset,
}: {
  result: ImportResult;
  errors: ImportError[];
  onReset: () => void;
}) {
  return (
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
            <Button type="button" variant="outline" size="default" onClick={onReset} className="cursor-pointer">
              Yeni Dosya İçe Aktar
            </Button>
            <Button asChild size="default" className="cursor-pointer">
              <Link href={adminPath("products")}>Ürünleri Görüntüle</Link>
            </Button>
          </div>
        </div>
  );
}
