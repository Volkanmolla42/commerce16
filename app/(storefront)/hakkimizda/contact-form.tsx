"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { routes } from "@/lib/storefront-routes";
import { COOKIE_CONSENT_POLICY_VERSION } from "@/lib/privacy/consent";
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  PaperAirplaneIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPhoneInput } from "@/lib/format-phone-input";

export default function ContactForm() {
  const submitMessage = useMutation(api.contact.submitContactMessage);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) {
      setError("Lütfen gerekli tüm alanları doldurunuz.");
      return;
    }
    if (!consent) {
      setError("Mesajınızı göndermek için gizlilik politikasını okuyup kabul etmeniz gerekir.");
      return;
    }

    setLoading(true);
    try {
      await submitMessage({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        subject: subject.trim(),
        message: message.trim(),
        consentVersion: COOKIE_CONSENT_POLICY_VERSION,
        consentedAt: Date.now(),
      });
      setSuccess(true);
      setName("");
      setEmail("");
      setPhone("");
      setSubject("");
      setMessage("");
      setConsent(false);
      setLoading(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Mesajınız iletilirken bir hata oluştu. Lütfen tekrar deneyiniz.");
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div role="status" className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
          <CheckCircleIcon className="h-8 w-8" />
        </div>
        <h3 className="mt-4 text-xl font-bold text-foreground">Mesajınız Alındı!</h3>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
          Bizimle iletişime geçtiğiniz için teşekkür ederiz. Mesajınız iletildi, en kısa sürede e-posta adresiniz üzerinden size dönüş yapacağız.
        </p>
        <div className="mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => setSuccess(false)}
          >
            Yeni Mesaj Gönder
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div role="alert" className="flex items-center gap-2.5 rounded-lg border border-destructive/20 bg-destructive/10 p-3.5 text-sm text-destructive">
          <ExclamationCircleIcon className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="contact-name" className="text-xs font-medium text-foreground">
            Adınız Soyadınız <span className="text-destructive">*</span>
          </Label>
          <Input
            id="contact-name"
            type="text"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Örn: Ahmet Yılmaz"
            className="h-10 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="contact-email" className="text-xs font-medium text-foreground">
            E-posta Adresiniz <span className="text-destructive">*</span>
          </Label>
          <Input
            id="contact-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ornek@alanadi.com"
            className="h-10 text-sm"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="contact-phone" className="text-xs font-medium text-foreground">
            Telefon Numaranız <span className="text-xs font-normal text-muted-foreground">(Opsiyonel)</span>
          </Label>
          <Input
            id="contact-phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
            placeholder="05XX XXX XX XX"
            className="h-10 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="contact-subject" className="text-xs font-medium text-foreground">
            Konu <span className="text-destructive">*</span>
          </Label>
          <Input
            id="contact-subject"
            type="text"
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Sipariş / Ürün / Destek hk."
            className="h-10 text-sm"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contact-message" className="text-xs font-medium text-foreground">
          Mesajınız <span className="text-destructive">*</span>
        </Label>
        <textarea
          id="contact-message"
          rows={5}
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Size nasıl yardımcı olabiliriz? Lütfen detayları paylaşın..."
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm text-foreground shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none leading-relaxed"
        />
      </div>

      <label htmlFor="contact-consent" className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/20 p-3.5 text-xs leading-5 text-muted-foreground">
        <input
          id="contact-consent"
          type="checkbox"
          required
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-primary"
        />
        <span>
          Mesajımın yanıtlanabilmesi için adım, e-posta adresim ve iletişim bilgilerimin{" "}
          <Link href={routes.privacyPolicy} className="text-foreground underline underline-offset-2">
            Gizlilik Politikası
          </Link>{" "}
          kapsamında işlenmesini kabul ediyorum. Bilgilerim pazarlama amacıyla kullanılmaz.
        </span>
      </label>

      <div className="pt-1">
        <Button
          type="submit"
          disabled={loading}
          className="w-full sm:w-auto gap-2 font-medium"
        >
          <PaperAirplaneIcon className="h-4 w-4" />
          <span>{loading ? "Gönderiliyor..." : "Mesajı Gönder"}</span>
        </Button>
      </div>
    </form>
  );
}
