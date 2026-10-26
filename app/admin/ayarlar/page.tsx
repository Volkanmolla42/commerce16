"use client";

import { SyntheticEvent, ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AdminActionNotice,
  AdminEmpty,
  AdminLoading,
  AdminNotice,
} from "../_components/admin-primitives";
import { AdminHeaderAction } from "../_components/admin-header-action";
import { runAdminAction, useAdminResource } from "../_components/admin-api";
import { adminPath } from "@/lib/admin/routes";
import { storeConfig } from "@/lib/store-config";
import { DEFAULT_NEW_BADGE_DAYS, MAX_NEW_BADGE_DAYS } from "@/lib/catalog/new-badge";
import type { StoreSettings } from "@/lib/catalog";

type TextSettingKey =
  | "phone"
  | "email"
  | "announcement"
  | "shippingEstimate";
type SettingsEdits = Partial<Pick<StoreSettings, TextSettingKey>> & {
  lowStockThreshold?: number;
  newBadgeDays?: number;
  freeShippingThreshold?: number;
  shippingFee?: number;
  shippingCutoffHour?: number | "";
};

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card className="overflow-hidden rounded-xl">
      <div className="border-b border-border px-4 py-4 sm:px-5">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <CardContent className="space-y-5 p-4 sm:p-5">{children}</CardContent>
    </Card>
  );
}

function AdminSettingsContent() {
  const { data, error, loading, refresh } =
    useAdminResource<StoreSettings>("settings");
  const [edits, setEdits] = useState<SettingsEdits>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [resetConfirmInput, setResetConfirmInput] = useState("");
  const [resetting, setResetting] = useState(false);

  const text = (key: TextSettingKey) => edits[key] ?? data?.[key] ?? "";
  const lowStockThreshold = edits.lowStockThreshold ?? data?.lowStockThreshold ?? 5;
  const newBadgeDays = edits.newBadgeDays ?? data?.newBadgeDays ?? DEFAULT_NEW_BADGE_DAYS;
  const freeShippingThreshold = edits.freeShippingThreshold ?? data?.freeShippingThreshold ?? 0;
  const shippingFee = edits.shippingFee ?? data?.shippingFee ?? 0;
  const shippingCutoffHour = edits.shippingCutoffHour ?? data?.shippingCutoffHour ?? 0;
  const shippingEstimate = text("shippingEstimate");

  const set = (key: keyof SettingsEdits) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => setEdits((current) => ({ ...current, [key]: event.target.value }));

  const save = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setActionError(null);

    try {
      await runAdminAction("settings.update", {
        phone: text("phone"),
        email: text("email"),
        announcement: text("announcement"),
        lowStockThreshold,
        newBadgeDays,
        freeShippingThreshold,
        shippingFee,
        shippingCutoffHour: shippingCutoffHour === "" ? 0 : shippingCutoffHour,
        shippingEstimate: shippingEstimate.trim(),
      });
      setEdits({});
      setMessage("Mağaza ayarları kaydedildi.");
      await refresh();
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : "Mağaza ayarları kaydedilemedi.",
      );
    }
    setSaving(false);
  };

  const handleResetAll = async () => {
    if (resetConfirmInput !== "SIFIRLA") return;
    setResetting(true);
    setMessage(null);
    setActionError(null);

    try {
      await runAdminAction("system.reset-all");
      setIsResetDialogOpen(false);
      setResetConfirmInput("");
      setEdits({});
      setMessage("Tüm mağaza verileri, ürünler, kategoriler, siparişler, müşteriler ve analitik kayıtları başarıyla sıfırlandı.");
      await refresh();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Sıfırlama işlemi başarısız oldu.");
    } finally {
      setResetting(false);
    }
  };

  if (loading) return <AdminLoading label="Mağaza ayarları" variant="settings-content" />;
  if (!data) {
    return (
      <AdminEmpty
          title="Mağaza ayarları yüklenemedi"
          description={error || "Bağlantıyı kontrol edip yeniden deneyebilirsin."}
        />
    );
  }

  return (
    <>
      <AdminHeaderAction route={adminPath("settings")}>
        <Button
          type="submit"
          form="settings-form"
          size="sm"
          disabled={saving}
          className="h-9 px-4 text-xs font-semibold"
        >
          {saving ? "Kaydediliyor…" : "Ayarları Kaydet"}
        </Button>
      </AdminHeaderAction>

      <AdminActionNotice message={message} error={actionError || error} />

      {[storeConfig.legalName, storeConfig.address, storeConfig.taxOffice, storeConfig.taxNumber].some((value) => !value.trim()) ? (
        <div className="mb-5">
          <AdminNotice kind="error">
            Satıcı unvanı, adresi, vergi dairesi ve vergi numarası <code>store.config.json</code> içinde eksik.
            Bu bilgiler tamamlanmadan yasal sözleşmeler hazırlanmaz ve ödeme adımı sipariş kabul etmez.
          </AdminNotice>
        </div>
      ) : null}

      <form id="settings-form" onSubmit={save} className="space-y-6">
        <div className="grid items-start gap-6 xl:grid-cols-2">
          <SettingsSection
            title="Duyuru"
            description="Sitenin üst bandında görünecek kısa duyuru."
          >
            <div className="space-y-1.5">
              <Label htmlFor="store-announcement">Üst Bant Duyurusu</Label>
              <Input
                id="store-announcement"
                name="announcement"
                maxLength={160}
                placeholder="Örn: Tüm siparişlerde kargo ücretsiz"
                value={text("announcement")}
                onChange={set("announcement")}
              />
              <p className="text-[11px] leading-normal text-muted-foreground">
                Sitenin en üstünde görünen kısa duyuru. Boş bırakılırsa gösterilmez.
              </p>
            </div>

          </SettingsSection>

          <div className="space-y-6">
            <SettingsSection
              title="İletişim Bilgileri"
              description="Müşterilerin sipariş ve destek için size ulaşacağı bilgiler."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="store-phone">Telefon Numarası</Label>
                  <Input
                    id="store-phone"
                    name="phone"
                    autoComplete="tel"
                    maxLength={40}
                    value={text("phone")}
                    onChange={set("phone")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="store-email">E-posta Adresi</Label>
                  <Input
                    id="store-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    maxLength={120}
                    value={text("email")}
                    onChange={set("email")}
                  />
                </div>
              </div>
            </SettingsSection>

            <SettingsSection
              title="Vitrin ve Ürünler"
              description="Ürün rozetleri ve stok uyarı eşiği."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="store-new-badge-days">Yeni Ürün Rozeti (Gün)</Label>
                  <Input
                    id="store-new-badge-days"
                    name="newBadgeDays"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={MAX_NEW_BADGE_DAYS}
                    step={1}
                    value={newBadgeDays}
                    onChange={(event) =>
                      setEdits((current) => ({
                        ...current,
                        newBadgeDays: Math.max(0, Math.min(MAX_NEW_BADGE_DAYS, Math.trunc(Number(event.target.value) || 0))),
                      }))
                    }
                  />
                  <p className="text-[11px] leading-normal text-muted-foreground">
                    İlk yayından sonra bu süre boyunca “Yeni” rozeti görünür. 0 = kapalı.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="store-low-stock">Kritik Stok Sınırı (Adet)</Label>
                  <Input
                    id="store-low-stock"
                    name="lowStockThreshold"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={1000}
                    step={1}
                    value={lowStockThreshold}
                    onChange={(event) =>
                      setEdits((current) => ({
                        ...current,
                        lowStockThreshold: Math.max(0, Math.trunc(Number(event.target.value) || 0)),
                      }))
                    }
                  />
                  <p className="text-[11px] leading-normal text-muted-foreground">
                    Bu adet ve altındaki varyantlar “Tükeniyor” rozeti alır.
                  </p>
                </div>
              </div>
            </SettingsSection>
          </div>
        </div>

        <SettingsSection
          title="Kargo ve Teslimat"
          description="Ücretsiz kargo eşiği, kargo ücreti ve teslimat mesajları."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="store-free-shipping">Ücretsiz Kargo Alt Limiti (TL)</Label>
              <Input
                id="store-free-shipping"
                name="freeShippingThreshold"
                type="number"
                inputMode="decimal"
                min={0}
                step="10"
                value={freeShippingThreshold}
                onChange={(event) =>
                  setEdits((current) => ({
                    ...current,
                    freeShippingThreshold: Math.max(0, Number(event.target.value) || 0),
                  }))
                }
              />
              <p className="text-[11px] leading-normal text-muted-foreground">
                Sepet bu tutara ulaştığında kargo ücretsiz olur. 0 = tüm siparişlerde ücretsiz.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="store-shipping-fee">Standart Kargo Ücreti (TL)</Label>
              <Input
                id="store-shipping-fee"
                name="shippingFee"
                type="number"
                inputMode="decimal"
                min={0}
                step="1"
                value={shippingFee}
                onChange={(event) =>
                  setEdits((current) => ({
                    ...current,
                    shippingFee: Math.max(0, Number(event.target.value) || 0),
                  }))
                }
              />
              <p className="text-[11px] leading-normal text-muted-foreground">
                Ücretsiz kargo limitinin altında kalan siparişlerde uygulanır.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="store-shipping-cutoff">Kargo Kesim Saati</Label>
              <Input
                id="store-shipping-cutoff"
                name="shippingCutoffHour"
                type="number"
                inputMode="numeric"
                min={0}
                max={23}
                step={1}
                value={shippingCutoffHour}
                onChange={(event) => {
                  const value = event.target.value;
                  setEdits((current) => ({
                    ...current,
                    shippingCutoffHour: value === ""
                      ? ""
                      : Math.min(23, Math.max(0, Math.trunc(Number(value) || 0))),
                  }));
                }}
              />
              <p className="text-[11px] leading-normal text-muted-foreground">
                Bu saatten önce verilen hafta içi siparişler aynı gün kargoda. 0 = mesaj kapalı.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="store-shipping-estimate">Tahmini Teslimat Metni</Label>
              <Input
                id="store-shipping-estimate"
                name="shippingEstimate"
                maxLength={80}
                value={shippingEstimate}
                onChange={set("shippingEstimate")}
                placeholder="1-2 iş günü"
              />
              <p className="text-[11px] leading-normal text-muted-foreground">
                Ürün sayfasında gösterilir. Boş bırakılırsa gizlenir.
              </p>
            </div>
          </div>
        </SettingsSection>
      </form>

      <div className="mt-8">
        <SettingsSection
          title="Tehlikeli Bölge"
          description="Mağazadaki tüm ürünleri, stokları, kategorileri ve operasyonel verileri sıfırlama."
        >
          <div className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-destructive">Tüm Mağazayı Sıfırla</h3>
              <p className="text-xs text-muted-foreground">
                Tüm ürünler, stoklar, kategoriler, soru-cevaplar, siparişler, müşteriler, sepetler, ödeme yöntemleri, kuponlar, kampanyalar, e-postalar ve analitik verileri kalıcı olarak silinir.
              </p>
            </div>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={saving || resetting}
              onClick={() => {
                setResetConfirmInput("");
                setIsResetDialogOpen(true);
              }}
              className="shrink-0 font-semibold"
            >
              Her Şeyi Sıfırla
            </Button>
          </div>
        </SettingsSection>
      </div>

      <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Tüm Mağaza Verilerini Sıfırla</DialogTitle>
            <DialogDescription>
              Bu işlem geri alınamaz. Tüm ürünler, stoklar, kategoriler, soru-cevaplar, siparişler, müşteriler, sepetler, ödeme yöntemleri, kuponlar, kampanyalar, e-postalar ve analitik verileri kalıcı olarak silinecektir.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="reset-confirm" className="text-xs font-medium">
              Onaylamak için kutuya büyük harflerle <strong className="text-destructive">SIFIRLA</strong> yazın:
            </Label>
            <Input
              id="reset-confirm"
              value={resetConfirmInput}
              onChange={(event) => setResetConfirmInput(event.target.value)}
              placeholder="SIFIRLA"
              disabled={resetting}
              autoFocus
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={resetting}
              onClick={() => setIsResetDialogOpen(false)}
            >
              Vazgeç
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={resetConfirmInput !== "SIFIRLA" || resetting}
              onClick={handleResetAll}
            >
              {resetting ? "Sıfırlanıyor…" : "Her Şeyi Kalıcı Olarak Sil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

}

export default function AdminSettingsPage() {
  return <AdminSettingsContent />;
}
