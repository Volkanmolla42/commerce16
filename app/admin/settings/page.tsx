"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AdminEmpty,
  AdminLoading,
  AdminNotice,
  AdminPageHeading,
} from "../_components/admin-primitives";
import { runAdminAction, useAdminResource } from "../_components/admin-api";
import type { StoreSettings } from "@/lib/catalog";

export default function AdminSettingsPage() {
  const { data, error, loading, refresh } =
    useAdminResource<StoreSettings>("settings");
  const [editedStoreName, setEditedStoreName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const storeName = editedStoreName ?? data?.storeName ?? "";

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setActionError(null);

    try {
      const result = await runAdminAction<StoreSettings>("settings.update", {
        storeName: storeName.trim(),
      });
      setEditedStoreName(result.storeName);
      setMessage("Mağaza adı kaydedildi.");
      await refresh();
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : "Mağaza adı kaydedilemedi.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <AdminLoading label="Mağaza ayarları" />;
  if (!data) {
    return (
      <AdminEmpty
        title="Mağaza ayarları yüklenemedi"
        description={error || "Bağlantıyı kontrol edip yeniden deneyebilirsin."}
      />
    );
  }

  return (
    <>
      <AdminPageHeading
        title="Mağaza ayarları"
        description="Mağaza adını belirle; vitrin başlıklarında ve telif alanında bu ad kullanılır."
      />

      {(message || actionError || error) && (
        <div className="mb-5">
          <AdminNotice kind={actionError || error ? "error" : "success"}>
            {actionError || error || message}
          </AdminNotice>
        </div>
      )}

      <Card className="max-w-3xl rounded-lg border-neutral-200 bg-white shadow-none">
        <CardContent className="p-5 sm:p-7">
          <form onSubmit={save} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="store-name">Mağaza adı</Label>
              <Input
                id="store-name"
                name="storeName"
                autoComplete="organization"
                required
                minLength={2}
                maxLength={80}
                className="rounded-md border-neutral-300 bg-white text-neutral-950 placeholder:text-neutral-400 focus-visible:border-neutral-800 focus-visible:ring-neutral-950/10"
                value={storeName}
                onChange={(event) => setEditedStoreName(event.target.value)}
              />
              <p className="text-sm leading-6 text-neutral-500">
                Bu ad vitrin menüsünde, sayfa başlıklarında ve telif satırında
                görünür.
              </p>
            </div>

            <div className="flex justify-end border-t border-neutral-100 pt-4">
              <Button
                type="submit"
                disabled={saving || storeName.trim().length < 2}
                className="h-11 rounded-md bg-black px-5 text-white hover:bg-neutral-800"
              >
                {saving ? "Kaydediliyor…" : "Değişiklikleri kaydet"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
