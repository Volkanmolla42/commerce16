"use client";

import { routes } from "@/lib/storefront-routes";

import { useState } from "react";
import Link from "next/link";
import { useConvexAuth } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import {
  CheckCircleIcon,
  ChatBubbleLeftRightIcon,
  ExclamationCircleIcon,
  PaperAirplaneIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format-date";

export function ProductQuestions({ productId }: { productId: string }) {
  const questions = useQuery(api.productQuestions.getByProduct, {
    productId: productId as Id<"products">,
  });
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const profile = useQuery(api.users.getMyProfile, isAuthenticated ? {} : "skip");
  const askQuestion = useMutation(api.productQuestions.ask);

  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (question.trim().length < 10) {
      setError("Sorunuz en az 10 karakter olmalıdır.");
      return;
    }

    setLoading(true);
    try {
      await askQuestion({
        productId: productId as Id<"products">,
        question: question.trim(),
      });
      setQuestion("");
      setSuccess(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sorunuz gönderilemedi. Lütfen tekrar deneyin.");
    }
    setLoading(false);
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
      <div className="min-w-0">
        <h3 className="text-base font-semibold text-foreground">Müşteri Soruları</h3>

        {questions === undefined ? (
          <div aria-hidden="true" className="mt-4 space-y-3">
            {[0, 1].map((index) => (
              <div key={index} className="h-24 animate-pulse rounded-xl border border-border/70 bg-muted/30" />
            ))}
          </div>
        ) : questions.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-border/80 bg-muted/20 p-6 text-center">
            <ChatBubbleLeftRightIcon className="mx-auto size-8 text-muted-foreground/60" aria-hidden="true" />
            <p className="mt-2 text-sm font-semibold text-foreground">Henüz soru bulunmuyor</p>
            <p className="mt-1 text-xs text-muted-foreground">Bu ürün hakkında ilk soruyu siz sorabilirsiniz.</p>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {questions.map((item) => (
              <li key={item._id} className="rounded-xl border border-border/70 bg-card p-4">
                <div className="flex justify-end">
                  <time className="text-[10px] text-muted-foreground">
                    {formatDate(item.answeredAt ?? item._creationTime)}
                  </time>
                </div>
                <p className="mt-2 text-sm font-medium text-foreground">{item.question}</p>
                <div className="mt-3 border-l-2 border-primary/30 pl-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Mağaza yanıtı</p>
                  <p className="mt-1 whitespace-pre-line text-sm leading-6 text-muted-foreground">
                    {item.answer}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="min-w-0">
        <h3 className="text-base font-semibold text-foreground">Soru Sor</h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Sorunuz mağaza tarafından yanıtlandıktan sonra bu sayfada yayınlanır.
        </p>

        {authLoading || (isAuthenticated && profile === undefined) ? (
          <div aria-hidden="true" className="mt-4 space-y-3">
            <div className="h-12 animate-pulse rounded-lg border border-border/70 bg-muted/30" />
            <div className="h-28 animate-pulse rounded-xl border border-border/70 bg-muted/30" />
          </div>
        ) : !profile ? (
          <div className="mt-4 rounded-xl border border-border/70 bg-muted/20 p-5 text-center">
            <UserCircleIcon className="mx-auto size-9 text-muted-foreground/60" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-foreground">Soru sormak için giriş yapın</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Sorular hesabınıza bağlanır; adınız ve e-posta adresiniz otomatik olarak kullanılır.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-4">
              <Link href={routes.login}>Giriş Yap</Link>
            </Button>
          </div>
        ) : success ? (
          <div role="status" className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              <CheckCircleIcon className="size-5" aria-hidden="true" />
              Sorunuz alındı
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Yanıtlandığında bu sayfada yayınlanacak.
            </p>
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setSuccess(false)}>
              Yeni soru sor
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-3.5">
            {error ? (
              <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                <ExclamationCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            ) : null}

            <div className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5">
              <UserCircleIcon className="size-6 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-foreground">{profile.name?.trim() || "Hesabım"}</p>
                {profile.email ? (
                  <p className="truncate text-[11px] text-muted-foreground">{profile.email}</p>
                ) : null}
              </div>
            </div>
            <p className="text-[11px] leading-4 text-muted-foreground">
              Adınız ve e-postanız hesabınızdan alınır; e-posta adresiniz yayınlanmaz. Verilerinizin işlenmesi hakkında{" "}
              <Link href={routes.privacyPolicy} className="text-foreground underline underline-offset-2">
                Gizlilik Politikası
              </Link>{" "}
              geçerlidir.
            </p>

            <div className="space-y-1.5">
              <label htmlFor="product-question-text" className="text-xs font-medium text-foreground">
                Sorunuz <span className="text-destructive">*</span>
              </label>
              <textarea
                id="product-question-text"
                rows={4}
                required
                minLength={10}
                maxLength={1000}
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ürünle ilgili merak ettiğinizi yazın..."
                className="w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm leading-relaxed text-foreground shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <Button type="submit" disabled={loading} className="w-full gap-2">
              <PaperAirplaneIcon className="size-4" aria-hidden="true" />
              <span>{loading ? "Gönderiliyor…" : "Soruyu Gönder"}</span>
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
