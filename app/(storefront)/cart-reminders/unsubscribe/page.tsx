"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button, Card } from "@/components/ui";

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
      setError("İşlem tamamlanamadı. Lütfen yeniden deneyin.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-(--breakpoint-2xl) px-4 py-16 sm:py-24">
      <Card className="mx-auto max-w-lg rounded-3xl border-border bg-card p-8 text-center shadow-lg sm:p-12">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {isDone ? "Hatırlatmalar durduruldu" : "Sepet hatırlatmalarını durdur"}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {isDone
            ? "Bu sepet için e-posta ve WhatsApp hatırlatmaları gönderilmeyecek."
            : token
              ? "Onayladığınızda bu sepet için tüm hatırlatma kanalları kapatılır."
              : "Bağlantı geçersiz veya eksik."}
        </p>
        {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
        {token && !isDone && (
          <Button
            type="button"
            size="lg"
            className="mt-6 w-full rounded-2xl font-semibold"
            disabled={isSubmitting}
            onClick={() => void handleUnsubscribe()}
          >
            {isSubmitting ? "İşleniyor..." : "Hatırlatmaları durdur"}
          </Button>
        )}
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
