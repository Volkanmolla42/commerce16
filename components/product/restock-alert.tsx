"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui";

export function RestockAlert({
  productId,
  productTitle,
  variantId,
  variantTitle,
}: {
  productId: Id<"products">;
  productTitle: string;
  variantId: string;
  variantTitle?: string;
}) {
  const subscribe = useMutation(api.restockNotifications.subscribe);
  const enabledChannels = useQuery(api.restockNotifications.getEnabledChannels, {});
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [contact, setContact] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const channelOptions = enabledChannels
    ? (["email", "sms"] as const).filter((option) => enabledChannels[option])
    : [];
  const selectedChannel = channelOptions.includes(channel) ? channel : channelOptions[0];

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setError(null);
    try {
      if (!selectedChannel) return;
      const result = await subscribe({ productId, variantId, channel: selectedChannel, contact, consent });
      setMessage(result.status === "already_subscribed"
        ? "Bu seçenek için bildirim kaydınız zaten var."
        : "Kaydınız alındı. Stok yenilendiğinde tek bildirim göndereceğiz.");
      setContact("");
      setConsent(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Bildirim kaydı oluşturulamadı.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-muted/30 p-4 sm:p-5" aria-labelledby="restock-alert-title">
      <h2 id="restock-alert-title" className="text-base font-semibold text-foreground">Stoğa gelince haber ver</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {variantTitle ? `${variantTitle} seçeneği` : productTitle} yeniden stoklandığında tek bildirim al.
      </p>
      {enabledChannels === undefined ? (
        <p role="status" className="mt-4 text-sm text-muted-foreground">Bildirim kanalları kontrol ediliyor…</p>
      ) : channelOptions.length === 0 ? (
        <p role="status" className="mt-4 text-sm text-muted-foreground">Şu anda e-posta veya SMS bildirimi etkin değil.</p>
      ) : (
        <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <label className="space-y-1 text-sm font-medium text-foreground">
              <span>Bildirim kanalı</span>
              <select
                name="channel"
                value={selectedChannel}
                onChange={(event) => {
                  setChannel(event.target.value as "email" | "sms");
                  setContact("");
                  setError(null);
                }}
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
              >
                {channelOptions.map((option) => (
                  <option key={option} value={option}>{option === "email" ? "E-posta" : "SMS"}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium text-foreground">
              <span>{selectedChannel === "email" ? "E-posta adresi" : "Telefon numarası"}</span>
              <input
                key={selectedChannel}
                name="contact"
                type={selectedChannel === "email" ? "email" : "tel"}
                autoComplete={selectedChannel === "email" ? "email" : "tel"}
                inputMode={selectedChannel === "email" ? "email" : "tel"}
                required
                maxLength={selectedChannel === "email" ? 254 : 32}
                value={contact}
                onChange={(event) => setContact(event.target.value)}
                placeholder={selectedChannel === "email" ? "ornek@eposta.com" : "+90 5xx xxx xx xx"}
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
              />
            </label>
          </div>
          <label className="flex items-start gap-2.5 text-sm text-muted-foreground">
            <input
              type="checkbox"
              name="consent"
              required
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 accent-primary"
            />
            <span>Bu seçenek yeniden stoklandığında seçtiğim kanaldan tek bildirim gönderilmesini kabul ediyorum.</span>
          </label>
          <Button type="submit" disabled={submitting || !consent} className="h-11 rounded-full px-5">
            {submitting ? "Kaydediliyor…" : "Stok bildirimi oluştur"}
          </Button>
          {message && <p role="status" className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{message}</p>}
          {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
        </form>
      )}
    </section>
  );
}
