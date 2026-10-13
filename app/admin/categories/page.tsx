"use client";

import { useState } from "react";
import Image from "next/image";
import {
  MagnifyingGlassIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  ArrowTopRightOnSquareIcon,
  PhotoIcon,
} from "@heroicons/react/24/outline";
import { Button, Card, Input, Label } from "@/components/ui";
import { AdminEmpty, AdminLoading, AdminNotice } from "../_components/admin-primitives";
import { AdminHeaderAction } from "../_components/admin-header-action";
import { runAdminAction, useAdminResource } from "../_components/admin-api";
import { adminPath } from "@/lib/admin/routes";
import { CategoryEditor, type AdminCategory } from "./_components/category-editor";

export default function AdminCategoriesPage() {
  const { data: categories, error, loading, refresh } = useAdminResource<AdminCategory[]>("categories");
  const [editorCategory, setEditorCategory] = useState<AdminCategory | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const term = query.trim().toLocaleLowerCase("tr-TR");
  const filteredCategories = (categories || []).filter((c) => {
    if (!term) return true;
    return `${c.title} ${c.slug} ${c.description || ""}`.toLocaleLowerCase("tr-TR").includes(term);
  });

  const handleDelete = async (category: AdminCategory) => {
    if (!window.confirm(`“${category.title}” kategorisini silmek istediğinize emin misiniz?`)) return;
    setActionError(null);
    setMessage(null);
    try {
      await runAdminAction("category.delete", undefined, category._id);
      setMessage(`“${category.title}” silindi.`);
      await refresh();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Kategori silinemedi.");
    }
  };

  return (
    <>
      <AdminHeaderAction route={adminPath("categories")}>
        <Button
          size="sm"
          className="h-9 gap-1.5 cursor-pointer"
          onClick={() => {
            setEditorCategory(null);
            setEditorOpen(true);
          }}
        >
          <PlusIcon className="size-4" />
          <span>Yeni Kategori Ekle</span>
        </Button>
      </AdminHeaderAction>

      {(message || actionError || error) && (
        <div className="mb-4">
          <AdminNotice kind={actionError || error ? "error" : "success"}>
            {actionError || error || message}
          </AdminNotice>
        </div>
      )}

      <Card className="overflow-hidden rounded-lg">
        {/* Filtre ve Arama Çubuğu */}
        <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-5 sm:items-center">
          <div className="relative min-w-0">
            <Label htmlFor="category-search" className="sr-only">
              Kategori ara
            </Label>
            <MagnifyingGlassIcon
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="category-search"
              name="category-search"
              type="search"
              placeholder="Kategori adı veya bağlantı ara..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 h-10 text-sm"
            />
          </div>

          <div className="text-xs text-muted-foreground font-mono text-right">
            Toplam {categories?.length ?? 0} kategori
          </div>
        </div>

        {/* Kategori Listesi */}
        {loading ? (
          <AdminLoading label="Kategoriler" variant="table" />
        ) : filteredCategories.length === 0 ? (
          <div className="p-5">
            <AdminEmpty
              title={query ? "Eşleşen kategori bulunamadı" : "Henüz kategori yok"}
              description={
                query
                  ? "Arama kriterini değiştirip tekrar deneyin."
                  : "İlk kategorinizi ekleyerek mağaza menüsünü oluşturun."
              }
            />
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredCategories.map((category) => (
              <article
                key={category._id}
                className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5 hover:bg-muted/30 transition-colors"
              >
                <div className="flex min-w-0 items-center gap-3.5">
                  {category.imageUrl ? (
                    <Image
                      src={category.imageUrl}
                      alt={category.title}
                      width={52}
                      height={52}
                      unoptimized
                      className="size-13 shrink-0 rounded-lg border border-border object-cover"
                    />
                  ) : (
                    <div className="size-13 shrink-0 rounded-lg border border-border bg-muted flex items-center justify-center text-muted-foreground">
                      <PhotoIcon className="size-5 opacity-40" />
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="truncate font-semibold text-sm text-foreground">
                        {category.title}
                      </h3>
                      <a
                        href={`/search/${category.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground p-0.5 transition-colors"
                        title="Mağazada Gör"
                      >
                        <ArrowTopRightOnSquareIcon className="size-3.5" />
                      </a>
                    </div>
                    <p className="font-mono text-xs text-muted-foreground truncate mt-0.5">
                      /search/{category.slug}
                    </p>
                    {category.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                        {category.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs cursor-pointer"
                    onClick={() => {
                      setEditorCategory(category);
                      setEditorOpen(true);
                    }}
                  >
                    <PencilSquareIcon className="size-3.5" />
                    <span>Düzenle</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                    onClick={() => void handleDelete(category)}
                    title="Sil"
                  >
                    <TrashIcon className="size-3.5" />
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </Card>

      {editorOpen && (
        <CategoryEditor
          key={editorCategory?._id || "new-category"}
          category={editorCategory}
          onClose={() => setEditorOpen(false)}
          onSaved={(nextMessage) => {
            setMessage(nextMessage);
            setActionError(null);
            void refresh();
          }}
        />
      )}
    </>
  );
}
