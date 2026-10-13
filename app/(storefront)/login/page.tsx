"use client";

import { useAuthActions, useConvexAuth } from "@convex-dev/auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Button,
  Input,
  Label,
  Card,
} from "@/components/ui";
import {
  LockClosedIcon,
  EnvelopeIcon,
  ArrowLeftIcon,
  UserPlusIcon,
  KeyIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import { Door01Icon } from "hugeicons-react";

type AuthStep = "signIn" | "signUp" | "forgotPassword" | "resetPassword";

export default function CustomerLoginPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn } = useAuthActions();
  const router = useRouter();

  const [step, setStep] = useState<AuthStep>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/account/orders");
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    setIsSubmitting(true);

    try {
      if (step === "signIn" || step === "signUp") {
        await signIn("password", {
          email,
          password,
          flow: step,
        });
        router.push("/account/orders");
      } else if (step === "forgotPassword") {
        // Şifre sıfırlama kodu isteği
        await signIn("password", {
          email,
          flow: "reset",
        });
        setInfoMessage(`${email} adresine tek kullanımlık doğrulama kodu gönderildi.`);
        setStep("resetPassword");
      } else if (step === "resetPassword") {
        // Yeni şifre ve kod ile sıfırlama
        await signIn("password", {
          email,
          code: code.trim(),
          newPassword,
          flow: "reset-verification",
        });
        router.push("/account/orders");
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || "İşlem sırasında bir hata oluştu. Lütfen bilgilerinizi kontrol edin.");
      } else {
        setError("İşlem sırasında bir hata oluştu. Lütfen bilgilerinizi kontrol edin.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || isAuthenticated) {
    return (
      <div className="flex min-h-[calc(100vh-120px)] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  const isResetFlow = step === "forgotPassword" || step === "resetPassword";

  return (
    <div className="flex min-h-[calc(100vh-120px)] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md p-6 sm:p-8 shadow-xl border-border bg-card rounded-3xl space-y-6">
        {/* Brand / Mode Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mx-auto mb-1">
            {step === "signIn" && <Door01Icon className="h-6 w-6" />}
            {step === "signUp" && <UserPlusIcon className="h-6 w-6" />}
            {isResetFlow && <KeyIcon className="h-6 w-6" />}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {step === "signIn" && "Hesabınıza Giriş Yapın"}
            {step === "signUp" && "Yeni Hesap Oluşturun"}
            {step === "forgotPassword" && "Şifrenizi mi Unuttunuz?"}
            {step === "resetPassword" && "Yeni Şifre Belirleyin"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {step === "signIn" && "Siparişlerinizi ve favorilerinizi yönetmek için giriş yapın."}
            {step === "signUp" && "Hızlı sipariş ve kolay takip için hemen üye olun."}
            {step === "forgotPassword" && "E-posta adresinize tek kullanımlık şifre sıfırlama kodu göndereceğiz."}
            {step === "resetPassword" && "E-postanıza gelen kodu ve yeni şifrenizi giriniz."}
          </p>
        </div>

        {/* Segmented Switcher (Only on signIn / signUp) */}
        {!isResetFlow && (
          <div className="grid grid-cols-2 rounded-2xl bg-muted p-1 text-sm font-medium">
            <button
              type="button"
              onClick={() => {
                setStep("signIn");
                setError(null);
                setInfoMessage(null);
              }}
              className={`rounded-xl py-2 text-center transition-all ${
                step === "signIn"
                  ? "bg-card text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Giriş Yap
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("signUp");
                setError(null);
                setInfoMessage(null);
              }}
              className={`rounded-xl py-2 text-center transition-all ${
                step === "signUp"
                  ? "bg-card text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Kayıt Ol
            </button>
          </div>
        )}

        {/* Info Message */}
        {infoMessage && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-sm font-medium text-emerald-600 dark:text-emerald-400 flex items-start gap-2.5">
            <CheckCircleIcon className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{infoMessage}</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-3.5 text-sm font-medium text-destructive flex items-start gap-2.5">
            <span className="shrink-0 mt-0.5">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* E-posta Alanı */}
          {step !== "resetPassword" && (
            <div className="space-y-2">
              <Label htmlFor="login-email" className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                E-posta Adresi
              </Label>
              <div className="relative">
                <EnvelopeIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ornek@musteri.com"
                  className="pl-11 h-11 rounded-xl"
                />
              </div>
            </div>
          )}

          {/* Şifre Alanı (Giriş & Kayıt) */}
          {(step === "signIn" || step === "signUp") && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="login-password" className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  Şifre
                </Label>
                {step === "signIn" && (
                  <button
                    type="button"
                    onClick={() => {
                      setStep("forgotPassword");
                      setError(null);
                      setInfoMessage(null);
                    }}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Şifremi Unuttum?
                  </button>
                )}
              </div>
              <div className="relative">
                <LockClosedIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="login-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-11 h-11 rounded-xl"
                />
              </div>
            </div>
          )}

          {/* Şifre Sıfırlama: Kod & Yeni Şifre Alanları */}
          {step === "resetPassword" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="reset-code" className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  Doğrulama Kodu (OTP)
                </Label>
                <div className="relative">
                  <KeyIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="reset-code"
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="E-postanıza gelen kod"
                    className="pl-11 h-11 rounded-xl font-mono tracking-wider text-base"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reset-new-password" className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  Yeni Şifre
                </Label>
                <div className="relative">
                  <LockClosedIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="reset-new-password"
                    type="password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="En az 8 karakter"
                    className="pl-11 h-11 rounded-xl"
                  />
                </div>
              </div>
            </>
          )}

          <Button
            type="submit"
            size="lg"
            disabled={isSubmitting}
            className="w-full rounded-xl shadow-md font-semibold h-11 mt-2 cursor-pointer"
          >
            {isSubmitting
              ? "İşleniyor..."
              : step === "signIn"
              ? "Giriş Yap"
              : step === "signUp"
              ? "Hesap Oluştur"
              : step === "forgotPassword"
              ? "Doğrulama Kodu Gönder"
              : "Şifremi Güncelle ve Giriş Yap"}
          </Button>
        </form>

        {/* Back to Login Button in Reset Flow */}
        {isResetFlow && (
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => {
                setStep("signIn");
                setError(null);
                setInfoMessage(null);
              }}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Giriş Ekranına Dön
            </button>
          </div>
        )}

        {/* Return to Store */}
        <div className="border-t border-border pt-4 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" />
            <span>Alışverişe Devam Et</span>
          </Link>
        </div>
      </Card>
    </div>
  );
}
