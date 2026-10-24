"use client";

import { BuildingOffice2Icon, UserIcon } from "@heroicons/react/24/outline";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SavedAddress } from "./checkout-types";
import { CheckoutBillingAddressSection } from "./checkout-billing-address-section";

export function CheckoutInvoiceSection({
  isAuthenticated,
  addresses,
  billingType,
  setBillingType,
  companyName,
  setCompanyName,
  taxOffice,
  setTaxOffice,
  taxNumber,
  setTaxNumber,
  sameAsShippingAddress,
  setSameAsShippingAddress,
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
  billingType: "individual" | "corporate";
  setBillingType: (value: "individual" | "corporate") => void;
  companyName: string;
  setCompanyName: (value: string) => void;
  taxOffice: string;
  setTaxOffice: (value: string) => void;
  taxNumber: string;
  setTaxNumber: (value: string) => void;
  sameAsShippingAddress: boolean;
  setSameAsShippingAddress: (value: boolean) => void;
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
    <div className="pt-4 space-y-4 border-t border-border/70">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
        Fatura Türü ve Bilgileri
      </span>

      {/* Fatura Türü Seçimi: Bireysel / Kurumsal */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setBillingType("individual")}
          className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left cursor-pointer ${
            billingType === "individual"
              ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary/30 shadow-xs"
              : "border-border bg-card hover:border-muted-foreground/30 text-muted-foreground"
          }`}
        >
          <div className={`p-2 rounded-lg shrink-0 ${billingType === "individual" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            <UserIcon className="size-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">Bireysel</div>
            <div className="text-xs text-muted-foreground">Kişisel fatura</div>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setBillingType("corporate")}
          className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left cursor-pointer ${
            billingType === "corporate"
              ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary/30 shadow-xs"
              : "border-border bg-card hover:border-muted-foreground/30 text-muted-foreground"
          }`}
        >
          <div className={`p-2 rounded-lg shrink-0 ${billingType === "corporate" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            <BuildingOffice2Icon className="size-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">Kurumsal</div>
            <div className="text-xs text-muted-foreground">Şirket faturası</div>
          </div>
        </button>
      </div>

      {/* Kurumsal Fatura Alanları */}
      {billingType === "corporate" && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3.5 animate-in fade-in-50 duration-200">
          <div className="space-y-1.5">
            <Label htmlFor="checkout-company-name" className="text-sm font-medium text-foreground">
              Firma Resmi Unvanı <span className="text-destructive">*</span>
            </Label>
            <Input
              id="checkout-company-name"
              type="text"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Örn: ABC Bilişim Sanayi ve Ticaret A.Ş."
              className="h-11 text-base sm:text-sm rounded-xl bg-background"
            />
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="checkout-tax-number" className="text-sm font-medium text-foreground">
                  Vergi Kimlik No / TCKN <span className="text-destructive">*</span>
                </Label>
                {taxNumber.trim().length === 10 && (
                  <span className="text-[10px] font-semibold text-primary uppercase">VKN (10 Hane)</span>
                )}
                {taxNumber.trim().length === 11 && (
                  <span className="text-[10px] font-semibold text-primary uppercase">TCKN (11 Hane)</span>
                )}
              </div>
              <Input
                id="checkout-tax-number"
                type="text"
                inputMode="numeric"
                maxLength={11}
                required
                value={taxNumber}
                onChange={(e) => setTaxNumber(e.target.value.replace(/\D/g, ""))}
                placeholder="10 haneli VKN veya 11 haneli TCKN"
                className="h-11 text-base sm:text-sm rounded-xl bg-background tabular-nums"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="checkout-tax-office" className="text-sm font-medium text-foreground">
                Vergi Dairesi <span className="text-destructive">*</span>
              </Label>
              <Input
                id="checkout-tax-office"
                type="text"
                required
                value={taxOffice}
                onChange={(e) => setTaxOffice(e.target.value)}
                placeholder="Örn: Kadıköy Vergi Dairesi"
                className="h-11 text-base sm:text-sm rounded-xl bg-background"
              />
            </div>
          </div>
        </div>
      )}

      {/* Fatura Adresi Ayrımı (Checkbox) */}
      <div className="flex items-center space-x-2.5 pt-1">
        <input
          type="checkbox"
          id="same-billing-address"
          checked={sameAsShippingAddress}
          onChange={(e) => setSameAsShippingAddress(e.target.checked)}
          className="size-4 rounded border-input accent-primary cursor-pointer"
        />
        <Label htmlFor="same-billing-address" className="text-xs sm:text-sm font-medium text-foreground cursor-pointer select-none">
          Fatura adresim teslimat adresimle aynı
        </Label>
      </div>

      {/* Farklı Fatura Adresi Alanları */}
      {!sameAsShippingAddress && (
        <CheckoutBillingAddressSection
          isAuthenticated={isAuthenticated}
          addresses={addresses}
          billingAddressSelection={billingAddressSelection}
          setBillingAddressSelection={setBillingAddressSelection}
          billingAddressLine={billingAddressLine}
          setBillingAddressLine={setBillingAddressLine}
          billingProvinceId={billingProvinceId}
          setBillingProvinceId={setBillingProvinceId}
          billingDistrictId={billingDistrictId}
          setBillingDistrictId={setBillingDistrictId}
        />
      )}
    </div>
  );
}
