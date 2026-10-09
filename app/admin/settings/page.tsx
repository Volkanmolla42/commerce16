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
  AdminPageHeader,
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

  if (loading) return <AdminLoading label="Mağaza ayarları" />;
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
      <AdminPageHeader title="Mağaza ayarları" description="Mağaza bilgilerini, iletişim seçeneklerini ve duyuru alanını düzenleyin." />
      {(message || actionError || error) && (
        <div className="mb-5">
          <AdminNotice kind={actionError || error ? "error" : "success"}>
            {actionError || error || message}
          </AdminNotice>
        </div>
      )}

      <form onSubmit={save}>
        <div className="grid items-start gap-4 xl:grid-cols-2">
          <Card className="rounded-lg">
            <CardContent className="space-y-5 p-5 sm:p-6">
              <h2 className="text-sm font-semibold text-foreground">Genel</h2>
              <div className="space-y-2">
                <Label htmlFor="store-name">Mağaza adı</Label>
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
              <div className="space-y-2">
                <Label htmlFor="store-slogan">Slogan</Label>
                <Input
                  id="store-slogan"
                  name="slogan"
                  maxLength={140}
                  value={text("slogan")}
                  onChange={set("slogan")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="store-logo">Logo</Label>
                {logoPreview && (
                  <div className="flex items-center gap-3">
                    <Image src={logoPreview} alt="Mağaza logosu" width={64} height={64} unoptimized className="h-16 w-16 rounded-md border border-border bg-muted object-contain" />
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={saving}
                      onClick={() => {
                        setPendingLogo(null);
                        setLogoEdit(null);
                      }}
                    >
                      Kaldır
                    </Button>
                  </div>
                )}
                <input
                  id="store-logo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={saving || uploadingLogo}
                  onChange={handleLogoSelection}
                  className="block min-h-11 w-full rounded-md border border-input bg-background text-sm text-muted-foreground file:mr-3 file:min-h-11 file:border-0 file:bg-muted file:px-4 file:font-medium"
                />
                {uploadingLogo && <p role="status" className="text-sm text-muted-foreground">Logo yükleniyor…</p>}
              </div>
              <label className="flex min-h-11 items-center gap-3 rounded-md border border-border px-3 text-sm font-medium text-foreground">
                <input
                  type="checkbox"
                  name="isOpen"
                  checked={isOpen}
                  onChange={(event) =>
                    setEdits((current) => ({ ...current, isOpen: event.target.checked }))
                  }
                  className="h-4 w-4"
                />
                Mağaza açık (kapalıysa vitrin yerine bilgi ekranı gösterilir)
              </label>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            <Card className="rounded-lg">
              <CardContent className="space-y-5 p-5 sm:p-6">
                <h2 className="text-sm font-semibold text-foreground">İletişim</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="store-phone">Telefon</Label>
                    <Input
                      id="store-phone"
                      name="phone"
                      autoComplete="tel"
                      maxLength={40}
                      value={text("phone")}
                      onChange={set("phone")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="store-email">E-posta</Label>
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
                <div className="space-y-2">
                  <Label htmlFor="store-address">Adres</Label>
                  <textarea
                    id="store-address"
                    name="address"
                    rows={2}
                    maxLength={300}
                    value={text("address")}
                    onChange={set("address")}
                    className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2.5 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-lg">
              <CardContent className="space-y-5 p-5 sm:p-6">
                <h2 className="text-sm font-semibold text-foreground">Duyuru çubuğu</h2>
                <div className="space-y-2">
                  <Label htmlFor="store-announcement">Duyuru metni</Label>
                  <Input
                    id="store-announcement"
                    name="announcement"
                    maxLength={160}
                    placeholder="Boş bırakılırsa çubuk gösterilmez"
                    value={text("announcement")}
                    onChange={set("announcement")}
                  />
                </div>
              </CardContent>
            </Card>

          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <Button
            type="submit"
            disabled={saving || uploadingLogo || text("storeName").trim().length < 2}
            className="h-11 px-5"
          >
            {saving ? "Kaydediliyor…" : "Değişiklikleri kaydet"}
          </Button>
        </div>
      </form>
    </>
  );
}

export default function AdminSettingsPage() {
  return <AdminSettingsContent />;
}
