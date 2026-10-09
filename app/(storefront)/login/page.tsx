"use client";

import { useAuthActions, useConvexAuth } from "@convex-dev/auth/react";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Tick01Icon } from "hugeicons-react";
import {
  Button,
  Input,
  Label,
  Card,
  CardTitle,
  CardDescription,
  Badge,
} from "@/components/ui";

export default function CustomerLoginPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn, signOut } = useAuthActions();
  const router = useRouter();

  const [step, setStep] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        setError(err.message || "Giriş işlemi sırasında bir hata oluştu.");
      } else {
        setError("Giriş işlemi sırasında bir hata oluştu.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-80px)] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  // Already logged-in customer view
  if (isAuthenticated) {
    return (
      <div className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md p-8 text-center shadow-xl border-border bg-card rounded-3xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
            <Tick01Icon className="h-7 w-7" />
          </div>
          <CardTitle className="mt-4 text-2xl font-bold tracking-tight text-foreground">
            Oturum açık
          </CardTitle>
          <CardDescription className="mt-2 text-sm text-muted-foreground">
            Hesabınızı görüntüleyebilir veya oturumu kapatabilirsiniz.
          </CardDescription>

          <div className="mt-6 flex flex-col gap-3">
            <Button asChild size="lg" className="w-full rounded-xl shadow-md font-semibold">
              <Link href="/account/orders">Hesabıma Git</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="w-full rounded-xl font-semibold border-border">
              <Link href="/">Alışverişe Devam Et</Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut()}
              className="text-xs text-muted-foreground hover:text-foreground pt-1"
            >
              Oturumu kapat
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md p-8 shadow-xl border-border bg-card rounded-3xl space-y-6">
        <div className="text-center">

          <h2 className="mt-4 text-2xl font-bold tracking-tight text-foreground">
            {step === "signIn" ? "Giriş Yap" : "Kayıt Ol"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {step === "signIn"
              ? "Siparişlerinizi ve sepetinizi yönetmek için giriş yapın."
              : "Müşteri hesabı oluşturun."}
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm font-medium text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="login-email" className="text-xs uppercase tracking-wider text-muted-foreground">
              E-posta Adresi
            </Label>
            <Input
              id="login-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ornek@musteri.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="login-password" className="text-xs uppercase tracking-wider text-muted-foreground">
              Şifre
            </Label>
            <Input
              id="login-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={isSubmitting}
            className="w-full rounded-xl shadow-md font-semibold h-12"
          >
            {isSubmitting
              ? "İşleniyor..."
              : step === "signIn"
                ? "Giriş Yap"
                : "Kayıt Ol"}
          </Button>
        </form>

        <div className="flex items-center justify-between pt-2 text-xs">
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={() => setStep(step === "signIn" ? "signUp" : "signIn")}
            className="p-0 h-auto font-medium text-primary text-xs"
          >
            {step === "signIn"
              ? "Hesabınız yok mu? Kayıt Olun"
              : "Zaten hesabınız var mı? Giriş Yapın"}
          </Button>
          <Button asChild variant="link" size="sm" className="p-0 h-auto text-xs text-muted-foreground">
            <Link href="/">Mağazaya Dön</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
