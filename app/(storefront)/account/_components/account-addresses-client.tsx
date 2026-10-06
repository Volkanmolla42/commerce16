"use client";

import { useQuery, useMutation } from "convex/react";
import { useConvexAuth } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";
import {
  Location01Icon,
  Add01Icon,
  Delete02Icon,
  Edit02Icon,
} from "hugeicons-react";
import { AccountLoginCard } from "./account-gate";
import { Sk } from "./skeleton";
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

export function AccountAddressesSkeleton() {
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
    city: "İstanbul",
    district: "",
    addressLine1: "",
    addressLine2: "",
    postalCode: "",
    isDefault: false,
  });

  const openNewModal = () => {
    setEditingAddressId(null);
    setForm({
      title: "Ev",
      fullName: profile?.name || "",
      phone: profile?.phone || "",
      city: "İstanbul",
      district: "",
      addressLine1: "",
      addressLine2: "",
      postalCode: "",
      isDefault: !addresses || addresses.length === 0,
    });
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const openEditModal = (addr: NonNullable<typeof addresses>[number]) => {
    setEditingAddressId(addr._id);
    setForm({
      title: addr.title,
      fullName: addr.fullName,
      phone: addr.phone,
      city: addr.city,
      district: addr.district,
      addressLine1: addr.addressLine1,
      addressLine2: addr.addressLine2 || "",
      postalCode: addr.postalCode || "",
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
      !form.district.trim() ||
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
          addressLine1: form.addressLine1.trim(),
          addressLine2: form.addressLine2.trim() || undefined,
          postalCode: form.postalCode.trim() || undefined,
          isDefault: form.isDefault,
        });
      } else {
        await addAddress({
          title: form.title.trim(),
          fullName: form.fullName.trim(),
          phone: form.phone.trim(),
          city: form.city.trim(),
          district: form.district.trim(),
          addressLine1: form.addressLine1.trim(),
          addressLine2: form.addressLine2.trim() || undefined,
          postalCode: form.postalCode.trim() || undefined,
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

  if (!authLoading && !isAuthenticated) {
    return <AccountLoginCard />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">

        <Button
          onClick={openNewModal}
          size="sm"
          className="rounded-2xl gap-2 font-semibold self-start sm:self-auto shadow-md"
        >
          <Add01Icon className="h-4 w-4" />
          <span>Yeni Adres Ekle</span>
        </Button>
      </div>

      {authLoading || addresses === undefined ? (
        <AccountAddressesSkeleton />
      ) : addresses.length === 0 ? (
        <Card className="rounded-3xl border-border bg-card p-12 text-center shadow-xs">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Location01Icon className="h-8 w-8" />
          </div>
          <h3 className="mt-4 text-lg font-bold text-foreground">
            Henüz kayıtlı bir adresiniz yok
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Sipariş verirken veya buradan yeni teslimat adresi tanımlayabilirsiniz.
          </p>
          <Button onClick={openNewModal} size="lg" className="mt-6 rounded-2xl font-semibold shadow-md">
            <Add01Icon className="mr-2 h-4 w-4" /> İlk Adresinizi Ekleyin
          </Button>
        </Card>
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
                    {addr.addressLine2 ? `, ${addr.addressLine2}` : ""}
                  </p>
                  <p className="text-muted-foreground font-medium">
                    {addr.district} / {addr.city} {addr.postalCode ? `(${addr.postalCode})` : ""}
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
                <Input
                  id="addr-city"
                  required
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder="İstanbul"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="addr-district" className="text-xs uppercase tracking-wider text-muted-foreground">
                  İlçe *
                </Label>
                <Input
                  id="addr-district"
                  required
                  value={form.district}
                  onChange={(e) => setForm({ ...form, district: e.target.value })}
                  placeholder="Kadıköy"
                />
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
                  className="flex w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all"
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
