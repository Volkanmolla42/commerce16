"use client";

import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { Label } from "@/components/ui/label";
import { TURKEY_PROVINCES } from "@/lib/turkey-provinces";
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
  billingDistrictOptions,
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
  billingDistrictOptions: readonly { id: string; name: string }[];
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
          <div className="space-y-1.5">
            <Label htmlFor="checkout-billing-city" className="text-sm font-medium text-foreground">
              Fatura İli (Şehir) <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <select
                id="checkout-billing-city"
                value={billingProvinceId}
                onChange={(e) => {
                  setBillingAddressSelection("custom");
                  setBillingProvinceId(e.target.value);
                  setBillingDistrictId("");
                }}
                className="h-11 w-full appearance-none rounded-xl border border-input bg-background px-3.5 pr-10 text-base sm:text-sm font-normal text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 transition shadow-2xs"
              >
                <option value="">İl seçin</option>
                {TURKEY_PROVINCES.map((province) => (
                  <option key={province.id} value={province.id}>
                    {province.name}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="pointer-events-none absolute right-3.5 top-3.5 size-4 text-muted-foreground" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="checkout-billing-district" className="text-sm font-medium text-foreground">
              Fatura İlçesi <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <select
                id="checkout-billing-district"
                disabled={!billingProvinceId}
                value={billingDistrictId}
                onChange={(e) => {
                  setBillingAddressSelection("custom");
                  setBillingDistrictId(e.target.value);
                }}
                className="h-11 w-full appearance-none rounded-xl border border-input bg-background px-3.5 pr-10 text-base sm:text-sm font-normal text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 transition shadow-2xs"
              >
                <option value="">{billingProvinceId ? "İlçe seçin" : "Önce il seçin"}</option>
                {[...billingDistrictOptions]
                  .sort((a, b) => a.name.localeCompare(b.name, "tr"))
                  .map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
              </select>
              <ChevronDownIcon className="pointer-events-none absolute right-3.5 top-3.5 size-4 text-muted-foreground" />
            </div>
          </div>

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
              className="flex w-full rounded-xl border border-input bg-background p-3 text-base sm:text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 transition resize-none shadow-2xs"
            />
          </div>
        </div>
      )}
    </div>
  );
}
