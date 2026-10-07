"use client";

import { useQuery, useMutation } from "convex/react";
import { useConvexAuth, useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import { useState, type ReactNode } from "react";
import {
  UserIcon,
  LockIcon,
  Logout01Icon,
  CheckmarkBadge01Icon,
} from "hugeicons-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@/components/ui";
import { AccountLoginCard } from "./account-gate";
import { Sk } from "./skeleton";

function ProfileCardHeader({
  icon: Icon,
  title,
}: {
  icon: typeof UserIcon;
  title: string;
}) {
  return (
    <CardHeader className="border-b border-border bg-muted/20 px-6 py-4">
      <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
        <Icon className="h-5 w-5 text-primary" />
        <span>{title}</span>
      </CardTitle>
    </CardHeader>
  );
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label
        htmlFor={id}
        className="text-xs uppercase tracking-wider text-muted-foreground"
      >
        {label}
      </Label>
      {children}
      {hint}
    </div>
  );
}

export default function AccountProfilePage() {
  const profile = useQuery(api.users.getMyProfile);
  const updateProfile = useMutation(api.users.updateProfile);
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const { signOut } = useAuthActions();

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
      setStatusMessage("Profil güncellendi.");
    } catch {
      setStatusMessage("Bilgiler güncellenirken bir hata oluştu.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!authLoading && !isAuthenticated) {
    return <AccountLoginCard />;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
      {/* Profil Bilgileri */}
      <Card className="rounded-3xl border-border bg-card shadow-xs">
        <ProfileCardHeader icon={UserIcon} title="Kişisel Bilgiler" />
        <CardContent className="p-6">
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            {statusMessage && (
              <div className="flex items-center gap-2 rounded-2xl bg-emerald-500/10 p-3.5 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckmarkBadge01Icon className="h-4 w-4 shrink-0" />
                <span>{statusMessage}</span>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="prof-name" label="Ad Soyad">
              {!profile ? (
                <Sk className="h-10 rounded-xl" />
              ) : (
              <Input
                id="prof-name"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Adınız ve Soyadınız"
              />
              )}
            </Field>

            <Field id="prof-phone" label="Telefon Numarası">
              {!profile ? (
                <Sk className="h-10 rounded-xl" />
              ) : (
              <Input
                id="prof-phone"
                type="tel"
                autoComplete="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="05XX XXX XX XX"
              />
              )}
            </Field>
            </div>

            <Field
              id="prof-email"
              label="E-Posta Adresi"
              hint={
                <p className="text-[11px] text-muted-foreground">
                  E-posta adresi güvenlik nedeniyle değiştirilemez.
                </p>
              }
            >
              {!profile ? (
                <Sk className="h-10 rounded-xl" />
              ) : (
              <Input
                id="prof-email"
                type="email"
                disabled
                value={profile.email || ""}
                className="bg-muted cursor-not-allowed opacity-75"
              />
              )}
            </Field>

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
        <ProfileCardHeader icon={LockIcon} title="Şifre Değiştir" />
        <CardContent className="p-6">
          <form onSubmit={(event) => event.preventDefault()} className="space-y-4">
            <p className="text-xs text-muted-foreground">Şifre değiştirme şu anda kullanılamıyor.</p>

            <Field id="curr-pass" label="Mevcut Şifre">
              <Input
                id="curr-pass"
                type="password"
                autoComplete="current-password"
                disabled
                placeholder="••••••••"
              />
            </Field>

            <Field id="new-pass" label="Yeni Şifre">
              <Input
                id="new-pass"
                type="password"
                autoComplete="new-password"
                disabled
                placeholder="En az 6 karakter"
              />
            </Field>

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

      {/* Oturumu Kapat */}
      <Card className="rounded-3xl border-border bg-card shadow-xs">
        <CardContent className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-foreground">Oturumu Kapat</p>
            <p className="text-xs text-muted-foreground">
              Hesabınızdan çıkış yapın.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => signOut()}
            className="rounded-2xl gap-2 font-semibold border-border self-start sm:self-auto"
          >
            <Logout01Icon className="h-4 w-4 text-muted-foreground" />
            <span>Oturumu Kapat</span>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
