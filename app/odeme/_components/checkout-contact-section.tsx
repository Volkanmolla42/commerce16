"use client";

import type { Dispatch, SetStateAction } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { formatPhoneInput } from "@/lib/format-phone-input";
import type { CheckoutDraft } from "../checkout-details";

export function CheckoutContactSection({
  customerName,
  customerEmail,
  phone,
  draft,
  setDraft,
}: {
  customerName: string;
  customerEmail: string;
  phone: string;
  draft: CheckoutDraft;
  setDraft: Dispatch<SetStateAction<CheckoutDraft>>;
}) {
  return (
    <Card className="rounded-2xl border-border bg-card p-5 sm:p-6 shadow-xs space-y-4">
      <CardHeader className="p-0">
        <CardTitle role="heading" aria-level={2} className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
          1. İletişim Bilgileri
        </CardTitle>
      </CardHeader>
      <Separator />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2 space-y-2">
          <Label htmlFor="checkout-name" className="text-sm font-medium text-foreground">
            Ad Soyad
          </Label>
          <Input
            id="checkout-name"
            name="name"
            autoComplete="name"
            type="text"
            required
            value={customerName}
            onChange={(e) => setDraft({ ...draft, customerName: e.target.value })}
            placeholder="Adınız ve Soyadınız"
            className="h-11 text-base sm:text-sm rounded-xl"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="checkout-email" className="text-sm font-medium text-foreground">
            E-Posta
          </Label>
          <Input
            id="checkout-email"
            name="email"
            autoComplete="email"
            inputMode="email"
            type="email"
            required
            value={customerEmail}
            onChange={(e) => setDraft({ ...draft, customerEmail: e.target.value })}
            placeholder="ornek@mail.com"
            className="h-11 text-base sm:text-sm rounded-xl"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="checkout-phone" className="text-sm font-medium text-foreground">
            Telefon
          </Label>
          <Input
            id="checkout-phone"
            name="tel"
            autoComplete="tel"
            inputMode="tel"
            type="tel"
            required
            value={phone}
            onChange={(e) => setDraft({ ...draft, phone: formatPhoneInput(e.target.value) })}
            placeholder="05XX XXX XX XX"
            className="h-11 text-base sm:text-sm rounded-xl"
          />
        </div>
      </div>
    </Card>
  );
}
