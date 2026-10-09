"use client";

import { useState } from "react";
import type { Doc } from "@/convex/_generated/dataModel";
import { Button, Card, Input, Label } from "@/components/ui";
import { AdminEmpty, AdminLoading, AdminNotice, AdminPageHeader } from "../_components/admin-primitives";
import { runAdminAction, useAdminResource } from "../_components/admin-api";
import { formatMoney } from "@/lib/format-money";

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
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(value.trim())) throw new Error(`${label} geçerli bir TL tutarı olmalı.`);
  const kurus = Math.round(Number(value.replace(",", ".")) * 100);
  if (!Number.isSafeInteger(kurus)) throw new Error(`${label} geçersiz.`);
  return kurus;
}

function draftFromCoupon(coupon: Coupon): CouponDraft {
  return {
    code: coupon.code,
    discountType: coupon.discountType,
    discountValue: coupon.discountType === "fixed" ? (coupon.discountValue / 100).toFixed(2) : String(coupon.discountValue),
    minOrderAmount: coupon.minOrderAmountKurus === undefined ? "" : (coupon.minOrderAmountKurus / 100).toFixed(2),
    maxDiscount: coupon.maxDiscountKurus === undefined ? "" : (coupon.maxDiscountKurus / 100).toFixed(2),
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

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const fixedAmount = draft.discountType === "fixed" ? toKurus(draft.discountValue, "İndirim") : null;
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div role="dialog" aria-modal="true" aria-labelledby="coupon-editor-title" className="mx-auto my-8 w-full max-w-xl rounded-lg border border-border bg-card p-5 shadow-xl sm:p-6">
        <h2 id="coupon-editor-title" className="text-lg font-semibold text-foreground">{coupon ? "Kuponu düzenle" : "Yeni kupon"}</h2>
        <form onSubmit={save} className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="coupon-code">Kupon kodu</Label>
              <Input id="coupon-code" required minLength={3} maxLength={32} pattern="[A-Za-z0-9_-]+" value={draft.code} onChange={(event) => setDraft({ ...draft, code: event.target.value })} placeholder="YAZINDIRIM" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="coupon-type">İndirim türü</Label>
              <select id="coupon-type" value={draft.discountType} onChange={(event) => setDraft({ ...draft, discountType: event.target.value as CouponDraft["discountType"], discountValue: event.target.value === "percentage" ? "10" : "" })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring">
                <option value="percentage">Yüzde (%)</option>
                <option value="fixed">Sabit TL tutarı</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="coupon-value">{draft.discountType === "percentage" ? "İndirim yüzdesi" : "İndirim tutarı (TL)"}</Label>
              <Input id="coupon-value" required type="number" min={draft.discountType === "percentage" ? 1 : 0.01} max={draft.discountType === "percentage" ? 100 : undefined} step={draft.discountType === "percentage" ? 1 : 0.01} value={draft.discountValue} onChange={(event) => setDraft({ ...draft, discountValue: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="coupon-minimum">Asgari sepet tutarı (TL)</Label>
              <Input id="coupon-minimum" type="number" min="0" step="0.01" value={draft.minOrderAmount} onChange={(event) => setDraft({ ...draft, minOrderAmount: event.target.value })} placeholder="Sınır yok" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="coupon-maximum">Maksimum indirim (TL)</Label>
              <Input id="coupon-maximum" type="number" min="0.01" step="0.01" value={draft.maxDiscount} onChange={(event) => setDraft({ ...draft, maxDiscount: event.target.value })} placeholder="Tavan yok" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="coupon-usage-limit">Toplam kullanım limiti</Label>
              <Input id="coupon-usage-limit" type="number" min="1" step="1" value={draft.usageLimit} onChange={(event) => setDraft({ ...draft, usageLimit: event.target.value })} placeholder="Sınırsız" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="coupon-expiry">Son kullanma tarihi</Label>
              <Input id="coupon-expiry" type="datetime-local" value={draft.expiresAt} onChange={(event) => setDraft({ ...draft, expiresAt: event.target.value })} />
            </div>
            <label className="flex min-h-10 items-center gap-2 text-sm text-foreground sm:col-span-2">
              <input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })} className="size-4 accent-primary" />
              Kuponu kullanıma aç
            </label>
          </div>
          {error && <AdminNotice kind="error">{error}</AdminNotice>}
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Vazgeç</Button>
            <Button type="submit" disabled={saving}>{saving ? "Kaydediliyor…" : "Kaydet"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AdminCouponsContent() {
  const { data: coupons, error, loading, refresh } = useAdminResource<Coupon[]>("coupons");
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null | undefined>(undefined);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const disableCoupon = async (coupon: Coupon) => {
    if (!window.confirm(`“${coupon.code}” kuponunu devre dışı bırakmak istiyor musun?`)) return;
    setActionError(null);
    setMessage(null);
    try {
      await runAdminAction("coupon.disable", undefined, coupon._id);
      setMessage("Kupon devre dışı bırakıldı.");
      await refresh();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Kupon devre dışı bırakılamadı.");
    }
  };

  return (
    <>
      <AdminPageHeader title="Kuponlar" description="İndirim kuralları ve kullanım limitleri" actions={<Button onClick={() => setEditingCoupon(null)}>Kupon ekle</Button>} />
      {(message || actionError || error) && <div className="mb-4"><AdminNotice kind={actionError || error ? "error" : "success"}>{actionError || error || message}</AdminNotice></div>}
      <Card className="overflow-hidden rounded-lg">
        {loading ? <AdminLoading label="Kuponlar" variant="table" /> : !coupons?.length ? (
          <div className="p-5"><AdminEmpty title="Henüz kupon yok" description="Yeni kupon oluşturarak müşterilerinize indirim tanımlayın." /></div>
        ) : (
          <div className="divide-y divide-border">
            {coupons.map((coupon) => {
              return (
                <article key={coupon._id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-mono text-sm font-semibold text-foreground">{coupon.code}</h2>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        {coupon.isActive ? "Açık" : "Kapalı"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {coupon.discountType === "percentage" ? `%${coupon.discountValue}` : formatMoney(coupon.discountValue / 100)} indirim
                      {coupon.minOrderAmountKurus !== undefined ? ` · Min. ${formatMoney(coupon.minOrderAmountKurus / 100)}` : ""}
                      {coupon.maxDiscountKurus !== undefined ? ` · En çok ${formatMoney(coupon.maxDiscountKurus / 100)}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {coupon.usedCount} / {coupon.usageLimit ?? "∞"} kullanım
                      {coupon.expiresAt !== undefined ? ` · Son tarih ${new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(coupon.expiresAt)}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditingCoupon(coupon)}>Düzenle</Button>
                    {coupon.isActive && <Button variant="outline" size="sm" onClick={() => void disableCoupon(coupon)}>Kapat</Button>}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Card>
      {editingCoupon !== undefined && <CouponEditor coupon={editingCoupon} onClose={() => setEditingCoupon(undefined)} onSaved={async () => { setMessage(editingCoupon ? "Kupon güncellendi." : "Kupon eklendi."); await refresh(); }} />}
    </>
  );
}

export default function AdminCouponsPage() {
  return <AdminCouponsContent />;
}
