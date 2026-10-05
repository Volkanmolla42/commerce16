"use client";

import { useState } from "react";
import type { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AdminEmpty, AdminLoading, AdminNotice, AdminPageHeading } from "../_components/admin-primitives";
import { runAdminAction, useAdminResource } from "../_components/admin-api";
import { slugify } from "@/lib/admin/slug";

type Category = Doc<"categories">;

function CategoryEditor({
  category,
  onClose,
  onSaved,
}: {
  category: Category | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const initialSlug = category?.slug || "";
  const [title, setTitle] = useState(category?.title || "");
  const [slug, setSlug] = useState(initialSlug);
  const [slugTouched, setSlugTouched] = useState(Boolean(category));
  const [description, setDescription] = useState(category?.description || "");
  const [path, setPath] = useState(category?.path || (initialSlug ? `/search/${initialSlug}` : ""));
  const [pathTouched, setPathTouched] = useState(Boolean(category));
  const [seoTitle, setSeoTitle] = useState(category?.seo.title || "");
  const [seoDescription, setSeoDescription] = useState(category?.seo.description || "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    const input = {
      ...(category ? { id: category._id } : {}),
      title: title.trim(),
      slug: slug.trim(),
      description: description.trim(),
      path: path.trim(),
      seo: { title: seoTitle.trim(), description: seoDescription.trim() },
    };
    try {
      await runAdminAction(category ? "category.update" : "category.create", input);
      onSaved(category ? "Kategori güncellendi." : "Kategori eklendi.");
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Kategori kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[92dvh] max-w-2xl overflow-y-auto rounded-lg border-neutral-200 bg-white text-neutral-950">
        <DialogHeader><DialogTitle>{category ? "Kategoriyi düzenle" : "Yeni kategori"}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-5 [&_input]:rounded-md [&_input]:bg-white [&_input]:text-neutral-950">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="category-title">Kategori adı</Label>
              <Input id="category-title" name="title" required maxLength={100} value={title} onChange={(event) => {
                const nextTitle = event.target.value;
                setTitle(nextTitle);
                if (!slugTouched) {
                  const nextSlug = slugify(nextTitle);
                  setSlug(nextSlug);
                  if (!pathTouched) setPath(`/search/${nextSlug}`);
                }
              }} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category-slug">Adres adı</Label>
              <Input id="category-slug" name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={slug} onChange={(event) => {
                setSlugTouched(true);
                const nextSlug = slugify(event.target.value);
                setSlug(nextSlug);
                if (!pathTouched) setPath(`/search/${nextSlug}`);
              }} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category-path">Mağaza yolu</Label>
              <Input id="category-path" name="path" required pattern="/search/[a-z0-9]+(?:-[a-z0-9]+)*" value={path} onChange={(event) => {
                setPathTouched(true);
                setPath(event.target.value);
              }} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="category-description">Açıklama</Label>
              <textarea id="category-description" name="description" required maxLength={500} rows={4} value={description} onChange={(event) => setDescription(event.target.value)} className="min-h-28 w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-base text-neutral-900 outline-none focus-visible:border-neutral-800 focus-visible:ring-2 focus-visible:ring-neutral-950/10" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="category-seo-title">Arama sonucu başlığı</Label>
              <Input id="category-seo-title" name="seoTitle" maxLength={160} required value={seoTitle} onChange={(event) => setSeoTitle(event.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="category-seo-description">Arama sonucu açıklaması</Label>
              <textarea id="category-seo-description" name="seoDescription" maxLength={320} rows={3} required value={seoDescription} onChange={(event) => setSeoDescription(event.target.value)} className="min-h-24 w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-base text-neutral-900 outline-none focus-visible:border-neutral-800 focus-visible:ring-2 focus-visible:ring-neutral-950/10" />
            </div>
          </div>
          {error && <AdminNotice kind="error">{error}</AdminNotice>}
          <DialogFooter className="gap-2 border-t border-neutral-100 pt-4 sm:justify-between">
            <Button type="button" variant="ghost" className="rounded-md" onClick={onClose}>Vazgeç</Button>
            <Button type="submit" disabled={saving} className="rounded-md bg-black text-white hover:bg-neutral-800">{saving ? "Kaydediliyor…" : "Değişiklikleri kaydet"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminCategoriesPage() {
  const { data: categories, error, loading, refresh } = useAdminResource<Category[]>("categories");
  const [editorCategory, setEditorCategory] = useState<Category | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleDelete = async (category: Category) => {
    if (!window.confirm(`“${category.title}” kategorisini silmek istiyor musun?`)) return;
    setActionError(null);
    setMessage(null);
    try {
      await runAdminAction("category.delete", undefined, category._id);
      setMessage("Kategori silindi.");
      await refresh();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Kategori silinemedi.");
    }
  };

  const openCreate = () => {
    setEditorCategory(null);
    setEditorOpen(true);
  };

  return (
    <>
      <AdminPageHeading title="Kategoriler" description="Mağaza menüsünde görünen kategorileri ve arama sonucu bilgilerini düzenle." action={<Button onClick={openCreate} className="h-11 rounded-md bg-black px-4 text-white hover:bg-neutral-800">Kategori ekle</Button>} />
      {(message || actionError || error) && <div className="mb-4"><AdminNotice kind={actionError || error ? "error" : "success"}>{actionError || error || message}</AdminNotice></div>}

      <Card className="overflow-hidden rounded-lg border-neutral-200 bg-white shadow-none">
        <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-4 sm:px-5">
          <div><h2 className="font-semibold text-neutral-950">Mağaza kategorileri</h2><p className="mt-1 text-xs text-neutral-500">{categories?.length ?? 0} kayıt</p></div>
          <Button variant="outline" className="rounded-md border-neutral-200 bg-white text-neutral-700 shadow-none hover:bg-neutral-50" onClick={() => void refresh()}>Yenile</Button>
        </div>
        {loading ? <div className="p-5"><AdminLoading label="Kategoriler" /></div> : !categories?.length ? (
          <div className="p-5"><AdminEmpty title="Henüz kategori yok" description="Kategoriler ürün kataloğunu düzenler ve mağaza menüsünde görünür." /></div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {categories.map((category) => (
              <article key={category._id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="min-w-0">
                  <h3 className="font-semibold text-neutral-950">{category.title}</h3>
                  <p className="mt-1 truncate font-mono text-xs text-neutral-500">{category.path} · {category.slug}</p>
                  <p className="mt-2 line-clamp-2 text-sm text-neutral-600">{category.description}</p>
                </div>
                <div className="flex shrink-0 gap-2 sm:pl-5">
                  <Button variant="outline" className="min-h-10 rounded-md border-neutral-200 bg-white text-neutral-700 shadow-none hover:bg-neutral-50" onClick={() => { setEditorCategory(category); setEditorOpen(true); }}>Düzenle</Button>
                  <Button variant="ghost" className="min-h-10 rounded-lg text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950" onClick={() => void handleDelete(category)}>Sil</Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </Card>

      {editorOpen && <CategoryEditor key={editorCategory?._id || "new-category"} category={editorCategory} onClose={() => setEditorOpen(false)} onSaved={(nextMessage) => { setMessage(nextMessage); setActionError(null); void refresh(); }} />}
    </>
  );
}
