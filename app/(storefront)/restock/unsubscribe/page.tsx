"use client";

import { useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Suspense, useState } from "react";
import Link from "next/link";
import { CheckCircleIcon, ExclamationCircleIcon, BellSlashIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import ContentPageLayout from "@/components/layout/content-page-layout";

function RestockUnsubscribeContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const sub = useQuery(api.restock.getSubscriptionByToken, token ? { token } : "skip");
  const unsubscribe = useMutation(api.restock.unsubscribe);

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleUnsubscribe = async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const res = await unsubscribe({ token });
      if (res.ok) {
        setSuccess(true);
      } else {
        setError(res.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Abonelik iptali sırasında bir hata oluştu.");
    }
    setLoading(false);
  };

  if (!token) {
    return (
      <ContentPageLayout>
        <div className="py-12 text-center max-w-md mx-auto space-y-4">
          <div className="flex size-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 mx-auto">
            <ExclamationCircleIcon className="size-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Geçersiz Bağlantı</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Abonelik iptal belirteci bulunamadı. Lütfen e-postanızdaki bağlantıyı eksiksiz açtığınızdan emin olun.
          </p>
          <div className="pt-2">
            <Button asChild variant="outline">
              <Link href="/">Ana Sayfaya Dön</Link>
            </Button>
          </div>
        </div>
      </ContentPageLayout>
    );
  }

  if (sub === undefined) {
    return (
      <ContentPageLayout>
        <div className="py-16 text-center max-w-md mx-auto space-y-4">
          <div className="animate-pulse space-y-4">
            <div className="size-12 bg-muted rounded-full mx-auto" />
            <div className="h-6 bg-muted rounded w-3/4 mx-auto" />
            <div className="h-4 bg-muted rounded w-1/2 mx-auto" />
          </div>
        </div>
      </ContentPageLayout>
    );
  }

  if (sub === null) {
    return (
      <ContentPageLayout>
        <div className="py-12 text-center max-w-md mx-auto space-y-4">
          <div className="flex size-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 mx-auto">
            <ExclamationCircleIcon className="size-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Abonelik Bulunamadı</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Bu bildirim kaydı sistemde bulunamadı veya daha önce sonlandırılmış olabilir.
          </p>
          <div className="pt-2">
            <Button asChild variant="outline">
              <Link href="/">Alışverişe Devam Et</Link>
            </Button>
          </div>
        </div>
      </ContentPageLayout>
    );
  }

  const isAlreadyCancelled = sub.status === "cancelled" || success;

  return (
    <ContentPageLayout>
      <div className="py-8 text-center max-w-md mx-auto space-y-4">
        {isAlreadyCancelled ? (
          <>
            <div className="flex size-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 mx-auto">
              <CheckCircleIcon className="size-8" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Aboneliğiniz İptal Edildi</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              <strong>{sub.productTitle}</strong> ürünü için stok bildirim aboneliğiniz sonlandırıldı. Artık bu ürünle ilgili e-posta almayacaksınız.
            </p>
            <div className="flex flex-col sm:flex-row gap-2.5 justify-center pt-2">
              {sub.productSlug && (
                <Button asChild variant="outline">
                  <Link href={`/product/${sub.productSlug}`}>Ürünü İncele</Link>
                </Button>
              )}
              <Button asChild>
                <Link href="/">Mağazaya Dön</Link>
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive mx-auto">
              <BellSlashIcon className="size-7" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Stok Bildirimini İptal Et</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              <strong>{sub.email}</strong> adresi için <strong>{sub.productTitle}</strong> ürününün stok bildirimini iptal etmek üzeresiniz.
            </p>

            {error && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs font-medium text-destructive">
                {error}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5 justify-center pt-2">
              <Button asChild variant="ghost">
                <Link href="/">Vazgeç</Link>
              </Button>
              <Button
                variant="destructive"
                disabled={loading}
                onClick={handleUnsubscribe}
              >
                {loading ? "İptal Ediliyor..." : "Bildirimi İptal Et"}
              </Button>
            </div>
          </>
        )}
      </div>
    </ContentPageLayout>
  );
}

export default function RestockUnsubscribePage() {
  return (
    <Suspense
      fallback={
        <ContentPageLayout>
          <div className="py-16 text-center max-w-md mx-auto space-y-4">
            <div className="animate-pulse space-y-4">
              <div className="size-12 bg-muted rounded-full mx-auto" />
              <div className="h-6 bg-muted rounded w-3/4 mx-auto" />
              <div className="h-4 bg-muted rounded w-1/2 mx-auto" />
            </div>
          </div>
        </ContentPageLayout>
      }
    >
      <RestockUnsubscribeContent />
    </Suspense>
  );
}
