"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button, Card } from "@/components/ui";
import {
  BellSlashIcon,
  CheckCircleIcon,
  ArrowLeftIcon,
} from "@heroicons/react/24/outline";

function UnsubscribeContent() {
  const token = useSearchParams().get("token");
  const unsubscribe = useMutation(api.abandonedCartRecovery.unsubscribe);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUnsubscribe = async () => {
    if (!token || isSubmitting || isDone) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await unsubscribe({ token });
      setIsDone(true);
    } catch {
      setError("İşlem tamamlanamadı. Lütfen sayfayı yenileyip tekrar deneyin.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:py-24">
      <Card className="mx-auto max-w-lg rounded-3xl border-border bg-card p-8 text-center shadow-lg sm:p-12 space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          {isDone ? (
            <CheckCircleIcon className="h-7 w-7 text-emerald-500" />
          ) : (
            <BellSlashIcon className="h-7 w-7 text-primary" />
          )}
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {isDone ? "Hatırlatmalar Durduruldu" : "Sepet Hatırlatmasını Kapat"}
        </h1>

        <p className="text-sm text-muted-foreground leading-relaxed">
          {isDone
            ? "Bu sepet için e-posta hatırlatmaları başarıyla kapatıldı. İlginiz için teşekkür ederiz."
            : token
              ? "Onayladığınızda bu alışveriş sepeti için hatırlatma e-postaları durdurulacaktır."
              : "Bağlantı geçersiz veya eksik."}
        </p>

        {error && (
          <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm font-medium text-destructive">
            {error}
          </div>
        )}

        {token && !isDone && (
          <Button
            type="button"
            size="lg"
            className="w-full rounded-xl font-semibold h-11"
            disabled={isSubmitting}
            onClick={() => void handleUnsubscribe()}
          >
            {isSubmitting ? "İşleniyor..." : "Hatırlatmaları Durdur"}
          </Button>
        )}

        <div className="pt-2">
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

export default function CartReminderUnsubscribePage() {
  return (
    <Suspense fallback={<div className="px-4 py-16 text-center text-sm text-muted-foreground">Sayfa yükleniyor...</div>}>
      <UnsubscribeContent />
    </Suspense>
  );
}
