"use client";

import { useQuery, useMutation } from "convex/react";
import { useConvexAuth } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";
import { Add01Icon, Delete02Icon, Edit02Icon } from "hugeicons-react";
import { AccountLoginCard } from "./account-gate";
import { Sk } from "./skeleton";
import {
  getDistrictById,
  getDistrictByName,
  getProvinceById,
  getProvinceByName,
  TURKEY_PROVINCES,
} from "@/lib/turkey-provinces";
import {
  Button,
  Card,
  Badge,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui";

const DEFAULT_PROVINCE = getProvinceByName("İstanbul")!;

function AccountAddressesSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2" aria-hidden>
      {[0, 1].map((i) => (
        <div
          key={i}
          className="flex flex-col justify-between rounded-3xl border border-border bg-card p-6"
        >
          <div>
            <div className="flex items-center gap-2">
              <Sk className="h-4 w-16" />
              <Sk className="h-5 w-20 rounded-full" />
            </div>
            <div className="mt-3 space-y-1.5">
              <Sk className="h-3.5 w-32" />
              <Sk className="h-3 w-28" />
              <Sk className="h-3 w-full" />
              <Sk className="h-3 w-2/3" />
            </div>
          </div>
          <div className="mt-6 flex items-center justify-between border-t border-border/60 pt-4">
            <div className="flex gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled
                className="h-8 rounded-xl border-border px-3 text-xs font-medium gap-1.5"
              >
                <Edit02Icon className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Düzenle</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled
                className="h-8 rounded-xl border-border px-3 text-xs font-medium text-destructive gap-1.5"
              >
                <Delete02Icon className="h-3.5 w-3.5" />
                <span>Sil</span>
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled
              className="h-8 text-xs text-primary font-medium"
            >
              Varsayılan Yap
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AccountAddressesPage() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const profile = useQuery(api.users.getMyProfile);
  const addresses = useQuery(api.addresses.getMyAddresses);

  const addAddress = useMutation(api.addresses.addAddress);
  const updateAddress = useMutation(api.addresses.updateAddress);
  const deleteAddress = useMutation(api.addresses.deleteAddress);
  const setDefaultAddress = useMutation(api.addresses.setDefaultAddress);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<Id<"addresses"> | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "Ev",
    fullName: "",
    phone: "",
    city: DEFAULT_PROVINCE.name,
    provinceId: DEFAULT_PROVINCE.id,
    district: "",
    districtId: "",
    addressLine1: "",
    isDefault: false,
  });

  const openNewModal = () => {
    setEditingAddressId(null);
    setForm({
      title: "Ev",
      fullName: profile?.name || "",
      phone: profile?.phone || "",
      city: DEFAULT_PROVINCE.name,
      provinceId: DEFAULT_PROVINCE.id,
      district: "",
      districtId: "",
      addressLine1: "",
      isDefault: !addresses || addresses.length === 0,
    });
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const openEditModal = (addr: NonNullable<typeof addresses>[number]) => {
    setEditingAddressId(addr._id);
    const province = getProvinceById(addr.provinceId) ?? getProvinceByName(addr.city);
    const district = getDistrictById(province?.id, addr.districtId) ?? getDistrictByName(province?.id, addr.district);
    setForm({
      title: addr.title,
      fullName: addr.fullName,
      phone: addr.phone,
      city: province?.name ?? addr.city,
      provinceId: province?.id ?? "",
      district: district?.name ?? addr.district,
      districtId: district?.id ?? "",
      addressLine1: addr.addressLine1,
      isDefault: addr.isDefault,
    });
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (
      !form.title.trim() ||
      !form.fullName.trim() ||
      !form.phone.trim() ||
      !form.city.trim() ||
      !form.provinceId ||
      !form.district.trim() ||
      !form.districtId ||
      !form.addressLine1.trim()
    ) {
      setErrorMessage("Lütfen zorunlu alanları doldurun.");
      return;
    }

    setIsSaving(true);
    try {
      if (editingAddressId) {
        await updateAddress({
          addressId: editingAddressId,
          title: form.title.trim(),
          fullName: form.fullName.trim(),
          phone: form.phone.trim(),
          city: form.city.trim(),
          district: form.district.trim(),
          provinceId: form.provinceId,
          districtId: form.districtId,
          addressLine1: form.addressLine1.trim(),
          isDefault: form.isDefault,
        });
      } else {
        await addAddress({
          title: form.title.trim(),
          fullName: form.fullName.trim(),
          phone: form.phone.trim(),
          city: form.city.trim(),
          district: form.district.trim(),
          provinceId: form.provinceId,
          districtId: form.districtId,
          addressLine1: form.addressLine1.trim(),
          isDefault: form.isDefault,
        });
      }
      setIsModalOpen(false);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Adres kaydedilemedi.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: Id<"addresses">) => {
    if (!window.confirm("Bu adresi silmek istediğinize emin misiniz?")) return;
    try {
      await deleteAddress({ addressId: id });
    } catch {
      alert("Adres silinirken bir hata oluştu.");
    }
  };

  const handleSetDefault = async (id: Id<"addresses">) => {
    try {
      await setDefaultAddress({ addressId: id });
    } catch {
      alert("Varsayılan adres güncellenirken bir hata oluştu.");
    }
  };

  const districtOptions = getProvinceById(form.provinceId)?.districts ?? [];

  if (!authLoading && !isAuthenticated) {
    return <AccountLoginCard />;
  }

  return (
    <div>
      {authLoading || addresses === undefined ? (
        <AccountAddressesSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {addresses.map((addr) => (
            <Card
              key={addr._id}
              className="relative flex flex-col justify-between rounded-3xl border border-border bg-card p-6 shadow-xs transition hover:border-muted-foreground/40"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-foreground">
                      {addr.title}
                    </span>
                    {addr.isDefault && (
                      <Badge variant="secondary" className="text-xs font-medium">
                        Varsayılan
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="mt-3 space-y-1 text-xs">
                  <p className="font-semibold text-foreground">{addr.fullName}</p>
                  <p className="text-muted-foreground">{addr.phone}</p>
                  <p className="text-foreground leading-relaxed pt-1">
                    {addr.addressLine1}
                  </p>
                  <p className="text-muted-foreground font-medium">
                    {addr.district} / {addr.city}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-4">
                <div className="flex gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditModal(addr)}
                    className="h-8 rounded-xl border-border px-3 text-xs font-medium gap-1.5"
                  >
                    <Edit02Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Düzenle</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(addr._id)}
                    className="h-8 rounded-xl border-border px-3 text-xs font-medium text-destructive hover:bg-destructive/10 hover:text-destructive gap-1.5"
                  >
                    <Delete02Icon className="h-3.5 w-3.5" />
                    <span>Sil</span>
                  </Button>
                </div>

                {!addr.isDefault && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSetDefault(addr._id)}
                    className="h-8 text-xs text-primary hover:text-primary font-medium"
                  >
                    Varsayılan Yap
                  </Button>
                )}
              </div>
            </Card>
          ))}

          <button
            type="button"
            onClick={openNewModal}
            aria-haspopup="dialog"
            className="group flex min-h-[15rem] w-full flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-border bg-card p-6 text-center transition-colors hover:border-primary/50 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
              <Add01Icon className="h-6 w-6" />
            </span>
            <span className="text-sm font-semibold text-foreground">Adres Ekle</span>
          </button>
        </div>
      )}

      {/* Adres Ekleme / Düzenleme Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-lg rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {editingAddressId ? "Adresi Düzenle" : "Yeni Teslimat Adresi"}
            </DialogTitle>
          </DialogHeader>

          {errorMessage && (
            <div className="rounded-xl bg-destructive/10 p-3 text-xs text-destructive">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="addr-title" className="text-xs uppercase tracking-wider text-muted-foreground">
                  Adres Başlığı *
                </Label>
                <Input
                  id="addr-title"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Örn: Ev, İşyeri, Yazlık"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="addr-name" className="text-xs uppercase tracking-wider text-muted-foreground">
                  Alıcı Ad Soyad *
                </Label>
                <Input
                  id="addr-name"
                  required
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  placeholder="Ad Soyad"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="addr-phone" className="text-xs uppercase tracking-wider text-muted-foreground">
                  Telefon Numarası *
                </Label>
                <Input
                  id="addr-phone"
                  required
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="05XX XXX XX XX"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="addr-city" className="text-xs uppercase tracking-wider text-muted-foreground">
                  İl *
                </Label>
                <select
                  id="addr-city"
                  required
                  value={form.provinceId}
                  onChange={(e) => {
                    const province = getProvinceById(e.target.value);
                    setForm({
                      ...form,
                      provinceId: e.target.value,
                      city: province?.name ?? "",
                      districtId: "",
                      district: "",
                    });
                  }}
                  className="h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                >
                  <option value="" disabled>İl seçin</option>
                  {TURKEY_PROVINCES.map((province) => (
                    <option key={province.id} value={province.id}>{province.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="addr-district" className="text-xs uppercase tracking-wider text-muted-foreground">
                  İlçe *
                </Label>
                <select
                  id="addr-district"
                  required
                  value={form.districtId}
                  disabled={!form.provinceId}
                  onChange={(e) => {
                    const district = getDistrictById(form.provinceId, e.target.value);
                    setForm({
                      ...form,
                      districtId: e.target.value,
                      district: district?.name ?? "",
                    });
                  }}
                  className="h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="" disabled>İlçe seçin</option>
                  {[...districtOptions].sort((a, b) => a.name.localeCompare(b.name, "tr-TR")).map((district) => (
                    <option key={district.id} value={district.id}>{district.name}</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="addr-line1" className="text-xs uppercase tracking-wider text-muted-foreground">
                  Açık Adres (Cadde, Sokak, No, Daire) *
                </Label>
                <textarea
                  id="addr-line1"
                  rows={2}
                  required
                  value={form.addressLine1}
                  onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
                  placeholder="Caferağa Mah. Moda Cad. No: 10 Daire: 4"
                  className="flex w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-[border-color,background-color,box-shadow] duration-150"
                />
              </div>

              <div className="sm:col-span-2 flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="addr-default"
                  checked={form.isDefault}
                  onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-primary accent-primary cursor-pointer"
                />
                <Label htmlFor="addr-default" className="text-xs text-muted-foreground cursor-pointer select-none">
                  Bu adresi varsayılan teslimat adresi olarak ayarla
                </Label>
              </div>
            </div>

            <DialogFooter className="gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl"
              >
                Vazgeç
              </Button>
              <Button type="submit" disabled={isSaving} className="rounded-xl font-semibold shadow-md">
                {isSaving ? "Kaydediliyor..." : "Kaydet"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
