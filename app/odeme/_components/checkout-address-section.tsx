"use client";

import type { Dispatch, ReactNode, SetStateAction } from "react";
import { CheckBadgeIcon } from "@heroicons/react/24/outline";
import { AddressRegionFields } from "@/components/address/address-region-fields";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { CheckoutDraft } from "../checkout-details";
import type { SavedAddress } from "./checkout-types";

export function CheckoutAddressSection({
  isAuthenticated,
  addresses,
  selectedAddressId,
  handleAddressSelect,
  draft,
  setDraft,
  addressTitle,
  setAddressTitle,
  saveAddressToBook,
  setSaveAddressToBook,
  provinceId,
  districtId,
  city,
  district,
  addressLine,
  setAddressSelection,
  children,
}: {
  isAuthenticated: boolean;
  addresses: SavedAddress[] | undefined;
  selectedAddressId: string;
  handleAddressSelect: (addressId: string) => void;
  draft: CheckoutDraft;
  setDraft: Dispatch<SetStateAction<CheckoutDraft>>;
  addressTitle: string;
  setAddressTitle: (value: string) => void;
  saveAddressToBook: boolean;
  setSaveAddressToBook: (value: boolean) => void;
  provinceId: string;
  districtId: string;
  city: string;
  district: string;
  addressLine: string;
  setAddressSelection: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <>
      {/* 2. Teslimat ve Fatura Bilgileri */}
      <Card className="rounded-2xl border-border bg-card p-5 sm:p-6 shadow-xs space-y-4">
        <CardHeader className="p-0">
          <CardTitle role="heading" aria-level={2} className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
            2. Teslimat ve Fatura Bilgileri
          </CardTitle>
        </CardHeader>
        <Separator />

        {/* Kayıtlı Adresler (Giriş Yapmış Kullanıcı İçin) */}
        {isAuthenticated && addresses && addresses.length > 0 && (
          <div className="space-y-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Kayıtlı Adresleriniz
            </span>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {addresses.map((addr) => {
                const isSelected = selectedAddressId === addr._id;
                return (
                  <label
                    key={addr._id}
                    className={`relative flex flex-col p-3.5 rounded-xl border cursor-pointer transition select-none ${isSelected
                      ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary/30"
                      : "border-border hover:border-muted-foreground/40 bg-card"
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-foreground">
                        {addr.title}
                      </span>
                      <input
                        type="radio"
                        name="address"
                        checked={isSelected}
                        onChange={() => handleAddressSelect(addr._id)}
                        className="size-4 accent-primary"
                      />
                    </div>
                    <span className="mt-1 text-xs font-medium text-foreground/90">
                      {addr.district} / {addr.city}
                    </span>
                    <span className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                      {addr.addressLine1}
                    </span>
                  </label>
                );
              })}

              <label
                className={`relative flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition select-none ${selectedAddressId === "custom"
                  ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary/30"
                  : "border-border hover:border-muted-foreground/40 bg-card"
                  }`}
              >
                <span className="font-semibold text-sm text-foreground">
                  + Farklı Bir Adres Gir
                </span>
                <input
                  type="radio"
                  name="address"
                  checked={selectedAddressId === "custom"}
                  onChange={() => handleAddressSelect("custom")}
                  className="size-4 accent-primary"
                />
              </label>
            </div>
          </div>
        )}

        {/* Adres Giriş Alanları */}
        {selectedAddressId === "custom" || !addresses || addresses.length === 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {isAuthenticated && (
              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="checkout-address-title" className="text-sm font-medium text-foreground">
                  Adres Başlığı
                </Label>
                <Input
                  id="checkout-address-title"
                  type="text"
                  value={addressTitle}
                  onChange={(e) => setAddressTitle(e.target.value)}
                  placeholder="Örn: Ev, İşyeri, Yazlık"
                  className="h-11 text-base sm:text-sm rounded-xl"
                />
              </div>
            )}

            <AddressRegionFields
              variant="checkout"
              idPrefix="checkout"
              provinceId={provinceId}
              districtId={districtId}
              provinceLabel="İl (Şehir)"
              onChange={(region) => {
                setAddressSelection("custom");
                setDraft((current) => ({
                  ...current,
                  provinceId: region.provinceId,
                  city: region.provinceName,
                  districtId: region.districtId,
                  district: region.districtName,
                }));
              }}
            />

            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="checkout-address" className="text-sm font-medium text-foreground">
                Açık Adres
              </Label>
              <textarea
                id="checkout-address"
                name="street-address"
                autoComplete="street-address"
                rows={3}
                required
                value={addressLine}
                onChange={(e) => {
                  setAddressSelection("custom");
                  setDraft({ ...draft, addressLine: e.target.value });
                }}
                placeholder="Mahalle, cadde, sokak, bina ve daire no..."
                className="flex w-full rounded-xl border border-input bg-background p-3 text-base sm:text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring transition resize-none shadow-2xs"
              />
            </div>

            {isAuthenticated && (
              <div className="sm:col-span-2 flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="save-address-checkbox"
                  checked={saveAddressToBook}
                  onChange={(e) => setSaveAddressToBook(e.target.checked)}
                  className="size-4 rounded border-input accent-primary cursor-pointer"
                />
                <Label htmlFor="save-address-checkbox" className="text-xs sm:text-sm text-muted-foreground cursor-pointer select-none">
                  Bu adresi sonraki siparişlerim için kaydet
                </Label>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm">
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary mt-0.5">
                <CheckBadgeIcon className="size-3.5" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-foreground">Teslimat Adresi:</div>
                <div className="text-muted-foreground truncate">{addressLine}, {district}/{city}</div>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleAddressSelect("custom")}
              className="h-8 text-xs font-medium self-start sm:self-auto shrink-0"
            >
              Değiştir
            </Button>
          </div>
        )}

        {children}
      </Card>
    </>
  );
}
