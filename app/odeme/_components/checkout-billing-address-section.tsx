"use client";

import { AddressRegionFields } from "@/components/address/address-region-fields";
import { Label } from "@/components/ui/label";
import type { SavedAddress } from "./checkout-types";

export function CheckoutBillingAddressSection({
  isAuthenticated,
  addresses,
  billingAddressSelection,
  setBillingAddressSelection,
  billingAddressLine,
  setBillingAddressLine,
  billingProvinceId,
  setBillingProvinceId,
  billingDistrictId,
  setBillingDistrictId,
}: {
  isAuthenticated: boolean;
  addresses: SavedAddress[] | undefined;
  billingAddressSelection: string | null;
  setBillingAddressSelection: (value: string) => void;
  billingAddressLine: string;
  setBillingAddressLine: (value: string) => void;
  billingProvinceId: string;
  setBillingProvinceId: (value: string) => void;
  billingDistrictId: string;
  setBillingDistrictId: (value: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-4 space-y-3.5 animate-in fade-in-50 duration-200">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Farklı Fatura Adresi
      </div>

      {/* Kayıtlı Adreslerden Seçim (Varsa) */}
      {isAuthenticated && addresses && addresses.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {addresses.map((addr) => {
            const isSelected = billingAddressSelection === addr._id;
            return (
              <label
                key={`billing-${addr._id}`}
                className={`flex flex-col p-3 rounded-lg border cursor-pointer transition text-xs select-none ${
                  isSelected
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                    : "border-border bg-card hover:border-muted-foreground/40"
                }`}
              >
                <div className="flex items-center justify-between font-semibold text-foreground">
                  <span>{addr.title}</span>
                  <input
                    type="radio"
                    name="billing-address"
                    checked={isSelected}
                    onChange={() => {
                      setBillingAddressSelection(addr._id);
                      setBillingProvinceId(addr.provinceId);
                      setBillingDistrictId(addr.districtId);
                      setBillingAddressLine(addr.addressLine1);
                    }}
                    className="size-3.5 accent-primary"
                  />
                </div>
                <span className="text-muted-foreground line-clamp-1 mt-0.5">
                  {addr.addressLine1}, {addr.district}/{addr.city}
                </span>
              </label>
            );
          })}
          <label
            className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition text-xs select-none ${
              billingAddressSelection === "custom" || !billingAddressSelection
                ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                : "border-border bg-card hover:border-muted-foreground/40"
            }`}
          >
            <span className="font-semibold text-foreground">+ Farklı Fatura Adresi Gir</span>
            <input
              type="radio"
              name="billing-address"
              checked={billingAddressSelection === "custom" || !billingAddressSelection}
              onChange={() => setBillingAddressSelection("custom")}
              className="size-3.5 accent-primary"
            />
          </label>
        </div>
      )}

      {/* Fatura Adresi Giriş Kutuları */}
      {(billingAddressSelection === "custom" || !addresses || addresses.length === 0) && (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 pt-1">
          <AddressRegionFields
            variant="checkout"
            idPrefix="checkout-billing"
            provinceId={billingProvinceId}
            districtId={billingDistrictId}
            provinceLabel="Fatura İli (Şehir)"
            districtLabel="Fatura İlçesi"
            onChange={(region) => {
              setBillingAddressSelection("custom");
              setBillingProvinceId(region.provinceId);
              setBillingDistrictId(region.districtId);
            }}
          />

          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="checkout-billing-address" className="text-sm font-medium text-foreground">
              Açık Fatura Adresi <span className="text-destructive">*</span>
            </Label>
            <textarea
              id="checkout-billing-address"
              rows={2}
              value={billingAddressLine}
              onChange={(e) => {
                setBillingAddressSelection("custom");
                setBillingAddressLine(e.target.value);
              }}
              placeholder="Faturada görünecek açık adres..."
              className="flex w-full rounded-xl border border-input bg-background p-3 text-base sm:text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring transition resize-none shadow-2xs"
            />
          </div>
        </div>
      )}
    </div>
  );
}
