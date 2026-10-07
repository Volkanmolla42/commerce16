"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui";

export function RestockUnsubscribe({ token }: { token: string }) {
  const unsubscribe = useMutation(api.restockNotifications.unsubscribe);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleUnsubscribe = async () => {
    setSubmitting(true);
    try {
      const result = await unsubscribe({ token });
      setMessage(result.unsubscribed
        ? "Stok bildirimi aboneliğiniz iptal edildi."
        : "Bu bağlantı geçersiz veya artık kullanılamıyor.");
      window.history.replaceState(null, "", "/restock/unsubscribe");
    } catch {
      setMessage("İşlem tamamlanamadı. Lütfen yeniden deneyin.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto max-w-xl px-4 py-16 sm:py-24">
      <div className="rounded-2xl border border-border bg-background p-6 text-center shadow-sm sm:p-8">
        <h1 className="text-2xl font-semibold text-foreground">Stok bildirimleri</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Bu bağlantı, seçtiğiniz ürün için gönderilen tek seferlik stok bildirimini iptal eder.
        </p>
        {!message ? (
          <Button type="button" onClick={() => void handleUnsubscribe()} disabled={!token || submitting} className="mt-6 rounded-full px-6">
            {submitting ? "İptal ediliyor…" : "Bildirimi iptal et"}
          </Button>
        ) : (
          <p role="status" className="mt-6 text-sm font-medium text-foreground">{message}</p>
        )}
        <Link href="/" className="mt-5 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline">
          Alışverişe dön
        </Link>
      </div>
    </main>
  );
}
