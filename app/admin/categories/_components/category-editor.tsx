"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { PhotoIcon } from "@heroicons/react/24/outline";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui";
import { AdminNotice } from "../../_components/admin-primitives";
import { runAdminAction } from "../../_components/admin-api";
import { slugify } from "@/lib/admin/slug";
import { CATEGORY_ATTRIBUTE_LIMIT, normalizeAttributeLabel, parseAttributeTemplate, parseCategoryAttributes, type CategoryAttributeDefinition } from "@/lib/catalog/attributes";
import { CategoryAttributeFields } from "./category-attribute-fields";
import { CategoryAttributeLibrary, type CategoryAttributePreset } from "./category-attribute-library";

export type AdminCategory = Omit<Doc<"categories">, "seo"> & { imageUrl: string | null };
function createAttributeKey() {
  const id = globalThis.crypto?.randomUUID?.().replaceAll("-", "")
    ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `attr-${id}`;
}

async function uploadCategoryImage(file: File): Promise<Id<"_storage">> {
  const { uploadUrl } = await runAdminAction<{ uploadUrl: string }>("category.image-upload-url");
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!response.ok) throw new Error("Kategori görseli yüklenemedi.");

  const uploaded: unknown = await response.json();
  if (typeof uploaded !== "object" || uploaded === null || !("storageId" in uploaded) || typeof uploaded.storageId !== "string") {
    throw new Error("Yüklenen görselin kimliği alınamadı.");
  }
  return uploaded.storageId as Id<"_storage">;
}

export function CategoryEditor({
  category,
  onClose,
  onSaved,
}: {
  category: AdminCategory | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [title, setTitle] = useState(category?.title || "");
  const [description, setDescription] = useState(category?.description || "");
  const [attributes, setAttributes] = useState<CategoryAttributeDefinition[]>(category?.attributes ?? []);
  const [imageStorageId, setImageStorageId] = useState<Id<"_storage"> | null>(category?.imageStorageId ?? null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(category?.imageUrl ?? null);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingPresetKey, setSavingPresetKey] = useState<string | null>(null);
  const [libraryBusy, setLibraryBusy] = useState(false);
  const [presetVersion, setPresetVersion] = useState(0);
  const [presetNotice, setPresetNotice] = useState("");
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  const selectImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type)) {
      setError("JPG, PNG, WebP veya AVIF görseli seç.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Kategori görseli 8 MB sınırını aşamaz.");
      return;
    }

    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const previewUrl = URL.createObjectURL(file);
    previewUrlRef.current = previewUrl;
    setImagePreviewUrl(previewUrl);
    setPendingImage(file);
    setImageStorageId(null);
    setError(null);
  };

  const removeImage = () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setImagePreviewUrl(null);
    setPendingImage(null);
    setImageStorageId(null);
  };

  const addAttribute = () => {
    setAttributes((current) => [...current, {
      key: createAttributeKey(),
      label: "",
      type: "text",
      required: false,
    }]);
  };

  const addPreset = (preset: CategoryAttributePreset) => {
    if (attributes.length >= CATEGORY_ATTRIBUTE_LIMIT) {
      setError("Kategoriye en fazla 30 özellik eklenebilir.");
      return;
    }
    if (attributes.some((attribute) => normalizeAttributeLabel(attribute.label) === normalizeAttributeLabel(preset.label))) {
      setError("Bu özellik kategoriye zaten eklenmiş.");
      return;
    }
    setAttributes((current) => [...current, {
      key: createAttributeKey(),
      ...parseAttributeTemplate(preset),
    }]);
    setError(null);
  };

  const saveAttributePreset = async (attribute: CategoryAttributeDefinition) => {
    if (savingPresetKey !== null) return;
    setSavingPresetKey(attribute.key);
    setError(null);
    setPresetNotice("");
    try {
      const template = parseAttributeTemplate(attribute);
      await runAdminAction("category-attribute-preset.create", template);
      setPresetNotice(`${template.label} kütüphaneye kaydedildi.`);
      setPresetVersion((current) => current + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Özellik kütüphaneye kaydedilemedi.");
    } finally {
      setSavingPresetKey(null);
    }
  };

  const updateAttribute = (key: string, patch: Partial<CategoryAttributeDefinition>) => {
    setAttributes((current) => current.map((attribute) => attribute.key === key ? { ...attribute, ...patch } : attribute));
  };

  const removeAttribute = (attribute: CategoryAttributeDefinition) => {
    if (
      category?.attributes?.some((saved) => saved.key === attribute.key) &&
      !window.confirm(
        `“${attribute.label || "Bu özellik"}” kaldırılırsa ${category.title} kategorisindeki ürünlerden bu özellik ve kayıtlı değerleri de silinecek. Bu işlem kategori değişikliklerini kaydettiğinde uygulanır. Devam edilsin mi?`,
      )
    ) return;

    setAttributes((current) => current.filter((item) => item.key !== attribute.key));
  };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || savingPresetKey !== null || libraryBusy) return;
    setError(null);
    setSaving(true);
    let cleanAttributes: CategoryAttributeDefinition[];
    try {
      cleanAttributes = parseCategoryAttributes(attributes);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Özellikleri kontrol edin.");
      setSaving(false);
      return;
    }

    const autoSlug = slugify(title.trim()) || category?.slug || "";
    if (!autoSlug) {
      setError("Geçerli bir kategori adı girin.");
      setSaving(false);
      return;
    }

    const input = {
      ...(category ? { id: category._id } : {}),
      title: title.trim(),
      slug: autoSlug,
      description: description.trim(),
      attributes: cleanAttributes,
    };
    let uploadedImageId: Id<"_storage"> | null = null;
    try {
      const nextImageStorageId = pendingImage
        ? (uploadedImageId = await uploadCategoryImage(pendingImage))
        : imageStorageId;
      await runAdminAction(category ? "category.update" : "category.create", {
        ...input,
        imageStorageId: nextImageStorageId,
      });
      uploadedImageId = null;
      onSaved(category ? "Kategori güncellendi." : "Kategori eklendi.");
      onClose();
    } catch (cause) {
      if (uploadedImageId) {
        try {
          await runAdminAction("category.image-discard", { storageId: uploadedImageId });
        } catch {
          // Keep the save error visible if storage cleanup also fails.
        }
      }
      setError(cause instanceof Error ? cause.message : "Kategori kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !saving && savingPresetKey === null && !libraryBusy) onClose(); }}>
      <DialogContent className="flex max-h-[min(92dvh,56rem)] w-[calc(100vw-2rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4 pr-12 text-left sm:px-7">
          <DialogTitle>{category ? "Kategoriyi düzenle" : "Yeni kategori"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="space-y-2 lg:col-start-1 lg:row-start-1">
                <Label htmlFor="category-title">Kategori adı <span className="text-destructive">*</span></Label>
                <Input
                  id="category-title"
                  name="title"
                  required
                  maxLength={100}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Örn. Abiye, Ayakkabı, Takı"
                />
                {slugify(title) && (
                  <p className="text-[11px] font-mono text-muted-foreground">
                    /search/{slugify(title)}
                  </p>
                )}
              </div>
              <div className="space-y-2 lg:col-start-1 lg:row-start-2">
                <Label htmlFor="category-description">Açıklama</Label>
                <textarea
                  id="category-description"
                  name="description"
                  maxLength={500}
                  rows={3}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="İsteğe bağlı"
                  className="min-h-24 w-full resize-y rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
              <div className="space-y-2 lg:col-start-2 lg:row-span-2 lg:row-start-1">
                <Label htmlFor="category-image">Kategori görseli</Label>
                <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-3">
                  {imagePreviewUrl ? (
                    <Image src={imagePreviewUrl} alt="Kategori görseli önizlemesi" width={480} height={360} unoptimized className="aspect-[4/3] w-full rounded-lg border border-border object-cover" />
                  ) : (
                    <div aria-hidden="true" className="grid aspect-[4/3] w-full place-items-center rounded-lg border border-dashed border-border bg-muted text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <PhotoIcon className="size-7" />
                        <span className="text-xs">Görsel seçilmedi</span>
                      </div>
                    </div>
                  )}
                  <div className="min-w-0">
                    <input
                      id="category-image"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif"
                      disabled={saving}
                      onChange={selectImage}
                      className="sr-only"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <label htmlFor="category-image" className={`inline-flex min-h-10 cursor-pointer items-center justify-center rounded-lg border border-border px-3 text-sm font-medium transition hover:bg-muted ${saving ? "pointer-events-none opacity-60" : ""}`}>
                        {imagePreviewUrl ? "Görseli değiştir" : "Görsel seç"}
                      </label>
                      {imagePreviewUrl && <Button type="button" variant="ghost" className="min-h-10 px-3 text-sm text-muted-foreground" disabled={saving} onClick={removeImage}>Kaldır</Button>}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">JPG, PNG, WebP veya AVIF · en fazla 8 MB</p>
                  </div>
                </div>
              </div>
              <section aria-labelledby="category-attributes-heading" className="space-y-3 rounded-xl border border-border p-4 lg:col-span-2">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)_minmax(0,1fr)] md:items-center">
                  <h3 id="category-attributes-heading" className="text-sm font-semibold">Özellikler</h3>
                  <CategoryAttributeLibrary revision={presetVersion} onBusyChange={setLibraryBusy} onAdd={addPreset} attributes={attributes} disabled={saving || savingPresetKey !== null} />
                  <div className="flex justify-end">
                    <Button type="button" variant="outline" size="sm" onClick={addAttribute} disabled={saving || savingPresetKey !== null || libraryBusy || attributes.length >= CATEGORY_ATTRIBUTE_LIMIT}>Özellik ekle</Button>
                  </div>
                </div>
                {presetNotice && <p role="status" className="text-xs text-muted-foreground">{presetNotice}</p>}
                {attributes.length === 0 && <p className="text-sm text-muted-foreground">Kütüphaneden seçin veya yeni bir özellik ekleyin.</p>}
                {attributes.map((attribute, index) => (
                  <div key={attribute.key} className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">Özellik {index + 1}</span>
                      <div className="flex flex-wrap gap-1">
                        <Button type="button" variant="ghost" size="sm" disabled={saving || savingPresetKey !== null || libraryBusy || !attribute.label.trim()} onClick={() => void saveAttributePreset(attribute)}>
                          {savingPresetKey === attribute.key ? "Kaydediliyor…" : "Kütüphaneye kaydet"}
                        </Button>
                        <Button type="button" variant="ghost" size="sm" disabled={saving || savingPresetKey !== null || libraryBusy} aria-label={`Kaldır: ${attribute.label || `Özellik ${index + 1}`}`} onClick={() => removeAttribute(attribute)}>Kaldır</Button>
                      </div>
                    </div>
                    <CategoryAttributeFields value={attribute} onChange={(patch) => updateAttribute(attribute.key, patch)} disabled={saving || savingPresetKey !== null || libraryBusy} />
                  </div>
                ))}
              </section>
            </div>
            {error && <div role="alert"><AdminNotice kind="error">{error}</AdminNotice></div>}
          </div>
          <DialogFooter className="shrink-0 gap-2 border-t border-border bg-background px-5 py-4 sm:px-7">
            {libraryBusy && <p role="status" className="mr-auto self-center text-xs text-muted-foreground">Önce kütüphane işlemini kaydedin veya iptal edin.</p>}
            <Button type="button" variant="ghost" disabled={saving || savingPresetKey !== null || libraryBusy} onClick={onClose}>Vazgeç</Button>
            <Button type="submit" disabled={saving || savingPresetKey !== null || libraryBusy}>{saving ? pendingImage ? "Görsel yükleniyor…" : "Kaydediliyor…" : category ? "Değişiklikleri kaydet" : "Kategori oluştur"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
