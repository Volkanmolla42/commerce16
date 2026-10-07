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
import { type CategoryAttributeDefinition, type CategoryAttributeType } from "@/lib/catalog/attributes";
import { CategoryAttributeOptionsInput } from "./category-attribute-options-input";

export type AdminCategory = Omit<Doc<"categories">, "seo"> & { imageUrl: string | null };

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
    const key = `ozellik-${globalThis.crypto?.randomUUID?.().slice(0, 8) ?? Date.now().toString(36)}`;
    setAttributes((current) => [...current, {
      key,
      label: "",
      type: "text",
      required: false,
    }]);
  };

  const updateAttribute = (index: number, patch: Partial<CategoryAttributeDefinition>) => {
    setAttributes((current) => current.map((attribute, attributeIndex) =>
      attributeIndex === index ? { ...attribute, ...patch } : attribute,
    ));
  };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    for (const attr of attributes) {
      if (attr.type === "select" || attr.type === "multiselect") {
        const cleanOpts = (attr.options ?? []).map((o) => o.trim()).filter(Boolean);
        if (cleanOpts.length === 0) {
          setError(`"${attr.label || "İsimsiz"}" özelliği için en az bir seçenek girmelisiniz.`);
          setSaving(false);
          return;
        }
      }
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
      attributes: attributes.map((attribute) => {
        const isChoice = attribute.type === "select" || attribute.type === "multiselect";
        const cleanOptions = isChoice
          ? (attribute.options ?? []).map((o) => o.trim()).filter(Boolean)
          : undefined;
        return {
          ...attribute,
          label: attribute.label.trim(),
          options: cleanOptions && cleanOptions.length > 0 ? cleanOptions : undefined,
          ...(attribute.type === "number" ? { unit: attribute.unit?.trim() || undefined } : { unit: undefined }),
        };
      }),
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
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="flex max-h-[min(92dvh,56rem)] w-[calc(100vw-2rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0">
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
                <div className="flex items-center justify-between gap-3">
                  <h3 id="category-attributes-heading" className="text-sm font-semibold">Özellikler</h3>
                  <Button type="button" variant="outline" size="sm" onClick={addAttribute} disabled={attributes.length >= 30}>Özellik ekle</Button>
                </div>
                {attributes.map((attribute, index) => (
                  <fieldset key={attribute.key} className="grid gap-3 rounded-lg border border-border bg-muted/20 p-3 sm:grid-cols-[minmax(0,1fr)_12rem_auto]">
                    <legend className="sr-only">Özellik {index + 1}</legend>
                    <div className="space-y-1.5">
                      <Label htmlFor={`category-attribute-label-${index}`}>Özellik adı</Label>
                      <Input id={`category-attribute-label-${index}`} value={attribute.label} required maxLength={80} onChange={(event) => updateAttribute(index, { label: event.target.value })} placeholder="Özellik adı" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`category-attribute-type-${index}`}>Tür</Label>
                      <select id={`category-attribute-type-${index}`} value={attribute.type} onChange={(event) => {
                        const type = event.target.value as CategoryAttributeType;
                        updateAttribute(index, {
                          type,
                          options: type === "select" || type === "multiselect" ? attribute.options ?? [] : undefined,
                          unit: type === "number" ? attribute.unit : undefined,
                        });
                      }} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                        <option value="text">Metin</option>
                        <option value="number">Sayı</option>
                        <option value="select">Tekli seçim</option>
                        <option value="multiselect">Çoklu seçim</option>
                        <option value="boolean">Evet / Hayır</option>
                      </select>
                    </div>
                    <Button type="button" variant="ghost" className="self-end text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={`Kaldır: ${attribute.label || `Özellik ${index + 1}`}`} onClick={() => {
                      setAttributes((current) => current.filter((_, attributeIndex) => attributeIndex !== index));
                    }}>Kaldır</Button>
                    {(attribute.type === "select" || attribute.type === "multiselect") && (
                      <div className="sm:col-span-3">
                        <CategoryAttributeOptionsInput
                          options={attribute.options ?? []}
                          onChange={(next) => updateAttribute(index, { options: next })}
                          disabled={saving}
                        />
                      </div>
                    )}
                    {attribute.type === "number" && (
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor={`category-attribute-unit-${index}`}>Birim</Label>
                        <Input id={`category-attribute-unit-${index}`} value={attribute.unit ?? ""} maxLength={20} onChange={(event) => updateAttribute(index, { unit: event.target.value })} placeholder="Birim" />
                      </div>
                    )}
                    <div className="flex flex-wrap gap-x-5 gap-y-2 sm:col-span-3">
                      <label className="flex min-h-9 cursor-pointer select-none items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={attribute.required} onChange={(event) => updateAttribute(index, { required: event.target.checked })} className="size-4 accent-foreground rounded focus-visible:ring-2 focus-visible:ring-ring" />Zorunlu</label>
                    </div>
                  </fieldset>
                ))}
              </section>
            </div>
            {error && <div role="alert"><AdminNotice kind="error">{error}</AdminNotice></div>}
          </div>
          <DialogFooter className="shrink-0 gap-2 border-t border-border bg-background px-5 py-4 sm:px-7">
            <Button type="button" variant="ghost" onClick={onClose}>Vazgeç</Button>
            <Button type="submit" disabled={saving}>{saving ? pendingImage ? "Görsel yükleniyor…" : "Kaydediliyor…" : category ? "Değişiklikleri kaydet" : "Kategori oluştur"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
