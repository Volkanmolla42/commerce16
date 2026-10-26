"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { routes } from "@/lib/storefront-routes";
import { COOKIE_CONSENT_POLICY_VERSION } from "@/lib/privacy/consent";
import type { Id } from "@/convex/_generated/dataModel";
import { BellIcon, CheckCircleIcon, ExclamationCircleIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface RestockNotificationDialogProps {
  productId: string;
  variantId?: string;
  productTitle: string;
  variantTitle?: string;
  className?: string;
}

export function RestockNotificationDialog({
  productId,
  variantId,
  productTitle,
  variantTitle,
  className = "",
}: RestockNotificationDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const subscribe = useMutation(api.restock.subscribe);

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setStatus("error");
      setMessage("Lütfen geçerli bir e-posta adresi girin.");
      return;
    }
    if (!consent) {
      setStatus("error");
      setMessage("Bildirim oluşturmak için gizlilik politikasını kabul etmeniz gerekir.");
      return;
    }

    setLoading(true);
    setStatus("idle");
    setMessage("");

    try {
      const res = await subscribe({
        productId: productId as Id<"products">,
        variantId,
        email,
        consentVersion: COOKIE_CONSENT_POLICY_VERSION,
      });

      setStatus("success");
      setMessage(res.message);
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Bir hata oluştu. Lütfen tekrar deneyin.");
    }
    setLoading(false);
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setTimeout(() => {
        setStatus("idle");
        setMessage("");
      }, 200);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="lg"
        onClick={() => setIsOpen(true)}
        className={`h-12 w-full rounded-xl border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 font-semibold gap-2 transition-colors shadow-none ${className}`}
      >
        <BellIcon className="size-5 text-primary shrink-0" aria-hidden="true" />
        <span className="truncate">Gelince Haber Ver</span>
      </Button>

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md p-5 sm:p-6">
          <DialogHeader className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <BellIcon className="size-5" />
              </div>
              <div className="text-left">
                <DialogTitle className="text-base font-semibold">
                  Gelince Haber Ver
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                  {productTitle} {variantTitle ? `(${variantTitle})` : ""}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {status === "success" ? (
            <div role="status" className="py-4 text-center space-y-3">
              <div className="flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 mx-auto">
                <CheckCircleIcon className="size-7" />
              </div>
              <h4 className="text-sm font-semibold text-foreground">
                Talebiniz Alındı!
              </h4>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
                {message}
              </p>
              <div className="pt-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  className="w-full text-xs"
                >
                  Tamam
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 pt-1">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Bu ürün stoklarımıza tekrar girdiğinde e-posta adresinize anında otomatik bilgilendirme göndereceğiz.
              </p>

              <div className="space-y-1.5">
                <label htmlFor="restock-email-input" className="text-xs font-medium text-foreground">
                  E-Posta Adresiniz
                </label>
                <Input
                  id="restock-email-input"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ornek@alanadi.com"
                  required
                  className="h-10 text-sm"
                />
              </div>

              <label htmlFor="restock-consent" className="flex items-start gap-2 text-[11px] leading-4 text-muted-foreground">
                <input
                  id="restock-consent"
                  type="checkbox"
                  required
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                  className="mt-0.5 size-3.5 shrink-0 accent-primary"
                />
                <span>
                  E-posta adresimin yalnızca bu ürünün stok bildirimi için{" "}
                  <Link href={routes.privacyPolicy} className="text-foreground underline underline-offset-2">
                    Gizlilik Politikası
                  </Link>{" "}
                  kapsamında işlenmesini kabul ediyorum.
                </span>
              </label>

              {status === "error" && (
                <div role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  <ExclamationCircleIcon className="size-4 shrink-0" />
                  <span>{message}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  className="text-xs"
                >
                  Vazgeç
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={loading}
                  className="text-xs font-medium"
                >
                  {loading ? "Kaydediliyor..." : "Bildirim Oluştur"}
                </Button>
              </div>

              <p className="text-[11px] text-muted-foreground text-center">
                Bildirim talebinizi dilediğiniz zaman e-postadaki bağlantıdan iptal edebilirsiniz.
              </p>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
