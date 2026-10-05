"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import {
  UserIcon,
  LockIcon,
  CheckmarkBadge01Icon,
} from "hugeicons-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AccountProfilePage() {
  const profile = useQuery(api.users.getMyProfile);
  const updateProfile = useMutation(api.users.updateProfile);

  // Profil Formu
  const [nameDraft, setFullName] = useState<string>();
  const [phoneDraft, setPhoneNumber] = useState<string>();
  const fullName = nameDraft ?? profile?.name ?? "";
  const phoneNumber = phoneDraft ?? profile?.phone ?? "";
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMessage(null);

    try {
      await updateProfile({
        name: fullName.trim(),
        phone: phoneNumber.trim(),
      });
      setStatusMessage("Profil bilgileriniz başarıyla güncellendi.");
    } catch {
      setStatusMessage("Bilgiler güncellenirken bir hata oluştu.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-base font-bold text-foreground">Profil ve Güvenlik</h2>
        <p className="text-xs text-muted-foreground">
          Kişisel bilgilerinizi ve hesap güvenliği ayarlarınızı buradan güncelleyebilirsiniz.
        </p>
      </div>

      {/* Profil Bilgileri */}
      <Card className="rounded-3xl border-border bg-card shadow-xs">
        <CardHeader className="border-b border-border bg-muted/20 px-6 py-4">
          <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
            <UserIcon className="h-5 w-5 text-primary" />
            <span>Kişisel Bilgiler</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            {statusMessage && (
              <div className="flex items-center gap-2 rounded-2xl bg-emerald-500/10 p-3.5 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckmarkBadge01Icon className="h-4 w-4 shrink-0" />
                <span>{statusMessage}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="prof-name" className="text-xs uppercase tracking-wider text-muted-foreground">
                Ad Soyad
              </Label>
              <Input
                id="prof-name"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Adınız ve Soyadınız"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prof-email" className="text-xs uppercase tracking-wider text-muted-foreground">
                E-Posta Adresi
              </Label>
              <Input
                id="prof-email"
                type="email"
                disabled
                value={profile?.email || ""}
                className="bg-muted cursor-not-allowed opacity-75"
              />
              <p className="text-[11px] text-muted-foreground">
                E-posta adresi güvenlik nedeniyle değiştirilemez.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="prof-phone" className="text-xs uppercase tracking-wider text-muted-foreground">
                Telefon Numarası
              </Label>
              <Input
                id="prof-phone"
                type="tel"
                autoComplete="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="05XX XXX XX XX"
              />
            </div>

            <Button
              type="submit"
              disabled={isSaving || !profile}
              className="rounded-2xl font-semibold shadow-md"
            >
              {isSaving ? "Kaydediliyor..." : "Değişiklikleri Kaydet"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Şifre Değiştir */}
      <Card className="rounded-3xl border-border bg-card shadow-xs">
        <CardHeader className="border-b border-border bg-muted/20 px-6 py-4">
          <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
            <LockIcon className="h-5 w-5 text-primary" />
            <span>Şifre Değiştir</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={(event) => event.preventDefault()} className="space-y-4">
            <p className="text-xs text-muted-foreground">Şifre değiştirme şu anda kullanılamıyor.</p>

            <div className="space-y-2">
              <Label htmlFor="curr-pass" className="text-xs uppercase tracking-wider text-muted-foreground">
                Mevcut Şifre
              </Label>
              <Input
                id="curr-pass"
                type="password"
                autoComplete="current-password"
                disabled
                placeholder="••••••••"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-pass" className="text-xs uppercase tracking-wider text-muted-foreground">
                Yeni Şifre
              </Label>
              <Input
                id="new-pass"
                type="password"
                autoComplete="new-password"
                disabled
                placeholder="En az 6 karakter"
              />
            </div>

            <Button
              type="submit"
              variant="outline"
              disabled
              className="rounded-2xl font-semibold border-border"
            >
              Şifreyi Güncelle
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
