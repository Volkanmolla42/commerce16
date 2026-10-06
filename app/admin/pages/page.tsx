"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
import { sanitizeCmsHtml } from "@/lib/content/sanitize-cms-html";

type PageDocument = Doc<"pages">;

function PageEditor({
  page,
  onClose,
  onSaved,
}: {
  page: PageDocument | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [title, setTitle] = useState(page?.title || "");
  const [slug, setSlug] = useState(page?.slug || "");
  const [slugTouched, setSlugTouched] = useState(Boolean(page));
  const [bodySummary, setBodySummary] = useState(page?.bodySummary || "");
  const [body, setBody] = useState(page?.body || "");
  const [seoTitle, setSeoTitle] = useState(page?.seo?.title || "");
  const [seoDescription, setSeoDescription] = useState(page?.seo?.description || "");
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await runAdminAction(page ? "page.update" : "page.create", {
        ...(page ? { id: page._id, previousSlug: page.slug } : {}),
        title: title.trim(),
        slug: slug.trim(),
        bodySummary: bodySummary.trim(),
        body,
        seo: { title: seoTitle.trim(), description: seoDescription.trim() },
      });
      onSaved(page ? "Sayfa güncellendi." : "Sayfa oluşturuldu.");
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sayfa kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[94dvh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{page ? "Sayfayı düzenle" : "Yeni sayfa"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="page-title">Sayfa başlığı</Label>
              <Input id="page-title" name="title" required maxLength={140} value={title} onChange={(event) => {
                const nextTitle = event.target.value;
                setTitle(nextTitle);
                if (!slugTouched) setSlug(slugify(nextTitle));
              }} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="page-slug">Adres</Label>
              <Input id="page-slug" name="slug" required maxLength={80} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={slug} onChange={(event) => {
                setSlugTouched(true);
                setSlug(slugify(event.target.value));
              }} />
              <p className="text-xs text-muted-foreground">/{slug || "sayfa-adresi"}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="page-summary">Arama sonucu açıklaması</Label>
              <Input id="page-summary" name="bodySummary" required maxLength={320} value={bodySummary} onChange={(event) => setBodySummary(event.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <div className="flex items-center justify-between gap-3">
              {preview ? <span className="text-sm font-medium text-muted-foreground">Sayfa içeriği</span> : <Label htmlFor="page-body">Sayfa içeriği</Label>}
                <Button type="button" variant="outline" size="sm" aria-pressed={preview} onClick={() => setPreview((value) => !value)}>
                  {preview ? "HTML’i düzenle" : "Önizleme"}
                </Button>
              </div>
              <p id="page-body-help" className="text-xs leading-5 text-muted-foreground">
                Başlık, paragraf, liste, kalın/italik metin ve bağlantı HTML’i kullanabilirsin. Betikler ve güvenli olmayan biçimlendirme kaydedilmez.
              </p>
              {preview ? (
                <div aria-label="Sayfa içeriği önizlemesi" className="prose min-h-64 max-w-none rounded-md border border-border bg-muted p-4 text-foreground dark:prose-invert" dangerouslySetInnerHTML={{ __html: sanitizeCmsHtml(body) }} />
              ) : (
                <textarea id="page-body" name="body" required maxLength={100_000} value={body} onChange={(event) => setBody(event.target.value)} rows={14} aria-describedby="page-body-help" className="min-h-64 w-full rounded-md border border-input bg-background px-3 py-2.5 font-mono text-sm leading-6 text-foreground outline-none focus-visible:border-ring" />
              )}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="page-seo-title">Arama sonucu başlığı</Label>
              <Input id="page-seo-title" name="seoTitle" maxLength={160} value={seoTitle} onChange={(event) => setSeoTitle(event.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="page-seo-description">Arama sonucu meta açıklaması</Label>
              <textarea id="page-seo-description" name="seoDescription" rows={3} maxLength={320} value={seoDescription} onChange={(event) => setSeoDescription(event.target.value)} className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2.5 text-base text-foreground outline-none focus-visible:border-ring" />
            </div>
          </div>

          {error && <AdminNotice kind="error">{error}</AdminNotice>}

          <DialogFooter className="gap-2 border-t border-border pt-4 sm:justify-between">
            <Button type="button" variant="ghost" onClick={onClose}>Vazgeç</Button>
            <Button type="submit" disabled={saving}>{saving ? "Kaydediliyor…" : "Değişiklikleri kaydet"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AdminPagesContent() {
  const { data: pages, error, loading, refresh } = useAdminResource<PageDocument[]>("pages");
  const [query, setQuery] = useState("");
  const [editorPage, setEditorPage] = useState<PageDocument | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const filteredPages = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("tr-TR");
    return (pages || []).filter((page) =>
      !term || `${page.title} ${page.slug}`.toLocaleLowerCase("tr-TR").includes(term),
    );
  }, [pages, query]);

  const openEdit = (page: PageDocument) => {
    setEditorPage(page);
    setEditorOpen(true);
  };

  const handleDelete = async (page: PageDocument) => {
    if (!window.confirm(`“${page.title}” sayfasını silmek istiyor musun?`)) return;
    setActionError(null);
    setMessage(null);
    try {
      await runAdminAction("page.delete", { slug: page.slug }, page._id);
      setMessage("Sayfa silindi.");
      await refresh();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Sayfa silinemedi.");
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
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Sayfalar</h1>
        <Button onClick={() => { setEditorPage(null); setEditorOpen(true); }}>Yeni sayfa</Button>
      </div>
      {(message || actionError || error) && <div className="mb-4"><AdminNotice kind={actionError || error ? "error" : "success"}>{actionError || error || message}</AdminNotice></div>}

      <Card className="overflow-hidden rounded-lg">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-end sm:px-5">
          <div className="flex gap-2">
            <Label htmlFor="page-search" className="sr-only">Sayfa ara</Label>
            <Input id="page-search" name="page-search" type="search" placeholder="Sayfa ara" value={query} onChange={(event) => setQuery(event.target.value)} className="sm:w-56" />
            <Button variant="outline" className="h-10 shrink-0" onClick={() => void refresh()}>Yenile</Button>
          </div>
        </div>

        {loading ? <div className="p-5"><AdminLoading label="Sayfalar" /></div> : filteredPages.length === 0 ? (
          <div className="p-5"><AdminEmpty title={query ? "Eşleşen sayfa yok" : "Henüz sayfa yok"} description={query ? "Arama sözcüğünü değiştirip yeniden dene." : "İlk sayfayı ekleyerek mağaza içeriklerini oluşturmaya başlayabilirsin."} /></div>
        ) : (
          <div className="divide-y divide-border">
            {filteredPages.map((page) => (
              <article key={page._id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-foreground">{page.title}</h3>
                  <p className="mt-1 truncate font-mono text-xs text-muted-foreground">/{page.slug}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button asChild size="sm" variant="outline" className="min-h-10"><Link href={`/${page.slug}`} target="_blank" rel="noreferrer">Görüntüle</Link></Button>
                  <Button size="sm" variant="outline" className="min-h-10" onClick={() => openEdit(page)}>Düzenle</Button>
                  <Button size="sm" variant="ghost" className="min-h-10" onClick={() => void handleDelete(page)}>Sil</Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </Card>

      {editorOpen && <PageEditor page={editorPage} onClose={() => setEditorOpen(false)} onSaved={(nextMessage) => void handleSaved(nextMessage)} />}
    </>
  );
}

export default function AdminPagesPage() {
  return (
    <AdminGate>
      <AdminPagesContent />
    </AdminGate>
  );
}
