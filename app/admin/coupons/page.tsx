"use client";

import { useState } from "react";
import type { Doc } from "@/convex/_generated/dataModel";
import {
  MagnifyingGlassIcon,
  PlusIcon,
  PencilSquareIcon,
  NoSymbolIcon,
} from "@heroicons/react/24/outline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminEmpty, AdminLoading, AdminNotice } from "../_components/admin-primitives";
import { AdminHeaderAction } from "../_components/admin-header-action";
import { runAdminAction, useAdminResource } from "../_components/admin-api";
import { formatMoney, kurusToLira } from "@/lib/format-money";
import { formatDateTime } from "@/lib/format-date";
import { adminPath } from "@/lib/admin/routes";

type Coupon = Doc<"coupons">;
type CouponDraft = {
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: string;
  minOrderAmount: string;
  maxDiscount: string;
  usageLimit: string;
  expiresAt: string;
  isActive: boolean;
};

const emptyDraft: CouponDraft = {
  code: "",
  discountType: "percentage",
  discountValue: "10",
  minOrderAmount: "",
  maxDiscount: "",
  usageLimit: "",
  expiresAt: "",
  isActive: true,
};

function toDateTimeInput(timestamp?: number) {
  if (timestamp === undefined) return "";
  const local = new Date(timestamp - new Date(timestamp).getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function toKurus(value: string, label: string): number | null {
  if (!value.trim()) return null;
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(value.trim())) throw new Error(`${label} geçerli bir TL tutarı olmalıdır.`);
  const kurus = Math.round(Number(value.replace(",", ".")) * 100);
  if (!Number.isSafeInteger(kurus)) throw new Error(`${label} geçersiz.`);
  return kurus;
}

function draftFromCoupon(coupon: Coupon): CouponDraft {
  return {
    code: coupon.code,
    discountType: coupon.discountType,
    discountValue:
      coupon.discountType === "fixed" ? kurusToLira(coupon.discountValue) : String(coupon.discountValue),
    minOrderAmount: coupon.minOrderAmountKurus === undefined ? "" : kurusToLira(coupon.minOrderAmountKurus),
    maxDiscount: coupon.maxDiscountKurus === undefined ? "" : kurusToLira(coupon.maxDiscountKurus),
    usageLimit: coupon.usageLimit === undefined ? "" : String(coupon.usageLimit),
    expiresAt: toDateTimeInput(coupon.expiresAt),
    isActive: coupon.isActive,
  };
}

function CouponEditor({
  coupon,
  onClose,
  onSaved,
}: {
  coupon: Coupon | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<CouponDraft>(coupon ? draftFromCoupon(coupon) : emptyDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const fixedAmount = draft.discountType === "fixed" ? toKurus(draft.discountValue, "İndirim tutarı") : null;
      if (draft.discountType === "fixed" && fixedAmount === null) throw new Error("İndirim tutarını girin.");
      const usageLimit = draft.usageLimit.trim() ? Number(draft.usageLimit) : null;
      if (usageLimit !== null && !Number.isSafeInteger(usageLimit)) throw new Error("Kullanım limiti tam sayı olmalı.");

      const input = {
        ...(coupon ? { id: coupon._id } : {}),
        code: draft.code.trim().toLocaleUpperCase("en-US"),
        discountType: draft.discountType,
        discountValue: draft.discountType === "fixed" ? fixedAmount! : Number(draft.discountValue),
        minOrderAmountKurus: toKurus(draft.minOrderAmount, "Asgari sepet tutarı"),
        maxDiscountKurus: toKurus(draft.maxDiscount, "Maksimum indirim"),
        usageLimit,
        expiresAt: draft.expiresAt ? new Date(draft.expiresAt).getTime() : null,
        isActive: draft.isActive,
      };

      await runAdminAction(coupon ? "coupon.update" : "coupon.create", input);
      await onSaved();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Kupon kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg p-5 sm:p-6">
        <DialogHeader className="border-b border-border pb-3">
          <DialogTitle className="text-base font-bold text-foreground">
            {coupon ? "Kuponu Düzenle" : "Yeni Kupon Oluştur"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={save} className="mt-3 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="coupon-code" className="text-xs">
                Kupon Kodu
              </Label>
              <Input
                id="coupon-code"
                required
                minLength={3}
                maxLength={32}
                pattern="[A-Za-z0-9_-]+"
                value={draft.code}
                onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                placeholder="Örn: YAZINDIRIM"
                className="font-mono text-sm uppercase h-10"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="coupon-type" className="text-xs">
                İndirim Türü
              </Label>
              <select
                id="coupon-type"
                value={draft.discountType}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    discountType: e.target.value as CouponDraft["discountType"],
                    discountValue: e.target.value === "percentage" ? "10" : "",
                  })
                }
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring cursor-pointer"
              >
                <option value="percentage">Yüzde (%)</option>
                <option value="fixed">Sabit TL Tutarı</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="coupon-value" className="text-xs">
                {draft.discountType === "percentage" ? "Oran (%)" : "Tutar (TL)"}
              </Label>
              <Input
                id="coupon-value"
                required
                type="number"
                min={draft.discountType === "percentage" ? 1 : 0.01}
                max={draft.discountType === "percentage" ? 100 : undefined}
                step={draft.discountType === "percentage" ? 1 : 0.01}
                value={draft.discountValue}
                onChange={(e) => setDraft({ ...draft, discountValue: e.target.value })}
                className="h-10 text-sm"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="coupon-minimum" className="text-xs">
                Asgari Sepet Tutarı (TL)
              </Label>
              <Input
                id="coupon-minimum"
                type="number"
                min="0"
                step="0.01"
                value={draft.minOrderAmount}
                onChange={(e) => setDraft({ ...draft, minOrderAmount: e.target.value })}
                placeholder="Sınır yok"
                className="h-10 text-sm"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="coupon-maximum" className="text-xs">
                Maksimum İndirim (TL)
              </Label>
              <Input
                id="coupon-maximum"
                type="number"
                min="0.01"
                step="0.01"
                value={draft.maxDiscount}
                onChange={(e) => setDraft({ ...draft, maxDiscount: e.target.value })}
                placeholder="Tavan yok"
                className="h-10 text-sm"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="coupon-usage-limit" className="text-xs">
                Toplam Kullanım Limiti
              </Label>
              <Input
                id="coupon-usage-limit"
                type="number"
                min="1"
                step="1"
                value={draft.usageLimit}
                onChange={(e) => setDraft({ ...draft, usageLimit: e.target.value })}
                placeholder="Sınırsız"
                className="h-10 text-sm"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="coupon-expiry" className="text-xs">
                Son Kullanma Tarihi
              </Label>
              <Input
                id="coupon-expiry"
                type="datetime-local"
                value={draft.expiresAt}
                onChange={(e) => setDraft({ ...draft, expiresAt: e.target.value })}
                className="h-10 text-sm"
              />
            </div>

            <label className="flex min-h-10 items-center gap-2 text-xs font-medium text-foreground sm:col-span-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={draft.isActive}
                onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
                className="size-4 rounded accent-primary cursor-pointer"
              />
              <span>Kuponu hemen kullanıma aç</span>
            </label>
          </div>

          {error && <AdminNotice kind="error">{error}</AdminNotice>}

          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button type="button" variant="outline" size="sm" onClick={onClose} className="cursor-pointer">
              Vazgeç
            </Button>
            <Button type="submit" size="sm" disabled={saving} className="cursor-pointer">
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminCouponsPage() {
  const { data: coupons, error, loading, refresh } = useAdminResource<Coupon[]>("coupons");
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null | undefined>(undefined);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const term = query.trim().toLocaleLowerCase("tr-TR");
  const filteredCoupons = (coupons || []).filter((c) => {
    if (!term) return true;
    return `${c.code}`.toLocaleLowerCase("tr-TR").includes(term);
  });

  const disableCoupon = async (coupon: Coupon) => {
    if (!window.confirm(`“${coupon.code}” kuponunu devre dışı bırakmak istediğinize emin misiniz?`)) return;
    setActionError(null);
    setMessage(null);
    try {
      await runAdminAction("coupon.disable", undefined, coupon._id);
      setMessage(`“${coupon.code}” devre dışı bırakıldı.`);
      await refresh();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Kupon devre dışı bırakılamadı.");
    }
  };

  return (
    <>
      <AdminHeaderAction route={adminPath("coupons")}>
        <Button
          size="sm"
          className="h-9 gap-1.5 cursor-pointer"
          onClick={() => setEditingCoupon(null)}
        >
          <PlusIcon className="size-4" />
          <span>Yeni Kupon Ekle</span>
        </Button>
      </AdminHeaderAction>

      {(message || actionError || error) && (
        <div className="mb-4">
          <AdminNotice kind={actionError || error ? "error" : "success"}>
            {actionError || error || message}
          </AdminNotice>
        </div>
      )}

      <Card className="overflow-hidden rounded-lg">
        {/* Arama & İstatistik Çubuğu */}
        <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-5 sm:items-center">
          <div className="relative min-w-0">
            <Label htmlFor="coupon-search" className="sr-only">
              Kupon ara
            </Label>
            <MagnifyingGlassIcon
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="coupon-search"
              name="coupon-search"
              type="search"
              placeholder="Kupon kodu ara..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 h-10 text-sm font-mono uppercase"
            />
          </div>

          <div className="text-xs text-muted-foreground font-mono text-right">
            Toplam {coupons?.length ?? 0} kupon
          </div>
        </div>

        {/* Kupon Listesi */}
        {loading ? (
          <AdminLoading label="Kuponlar" variant="table" />
        ) : filteredCoupons.length === 0 ? (
          <div className="p-5">
            <AdminEmpty
              title={query ? "Eşleşen kupon bulunamadı" : "Henüz kupon yok"}
              description={
                query
                  ? "Arama kriterini değiştirip tekrar deneyin."
                  : "Yeni kupon oluşturarak müşterilerinize indirim sunun."
              }
            />
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredCoupons.map((coupon) => (
              <article
                key={coupon._id}
                className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5 hover:bg-muted/30 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="font-mono text-sm font-bold text-foreground">
                      {coupon.code}
                    </h2>
                    <Badge
                      variant="outline"
                      className={`text-[11px] font-medium ${
                        coupon.isActive
                          ? "border-transparent bg-primary text-primary-foreground"
                          : "border-border bg-muted text-muted-foreground"
                      }`}
                    >
                      {coupon.isActive ? "Aktif" : "Pasif"}
                    </Badge>
                  </div>

                  <p className="mt-1 text-xs text-muted-foreground">
                    <strong className="text-foreground">
                      {coupon.discountType === "percentage"
                        ? `%${coupon.discountValue}`
                        : formatMoney(coupon.discountValue / 100)}{" "}
                      indirim
                    </strong>
                    {coupon.minOrderAmountKurus !== undefined &&
                      ` · Min. Sepet: ${formatMoney(coupon.minOrderAmountKurus / 100)}`}
                    {coupon.maxDiscountKurus !== undefined &&
                      ` · Maks. İndirim: ${formatMoney(coupon.maxDiscountKurus / 100)}`}
                  </p>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-muted-foreground">
                    <span>
                      Kullanım: <strong>{coupon.usedCount}</strong> / {coupon.usageLimit ?? "∞"}
                    </span>
                    {coupon.expiresAt !== undefined && (
                      <span>
                        Son Tarih: {formatDateTime(coupon.expiresAt)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1.5 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs cursor-pointer"
                    onClick={() => setEditingCoupon(coupon)}
                  >
                    <PencilSquareIcon className="size-3.5" />
                    <span>Düzenle</span>
                  </Button>
                  {coupon.isActive && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                      onClick={() => void disableCoupon(coupon)}
                      title="Devre Dışı Bırak"
                    >
                      <NoSymbolIcon className="size-3.5" />
                      <span>Kapat</span>
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </Card>

      {editingCoupon !== undefined && (
        <CouponEditor
          coupon={editingCoupon}
          onClose={() => setEditingCoupon(undefined)}
          onSaved={async () => {
            setMessage(editingCoupon ? "Kupon güncellendi." : "Kupon oluşturuldu.");
            await refresh();
          }}
        />
      )}
    </>
  );
}
