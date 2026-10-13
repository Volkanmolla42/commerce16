"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  PaperAirplaneIcon,
} from "@heroicons/react/24/outline";
import { Button, Input, Label } from "@/components/ui";

export default function ContactForm() {
  const submitMessage = useMutation(api.contact.submitContactMessage);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) {
      setError("Lütfen gerekli tüm alanları doldurunuz.");
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
      });
      setSuccess(true);
      setName("");
      setEmail("");
      setPhone("");
      setSubject("");
      setMessage("");
      setLoading(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Mesajınız iletilirken bir hata oluştu. Lütfen tekrar deneyiniz.");
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
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
        <div className="flex items-center gap-2.5 rounded-lg border border-destructive/20 bg-destructive/10 p-3.5 text-sm text-destructive">
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
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
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
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm text-foreground shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none leading-relaxed"
        />
      </div>

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
