"use client";

import Image from "next/image";
import { SyntheticEvent, ReactNode, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AdminEmpty,
  AdminLoading,
  AdminNotice,
} from "../_components/admin-primitives";
import { AdminHeaderAction } from "../_components/admin-header-action";
import { runAdminAction, useAdminResource } from "../_components/admin-api";
import { adminPath } from "@/lib/admin/routes";
import { DEFAULT_NEW_BADGE_DAYS, MAX_NEW_BADGE_DAYS } from "@/lib/catalog/new-badge";
import type { StoreSettings } from "@/lib/catalog";

type TextSettingKey =
  | "storeName"
  | "slogan"
  | "phone"
  | "email"
  | "address"
  | "announcement"
  | "shippingEstimate";
type SettingsEdits = Partial<Pick<StoreSettings, TextSettingKey>> & {
  isOpen?: boolean;
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
  const [logoEdit, setLogoEdit] = useState<string | null | undefined>(undefined);
  const [pendingLogo, setPendingLogo] = useState<{ blob: Blob; previewUrl: string } | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const previewUrl = useRef<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => () => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
  }, []);

  const logoStorageId = logoEdit !== undefined ? logoEdit : (data?.logoStorageId ?? null);

  const text = (key: TextSettingKey) => edits[key] ?? data?.[key] ?? "";
  const isOpen = edits.isOpen ?? data?.isOpen ?? true;
  const lowStockThreshold = edits.lowStockThreshold ?? data?.lowStockThreshold ?? 5;
  const newBadgeDays = edits.newBadgeDays ?? data?.newBadgeDays ?? DEFAULT_NEW_BADGE_DAYS;
  const freeShippingThreshold = edits.freeShippingThreshold ?? data?.freeShippingThreshold ?? 0;
  const shippingFee = edits.shippingFee ?? data?.shippingFee ?? 0;
  const shippingCutoffHour = edits.shippingCutoffHour ?? data?.shippingCutoffHour ?? 0;
  const shippingEstimate = text("shippingEstimate");
  const logoPreview = pendingLogo?.previewUrl || data?.logoUrl || "";

  const set = (key: keyof SettingsEdits) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => setEdits((current) => ({ ...current, [key]: event.target.value }));

  const handleLogoSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setActionError("Yalnızca görsel dosyaları yüklenebilir.");
      return;
    }
    setActionError(null);
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    const url = URL.createObjectURL(file);
    previewUrl.current = url;
    setPendingLogo({ blob: file, previewUrl: url });
  };

  const save = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setActionError(null);

    try {
      let nextLogoId = logoStorageId;
      if (pendingLogo) {
        setUploadingLogo(true);
        let logoError = false;
        try {
          const { uploadUrl } = await runAdminAction<{ uploadUrl: string }>(
            "product.image-upload-url",
          );
          const response = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": pendingLogo.blob.type || "image/png" },
            body: pendingLogo.blob,
          });
          const uploaded: unknown = response.ok ? await response.json() : null;
          if (
            response.ok &&
            typeof uploaded === "object" && uploaded !== null &&
            "storageId" in uploaded && typeof uploaded.storageId === "string"
          ) {
            nextLogoId = uploaded.storageId;
          } else {
            setActionError(
              response.ok ? "Yüklenen logonun kimliği alınamadı." : "Logo Convex Storage'a yüklenemedi.",
            );
            logoError = true;
          }
        } catch (cause) {
          setActionError(cause instanceof Error ? cause.message : "Logo yüklenemedi.");
          logoError = true;
        }
        setUploadingLogo(false);
        if (logoError) {
          setSaving(false);
          return;
        }
      }
      await runAdminAction("settings.update", {
        storeName: text("storeName").trim(),
        slogan: text("slogan"),
        logoStorageId: nextLogoId || "",
        phone: text("phone"),
        email: text("email"),
        address: text("address"),
        announcement: text("announcement"),
        isOpen,
        lowStockThreshold,
        newBadgeDays,
        freeShippingThreshold,
        shippingFee,
        shippingCutoffHour: shippingCutoffHour === "" ? 0 : shippingCutoffHour,
        shippingEstimate: shippingEstimate.trim(),
      });
      setEdits({});
      setPendingLogo(null);
      setLogoEdit(nextLogoId);
      setMessage("Mağaza ayarları kaydedildi.");
      await refresh();
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : "Mağaza ayarları kaydedilemedi.",
      );
    }
    setSaving(false);
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
          disabled={saving || uploadingLogo || text("storeName").trim().length < 2}
          className="h-9 px-4 text-xs font-semibold"
        >
          {saving ? "Kaydediliyor…" : "Ayarları Kaydet"}
        </Button>
      </AdminHeaderAction>

      {(message || actionError || error) && (
        <div className="mb-5">
          <AdminNotice kind={actionError || error ? "error" : "success"}>
            {actionError || error || message}
          </AdminNotice>
        </div>
      )}

      <form id="settings-form" onSubmit={save} className="space-y-6">
        <div className="grid items-start gap-6 xl:grid-cols-2">
          <SettingsSection
            title="Mağaza Profili"
            description="Mağaza adı, logo, üst duyuru ve satış durumu."
          >
            <div className="space-y-1.5">
              <Label htmlFor="store-name">Mağaza Adı</Label>
              <Input
                id="store-name"
                name="storeName"
                autoComplete="organization"
                required
                minLength={2}
                maxLength={80}
                value={text("storeName")}
                onChange={set("storeName")}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="store-slogan">Slogan</Label>
              <Input
                id="store-slogan"
                name="slogan"
                maxLength={140}
                placeholder="Mağazanızın kısa tanıtım cümlesi"
                value={text("slogan")}
                onChange={set("slogan")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="store-logo">Mağaza Logosu</Label>
              {logoPreview ? (
                <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-3">
                  <Image
                    src={logoPreview}
                    alt="Mağaza logosu"
                    width={48}
                    height={48}
                    unoptimized
                    className="size-12 rounded-md border border-border bg-background object-contain"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={saving}
                    onClick={() => {
                      setPendingLogo(null);
                      setLogoEdit(null);
                    }}
                    className="text-xs text-destructive hover:text-destructive"
                  >
                    Logoyu Kaldır
                  </Button>
                </div>
              ) : null}
              <input
                id="store-logo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={saving || uploadingLogo}
                onChange={handleLogoSelection}
                className="block min-h-10 w-full rounded-md border border-input bg-background text-xs text-muted-foreground file:mr-3 file:min-h-10 file:border-0 file:bg-muted file:px-4 file:text-xs file:font-semibold"
              />
              {uploadingLogo ? (
                <p role="status" className="text-xs font-medium text-primary">
                  Logo yükleniyor…
                </p>
              ) : null}
            </div>

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

            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-border p-3 transition-colors hover:bg-muted/30">
              <span className="text-sm font-medium text-foreground">
                Mağaza Durumu
                <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                  Kapalıyken sipariş alınmaz.
                </span>
              </span>
              <input
                type="checkbox"
                name="isOpen"
                checked={isOpen}
                onChange={(event) =>
                  setEdits((current) => ({ ...current, isOpen: event.target.checked }))
                }
                className="size-4 shrink-0 rounded accent-primary"
              />
            </label>
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
              <div className="space-y-1.5">
                <Label htmlFor="store-address">Mağaza / Şirket Adresi</Label>
                <textarea
                  id="store-address"
                  name="address"
                  rows={2}
                  maxLength={300}
                  value={text("address")}
                  onChange={set("address")}
                  className="min-h-20 w-full rounded-md border border-input bg-background p-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring"
                />
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
    </>
  );

}

export default function AdminSettingsPage() {
  return <AdminSettingsContent />;
}
