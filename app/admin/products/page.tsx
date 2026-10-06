"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import type { Doc } from "@/convex/_generated/dataModel";
import {
  Button,
  Input,
  Label,
  Card,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui";
import { AdminEmpty, AdminLoading, AdminNotice } from "../_components/admin-primitives";
import { AdminGate } from "../_components/admin-gate";
import { runAdminAction, useAdminResource } from "../_components/admin-api";
import { slugify } from "@/lib/admin/slug";
import { formatMoney } from "@/lib/format-money";

type StoredImage = NonNullable<Doc<"products">["storageImages"]>[number] & {
  url: string | null;
};
type Product = Doc<"products"> & { storageImages?: StoredImage[] };
type Category = Doc<"categories">;
type SEO = { title: string; description: string };
type ProductOption = NonNullable<Product["options"]>[number];
type PendingImage = { id: string; blob: Blob; fileName: string; previewUrl: string };
type OptionDraft = { id: string; name: string; valuesText: string };
type VariantDraft = { id?: string; price: string; availableForSale: boolean };

async function convertImageToWebp(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Yalnızca görsel dosyaları yüklenebilir.");

  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new window.Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Görsel açılamadı."));
      element.src = sourceUrl;
    });
    if (image.naturalWidth * image.naturalHeight > 40_000_000) {
      throw new Error("Görsel çözünürlüğü çok yüksek.");
    }

    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Görsel dönüştürücü başlatılamadı.");
    context.drawImage(image, 0, 0);

    const webp = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => result ? resolve(result) : reject(new Error("Görsel WebP'ye çevrilemedi.")),
        "image/webp",
        0.86,
      );
    });
    if (webp.type !== "image/webp") {
      throw new Error("Bu tarayıcı WebP dönüşümünü desteklemiyor.");
    }
    return webp;
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

function productImageFileName(productTitle: string, index: number) {
  return `${slugify(productTitle) || "urun"}-${index + 1}.webp`;
}

function createEditorId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function selectionKey(selectedOptions: { name: string; value: string }[]) {
  return JSON.stringify([...selectedOptions].sort((a, b) => a.name.localeCompare(b.name)));
}

function buildCombinations(options: ProductOption[]) {
  if (!options.length) return [];
  let combinations: { name: string; value: string }[][] = [[]];
  for (const option of options) {
    const values = [...new Set(option.values)];
    if (combinations.length * values.length > 100) {
      return Array.from({ length: 101 }, () => []);
    }
    combinations = combinations.flatMap((combination) =>
      values.map((value) => [...combination, { name: option.name, value }]),
    );
  }
  return combinations;
}

function ProductEditor({
  product,
  categories,
  onClose,
  onSaved,
}: {
  product: Product | null;
  categories: Category[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [title, setTitle] = useState(product?.title || "");
  const [slug, setSlug] = useState(product?.slug || "");
  const [slugTouched, setSlugTouched] = useState(Boolean(product));
  const [price, setPrice] = useState(product?.price || "");
  const [categorySlug, setCategorySlug] = useState(product?.categorySlug || "");
  const [storageImages, setStorageImages] = useState<StoredImage[]>(product?.storageImages || []);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [processingImages, setProcessingImages] = useState(false);
  const previewUrls = useRef<string[]>([]);
  const [availableForSale, setAvailableForSale] = useState(product?.availableForSale ?? true);
  const [optionDrafts, setOptionDrafts] = useState<OptionDraft[]>(() =>
    (product?.options || []).map((option) => ({
      id: option.id,
      name: option.name,
      valuesText: option.values.join(", "),
    })),
  );
  const [variantDrafts, setVariantDrafts] = useState<Record<string, VariantDraft>>(() =>
    Object.fromEntries((product?.variants || []).map((variant) => [
      selectionKey(variant.selectedOptions),
      { id: variant.id, price: variant.price, availableForSale: variant.availableForSale },
    ])),
  );
  const [seoTitle, setSeoTitle] = useState(product?.seo?.title || "");
  const [seoDescription, setSeoDescription] = useState(product?.seo?.description || "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => () => {
    for (const url of previewUrls.current) URL.revokeObjectURL(url);
  }, []);

  const options = useMemo<ProductOption[]>(() => optionDrafts.map((option) => ({
    id: option.id,
    name: option.name.trim(),
    values: option.valuesText.split(",").map((value) => value.trim()).filter(Boolean),
  })), [optionDrafts]);
  const combinations = useMemo(() => buildCombinations(options), [options]);

  const handleImageSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files || []);
    event.currentTarget.value = "";
    if (!files.length) return;
    if (storageImages.length + pendingImages.length + files.length > 20) {
      setError("Bir üründe en fazla 20 görsel olabilir.");
      return;
    }

    setProcessingImages(true);
    setError(null);
    try {
      const nextImages: PendingImage[] = [];
      for (const [index, file] of files.entries()) {
        const blob = await convertImageToWebp(file);
        const position = storageImages.length + pendingImages.length + index;
        const fileName = productImageFileName(title || slug || "urun", position);
        const previewUrl = URL.createObjectURL(blob);
        previewUrls.current.push(previewUrl);
        nextImages.push({ id: createEditorId(), blob, fileName, previewUrl });
      }
      setPendingImages((current) => [...current, ...nextImages]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Görsel WebP'ye çevrilemedi.");
    } finally {
      setProcessingImages(false);
    }
  };

  const removePendingImage = (image: PendingImage) => {
    URL.revokeObjectURL(image.previewUrl);
    previewUrls.current = previewUrls.current.filter((url) => url !== image.previewUrl);
    setPendingImages((current) => current.filter((item) => item.id !== image.id));
  };

  const uploadPendingImage = async (image: PendingImage, fileName: string): Promise<StoredImage> => {
    const { uploadUrl } = await runAdminAction<{ uploadUrl: string }>("product.image-upload-url");
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": "image/webp" },
      body: image.blob,
    });
    if (!response.ok) throw new Error("WebP görsel Convex Storage'a yüklenemedi.");

    const uploaded: unknown = await response.json();
    if (
      typeof uploaded !== "object" || uploaded === null ||
      !("storageId" in uploaded) || typeof uploaded.storageId !== "string"
    ) {
      throw new Error("Yüklenen görselin kimliği alınamadı.");
    }

    const { url } = await runAdminAction<{ url: string }>("product.image-url", {
      storageId: uploaded.storageId,
    });
    return { storageId: uploaded.storageId as StoredImage["storageId"], fileName, url };
  };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (optionDrafts.some((option) => !option.name.trim() || !option.valuesText.split(",").some((value) => value.trim()))) {
      setError("Her varyant seçeneğine bir ad ve en az bir değer gir.");
      return;
    }
    if (options.length > 3) {
      setError("En fazla 3 varyant seçeneği ekleyebilirsin.");
      return;
    }
    if (new Set(options.map((option) => option.name.toLocaleLowerCase("tr-TR"))).size !== options.length) {
      setError("Varyant seçeneklerinin adları birbirinden farklı olmalı.");
      return;
    }
    if (options.some((option) => new Set(option.values).size !== option.values.length)) {
      setError("Aynı seçenek içinde yinelenen değerler olmamalı.");
      return;
    }
    if (combinations.length > 100) {
      setError("Bir üründe en fazla 100 varyant kombinasyonu olabilir.");
      return;
    }
    if (storageImages.length + pendingImages.length === 0) {
      setError("En az bir ürün görseli ekle.");
      return;
    }
    if (storageImages.length + pendingImages.length > 20) {
      setError("Bir üründe en fazla 20 görsel olabilir.");
      return;
    }
    setSaving(true);
    setError(null);
    const seo: SEO | undefined = seoTitle.trim() || seoDescription.trim()
      ? { title: seoTitle.trim(), description: seoDescription.trim() }
      : undefined;
    const input = {
      ...(product ? { id: product._id } : {}),
      title: title.trim(),
      slug: slug.trim(),
      price: price.trim(),
      categorySlug,
      images: [],
      availableForSale,
      options,
      variants: combinations.map((selectedOptions) => {
        const existing = variantDrafts[selectionKey(selectedOptions)];
        return {
          id: existing?.id || createEditorId(),
          title: selectedOptions.map((option) => option.value).join(" / "),
          selectedOptions,
          price: existing?.price || price.trim(),
          availableForSale: existing?.availableForSale ?? availableForSale,
        };
      }),
      seo,
    };

    try {
      const uploadedImages: StoredImage[] = [];
      for (const [index, image] of pendingImages.entries()) {
        uploadedImages.push(await uploadPendingImage(
          image,
          productImageFileName(title || slug || "urun", storageImages.length + index),
        ));
      }
      await runAdminAction(product ? "product.update" : "product.create", {
        ...input,
        storageImages: [...storageImages, ...uploadedImages].map((image) => ({
          storageId: image.storageId,
          fileName: image.fileName,
        })),
      });
      onSaved(product ? "Ürün güncellendi." : "Ürün eklendi.");
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ürün kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[92dvh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? "Ürünü düzenle" : "Yeni ürün"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="product-title">Ürün adı</Label>
              <Input id="product-title" name="title" autoComplete="off" required maxLength={140} value={title} onChange={(event) => {
                const nextTitle = event.target.value;
                setTitle(nextTitle);
                if (!slugTouched) setSlug(slugify(nextTitle));
              }} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-slug">Adres</Label>
              <Input id="product-slug" name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={slug} onChange={(event) => {
                setSlugTouched(true);
                setSlug(slugify(event.target.value));
              }} />
              <p className="text-xs text-muted-foreground">/product/{slug || "urun-adresi"}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-price">Fiyat (₺)</Label>
              <Input id="product-price" name="price" type="number" inputMode="decimal" min="0" step="0.01" required value={price} onChange={(event) => setPrice(event.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="product-category">Kategori</Label>
              <select id="product-category" name="categorySlug" value={categorySlug} onChange={(event) => setCategorySlug(event.target.value)} className="h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30">
                <option value="">Kategorisiz</option>
                {categories.map((category) => <option key={category._id} value={category.slug}>{category.title}</option>)}
              </select>
            </div>
            <section aria-labelledby="product-options-heading" className="space-y-3 sm:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 id="product-options-heading" className="text-sm font-medium text-foreground">Varyant seçenekleri</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Örneğin Renk: Siyah, Krem. Kombinasyonlar otomatik oluşturulur.</p>
                </div>
                <Button type="button" variant="outline" className="min-h-10 shrink-0" disabled={optionDrafts.length >= 3} onClick={() => setOptionDrafts((current) => [...current, { id: createEditorId(), name: "", valuesText: "" }])}>
                  Seçenek ekle
                </Button>
              </div>
              {optionDrafts.length === 0 ? (
                <p className="rounded-md border border-dashed border-input px-4 py-3 text-sm text-muted-foreground">Bu ürünün varyant seçeneği yok.</p>
              ) : optionDrafts.map((option, index) => (
                <div key={option.id} className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-[minmax(120px,.7fr)_minmax(0,1.3fr)_auto] sm:items-end">
                  <div className="space-y-2">
                    <Label htmlFor={`option-name-${option.id}`}>Seçenek adı</Label>
                    <Input id={`option-name-${option.id}`} value={option.name} maxLength={40} placeholder="Renk" onChange={(event) => setOptionDrafts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`option-values-${option.id}`}>Değerler</Label>
                    <Input id={`option-values-${option.id}`} value={option.valuesText} maxLength={500} placeholder="Siyah, Krem" onChange={(event) => setOptionDrafts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, valuesText: event.target.value } : item))} />
                  </div>
                  <Button type="button" variant="ghost" className="min-h-10" onClick={() => setOptionDrafts((current) => current.filter((item) => item.id !== option.id))}>Kaldır</Button>
                </div>
              ))}
              {combinations.length > 0 && combinations.length <= 100 && (
                <div className="overflow-hidden rounded-md border border-border">
                  <div className="flex items-center justify-between gap-3 border-b border-border bg-muted px-3 py-2.5">
                    <p className="text-xs font-semibold text-muted-foreground">{combinations.length} varyant</p>
                    <p className="text-xs text-muted-foreground">Fiyat ve satış durumu</p>
                  </div>
                  <div className="divide-y divide-border">
                    {combinations.map((selectedOptions) => {
                      const key = selectionKey(selectedOptions);
                      const draft = variantDrafts[key] || { price: price || "0", availableForSale };
                      return (
                        <div key={key} className="grid gap-3 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_140px_120px] sm:items-center">
                          <p className="text-sm font-medium text-foreground">{selectedOptions.map((selected) => `${selected.name}: ${selected.value}`).join(" · ")}</p>
                          <div className="space-y-1">
                            <Label htmlFor={`variant-price-${key}`} className="text-xs text-muted-foreground">Fiyat</Label>
                            <Input id={`variant-price-${key}`} type="number" inputMode="decimal" min="0" step="0.01" value={draft.price} onChange={(event) => setVariantDrafts((current) => ({ ...current, [key]: { ...draft, price: event.target.value } }))} />
                          </div>
                          <label className="flex min-h-10 items-center gap-2 text-sm text-muted-foreground">
                            <input type="checkbox" checked={draft.availableForSale} onChange={(event) => setVariantDrafts((current) => ({ ...current, [key]: { ...draft, availableForSale: event.target.checked } }))} className="h-4 w-4" />
                            Satışta
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {combinations.length > 100 && <AdminNotice kind="error">Varyant kombinasyon sayısı 100’ü geçemez.</AdminNotice>}
            </section>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="product-image-upload">Ürün görselleri</Label>
              <input
                id="product-image-upload"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={saving || processingImages}
                onChange={(event) => void handleImageSelection(event)}
                className="block min-h-11 w-full rounded-md border border-input bg-background text-sm text-muted-foreground file:mr-3 file:min-h-11 file:border-0 file:bg-muted file:px-4 file:font-medium"
              />
              <p className="text-xs text-muted-foreground">Yüklenen görseller WebP’ye çevrilir ve Convex Storage’a kaydedilir. En fazla 20 görsel.</p>
              {processingImages && <p role="status" className="text-sm text-muted-foreground">Görseller WebP’ye çevriliyor…</p>}
              {(storageImages.length > 0 || pendingImages.length > 0) && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {storageImages.map((image) => (
                    <div key={image.storageId} className="overflow-hidden rounded-md border border-border">
                      {image.url ? <Image src={image.url} alt={title} width={320} height={240} unoptimized className="h-28 w-full object-cover" /> : <div className="h-28 bg-muted" />}
                      <div className="flex items-center justify-between gap-2 p-2">
                        <p className="truncate text-xs text-muted-foreground">{image.fileName}</p>
                        <Button type="button" size="sm" variant="ghost" disabled={saving} className="min-h-8 shrink-0 px-2" onClick={() => setStorageImages((current) => current.filter((item) => item.storageId !== image.storageId))}>Kaldır</Button>
                      </div>
                    </div>
                  ))}
                  {pendingImages.map((image) => (
                    <div key={image.id} className="overflow-hidden rounded-md border border-border">
                      <Image src={image.previewUrl} alt={title} width={320} height={240} unoptimized className="h-28 w-full object-cover" />
                      <div className="flex items-center justify-between gap-2 p-2">
                        <p className="truncate text-xs text-muted-foreground">{productImageFileName(title || slug || "urun", storageImages.length + pendingImages.indexOf(image))}</p>
                        <Button type="button" size="sm" variant="ghost" disabled={saving} className="min-h-8 shrink-0 px-2" onClick={() => removePendingImage(image)}>Kaldır</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="product-seo-title">Arama sonucu başlığı</Label>
              <Input id="product-seo-title" name="seoTitle" maxLength={160} value={seoTitle} onChange={(event) => setSeoTitle(event.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="product-seo-description">Arama sonucu açıklaması</Label>
              <textarea id="product-seo-description" name="seoDescription" rows={3} maxLength={320} value={seoDescription} onChange={(event) => setSeoDescription(event.target.value)} className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2.5 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30" />
            </div>
          </div>

          <label className="flex min-h-11 items-center gap-3 rounded-md border border-border px-3 text-sm font-medium text-foreground">
            <input type="checkbox" name="availableForSale" checked={availableForSale} onChange={(event) => setAvailableForSale(event.target.checked)} className="h-4 w-4" />
            Satışta göster
          </label>

          {error && <AdminNotice kind="error">{error}</AdminNotice>}

          <DialogFooter className="gap-2 border-t border-border pt-4 sm:justify-between">
            <Button type="button" variant="ghost" onClick={onClose}>Vazgeç</Button>
            <Button type="submit" disabled={saving || processingImages}>{saving ? (pendingImages.length ? "Görseller yükleniyor…" : "Kaydediliyor…") : "Değişiklikleri kaydet"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AdminProductsContent() {
  const { data: products, error, loading, refresh } = useAdminResource<Product[]>("products");
  const { data: categories } = useAdminResource<Category[]>("categories");
  const [query, setQuery] = useState("");
  const [editorProduct, setEditorProduct] = useState<Product | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const filteredProducts = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("tr-TR");
    return (products || []).filter((product) =>
      !term || `${product.title} ${product.slug}`.toLocaleLowerCase("tr-TR").includes(term),
    );
  }, [products, query]);

  const openEdit = (product: Product) => {
    setEditorProduct(product);
    setEditorOpen(true);
  };

  const handleDelete = async (product: Product) => {
    if (!window.confirm(`“${product.title}” ürününü silmek istiyor musun?`)) return;
    setActionError(null);
    setMessage(null);
    try {
      await runAdminAction("product.delete", undefined, product._id);
      setMessage("Ürün silindi.");
      await refresh();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Ürün silinemedi.");
    }
  };

  const handleSaved = async (nextMessage: string) => {
    setActionError(null);
    setMessage(nextMessage);
    await refresh();
  };

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Ürünler</h1>
        <Button onClick={() => { setEditorProduct(null); setEditorOpen(true); }}>Yeni ürün ekle</Button>
      </div>
      {(message || actionError || error) && <div className="mb-4"><AdminNotice kind={actionError || error ? "error" : "success"}>{actionError || error || message}</AdminNotice></div>}

      <Card className="overflow-hidden rounded-lg">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-end sm:px-5">
          <div className="flex gap-2">
            <Input aria-label="Ürün ara" name="product-search" type="search" placeholder="Ürün veya adres ara" value={query} onChange={(event) => setQuery(event.target.value)} className="w-full min-w-0 sm:w-64" />
            <Button variant="outline" className="h-10 shrink-0" onClick={() => void refresh()}>Yenile</Button>
          </div>
        </div>

        {loading ? <div className="p-5"><AdminLoading label="Ürünler" /></div> : filteredProducts.length === 0 ? (
          <div className="p-5"><AdminEmpty title={query ? "Eşleşen ürün yok" : "Henüz ürün yok"} description={query ? "Arama sözcüğünü değiştirip yeniden dene." : "İlk ürünü ekleyerek kataloğu oluşturmaya başlayabilirsin."} /></div>
        ) : (
          <div className="divide-y divide-border">
            {filteredProducts.map((product) => {
              const category = categories?.find((item) => item.slug === product.categorySlug);
              return (
                <article key={product._id} className="flex flex-col gap-4 px-4 py-4 sm:px-5 lg:grid lg:grid-cols-[minmax(0,1fr)_145px_120px_130px_auto] lg:items-center">
                  <div className="flex min-w-0 items-center gap-3">
                    {(product.images[0] || product.storageImages?.[0]?.url) ? (
                      <Image src={product.images[0] || product.storageImages?.[0]?.url || ""} alt="" width={56} height={56} unoptimized className="h-14 w-14 shrink-0 rounded-md border border-border bg-muted object-cover" />
                    ) : (
                      <div aria-hidden="true" className="grid h-14 w-14 shrink-0 place-items-center rounded-md border border-border bg-muted text-sm font-semibold text-muted-foreground">Ü</div>
                    )}
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-foreground">{product.title}</h3>
                      <p className="mt-1 truncate font-mono text-xs text-muted-foreground">/product/{product.slug}</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground"><span className="mr-2 text-xs text-muted-foreground lg:hidden">Kategori</span>{category?.title || "Kategorisiz"}</p>
                  <p className="text-sm font-semibold tabular-nums text-foreground"><span className="mr-2 text-xs font-normal text-muted-foreground lg:hidden">Fiyat</span>{formatMoney(product.price)}</p>
                  <p className="text-xs font-semibold"><span className={`mr-2 inline-block h-2 w-2 rounded-full ${product.availableForSale ? "bg-primary" : "bg-muted-foreground"}`} />{product.availableForSale ? "Satışta" : "Pasif"}</p>
                  <div className="flex gap-2 lg:justify-end">
                    <Button size="sm" variant="outline" className="min-h-10" onClick={() => openEdit(product)}>Düzenle</Button>
                    <Button size="sm" variant="ghost" className="min-h-10" onClick={() => void handleDelete(product)}>Sil</Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Card>

      {editorOpen && (
        <ProductEditor
          key={editorProduct?._id || "new-product"}
          product={editorProduct}
          categories={categories || []}
          onClose={() => setEditorOpen(false)}
          onSaved={(nextMessage) => void handleSaved(nextMessage)}
        />
      )}
    </>
  );
}

export default function AdminProductsPage() {
  return (
    <AdminGate>
      <AdminProductsContent />
    </AdminGate>
  );
}
