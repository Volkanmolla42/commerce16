"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CARRIER_OPTIONS } from "@/lib/orders";
import type { Order } from "./order-admin-shared";

export function ShippingDialog({
  order,
  onClose,
  onSubmit,
}: {
  order: Order;
  onClose: () => void;
  onSubmit: (carrier: string, trackingNumber: string) => Promise<void>;
}) {
  const [carrier, setCarrier] = useState(order.carrier ?? "");
  const [trackingNumber, setTrackingNumber] = useState(order.trackingNumber || "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit(carrier.trim(), trackingNumber.trim());
      onClose();
    } catch {
      // updateStatus surfaces its own error; the dialog stays open.
    }
    setSaving(false);
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md p-5 sm:p-6">
        <DialogHeader className="border-b border-border pb-3">
          <DialogTitle className="text-base font-bold text-foreground">
            Kargo Bilgilerini Güncelle
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="shipping-carrier" className="text-xs">
              Kargo Firması
            </Label>
            <Input
              id="shipping-carrier"
              list="carrier-options"
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              placeholder="Örn: Aras Kargo"
              required
              autoComplete="off"
              className="h-10 text-sm"
            />
            <datalist id="carrier-options">
              {CARRIER_OPTIONS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="shipping-tracking-number" className="text-xs">
              Takip Numarası
            </Label>
            <Input
              id="shipping-tracking-number"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="Örn: 123456789012"
              className="h-10 font-mono text-sm"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Vazgeç
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Kaydediliyor..." : "Kaydet ve Kargola"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
