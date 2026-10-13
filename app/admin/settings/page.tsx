"use client";

import Image from "next/image";
import { FormEvent, useEffect, useRef, useState } from "react";
import {
  Button,
  Card,
  CardContent,
  Input,
  Label,
} from "@/components/ui";
import {
  AdminEmpty,
  AdminLoading,
  AdminNotice,
} from "../_components/admin-primitives";
import { runAdminAction, useAdminResource } from "../_components/admin-api";
import type { StoreSettings } from "@/lib/catalog";

type TextSettingKey =
  | "storeName"
  | "slogan"
  | "phone"
  | "email"
  | "address"
  | "announcement";
type SettingsEdits = Partial<Pick<StoreSettings, TextSettingKey>> & {
  isOpen?: boolean;
  lowStockThreshold?: number;
};

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

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setActionError(null);

    try {
      let nextLogoId = logoStorageId;
      if (pendingLogo) {
        setUploadingLogo(true);
        try {
          const { uploadUrl } = await runAdminAction<{ uploadUrl: string }>(
            "product.image-upload-url",
          );
          const response = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": pendingLogo.blob.type || "image/png" },
            body: pendingLogo.blob,
          });
          if (!response.ok) throw new Error("Logo Convex Storage'a yüklenemedi.");
          const uploaded: unknown = await response.json();
          if (
            typeof uploaded !== "object" || uploaded === null ||
            !("storageId" in uploaded) || typeof uploaded.storageId !== "string"
          ) {
            throw new Error("Yüklenen logonun kimliği alınamadı.");
          }
          nextLogoId = uploaded.storageId;
        } finally {
          setUploadingLogo(false);
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
    } finally {
      setSaving(false);
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
      {(message || actionError || error) && (
        <div className="mb-5">
          <AdminNotice kind={actionError || error ? "error" : "success"}>
            {actionError || error || message}
          </AdminNotice>
        </div>
      )}

      <form onSubmit={save} className="space-y-6">
        <div className="grid items-start gap-6 xl:grid-cols-2">
          {/* Sol Kolon: Genel Bilgiler */}
          <div className="space-y-6">
            <Card className="rounded-lg overflow-hidden">
              <div className="border-b border-border p-4 sm:px-5">
                <h2 className="text-sm font-semibold text-foreground">Genel Mağaza Bilgileri</h2>
              </div>
              <CardContent className="space-y-4 p-4 sm:p-5">
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
                    placeholder="Örn: En taze lezzetler kapınızda"
                    value={text("slogan")}
                    onChange={set("slogan")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="store-logo">Mağaza Logosu</Label>
                  {logoPreview && (
                    <div className="flex items-center gap-3 mb-2 p-3 rounded-lg border border-border bg-card">
                      <Image src={logoPreview} alt="Mağaza logosu" width={48} height={48} unoptimized className="size-12 rounded-md border border-border bg-muted object-contain" />
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
                  )}
                  <input
                    id="store-logo"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={saving || uploadingLogo}
                    onChange={handleLogoSelection}
                    className="block min-h-10 w-full rounded-md border border-input bg-background text-xs text-muted-foreground file:mr-3 file:min-h-10 file:border-0 file:bg-muted file:px-4 file:text-xs file:font-semibold"
                  />
                  {uploadingLogo && <p role="status" className="text-xs text-primary font-medium">Logo yükleniyor…</p>}
                </div>
                <label className="flex items-center justify-between rounded-lg border border-border p-3 text-sm font-medium text-foreground cursor-pointer hover:bg-muted/30 transition-colors">
                  <span>Mağaza Durumu (Açık / Satışa Hazır)</span>
                  <input
                    type="checkbox"
                    name="isOpen"
                    checked={isOpen}
                    onChange={(event) =>
                      setEdits((current) => ({ ...current, isOpen: event.target.checked }))
                    }
                    className="size-4 accent-primary rounded"
                  />
                </label>
              </CardContent>
            </Card>

            <Card className="rounded-lg overflow-hidden">
              <div className="border-b border-border p-4 sm:px-5">
                <h2 className="text-sm font-semibold text-foreground">Duyuru Çubuğu</h2>
              </div>
              <CardContent className="space-y-4 p-4 sm:p-5">
                <div className="space-y-1.5">
                  <Label htmlFor="store-announcement">Üst Bant Duyurusu</Label>
                  <Input
                    id="store-announcement"
                    name="announcement"
                    maxLength={160}
                    placeholder="Örn: 500 TL üzeri kargo bedava!"
                    value={text("announcement")}
                    onChange={set("announcement")}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sağ Kolon: İletişim ve Operasyon */}
          <div className="space-y-6">
            <Card className="rounded-lg overflow-hidden">
              <div className="border-b border-border p-4 sm:px-5">
                <h2 className="text-sm font-semibold text-foreground">İletişim Bilgileri</h2>
              </div>
              <CardContent className="space-y-4 p-4 sm:p-5">
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
              </CardContent>
            </Card>

            <Card className="rounded-lg overflow-hidden">
              <div className="border-b border-border p-4 sm:px-5">
                <h2 className="text-sm font-semibold text-foreground">Stok Uyarı Eşiği</h2>
              </div>
              <CardContent className="space-y-4 p-4 sm:p-5">
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
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            disabled={saving || uploadingLogo || text("storeName").trim().length < 2}
            className="min-h-10 px-6 font-semibold"
          >
            {saving ? "Kaydediliyor…" : "Ayarları Kaydet"}
          </Button>
        </div>
      </form>
    </>
  );
}

export default function AdminSettingsPage() {
  return <AdminSettingsContent />;
}
