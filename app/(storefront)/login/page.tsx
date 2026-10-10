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
  ShieldCheckIcon,
  ArrowLeftIcon,
  UserPlusIcon,
  ArrowRightOnRectangleIcon,
} from "@heroicons/react/24/outline";
import { ArrowRight01Icon } from "hugeicons-react";

export default function CustomerLoginPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn } = useAuthActions();
  const router = useRouter();

  const [step, setStep] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/account/orders");
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await signIn("password", {
        email,
        password,
        flow: step,
      });
      router.push("/account/orders");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || "Giriş işlemi sırasında bir hata oluştu. Lütfen bilgilerinizi kontrol edin.");
      } else {
        setError("Giriş işlemi sırasında bir hata oluştu. Lütfen bilgilerinizi kontrol edin.");
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

  return (
    <div className="flex min-h-[calc(100vh-120px)] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md p-6 sm:p-8 shadow-xl border-border bg-card rounded-3xl space-y-6">
        {/* Brand / Mode Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mx-auto mb-1">
            {step === "signIn" ? (
              <ArrowRight01Icon className="h-6 w-6" />
            ) : (
              <UserPlusIcon className="h-6 w-6" />
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {step === "signIn" ? "Hesabınıza Giriş Yapın" : "Yeni Hesap Oluşturun"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {step === "signIn"
              ? "Siparişlerinizi ve favorilerinizi yönetmek için giriş yapın."
              : "Hızlı sipariş ve kolay takip için hemen üye olun."}
          </p>
        </div>

        {/* Segmented Switcher */}
        <div className="grid grid-cols-2 rounded-2xl bg-muted p-1 text-sm font-medium">
          <button
            type="button"
            onClick={() => {
              setStep("signIn");
              setError(null);
            }}
            className={`rounded-xl py-2 text-center transition-all ${step === "signIn"
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
            }}
            className={`rounded-xl py-2 text-center transition-all ${step === "signUp"
                ? "bg-card text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
              }`}
          >
            Kayıt Ol
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-3.5 text-sm font-medium text-destructive flex items-start gap-2.5">
            <span className="shrink-0 mt-0.5">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
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

          <div className="space-y-2">
            <Label htmlFor="login-password" className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Şifre
            </Label>
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

          <Button
            type="submit"
            size="lg"
            disabled={isSubmitting}
            className="w-full rounded-xl shadow-md font-semibold h-11 mt-2"
          >
            {isSubmitting
              ? "İşleniyor..."
              : step === "signIn"
                ? "Giriş Yap"
                : "Hesap Oluştur"}
          </Button>
        </form>

        {/* Security Trust Note */}
        <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground pt-1">
          <ShieldCheckIcon className="h-4 w-4 text-emerald-500 shrink-0" />
          <span>256-Bit SSL ile güvenli bağlantı</span>
        </div>

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
