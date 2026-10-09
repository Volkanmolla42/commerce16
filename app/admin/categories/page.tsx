"use client";

import { useState } from "react";
import Image from "next/image";
import { Button, Card } from "@/components/ui";
import { AdminEmpty, AdminLoading, AdminNotice } from "../_components/admin-primitives";
import { runAdminAction, useAdminResource } from "../_components/admin-api";
import { CategoryEditor, type AdminCategory } from "./_components/category-editor";

function AdminCategoriesContent() {
  const { data: categories, error, loading, refresh } = useAdminResource<AdminCategory[]>("categories");
  const [editorCategory, setEditorCategory] = useState<AdminCategory | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleDelete = async (category: AdminCategory) => {
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

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Kategoriler</h1>
        <Button onClick={() => { setEditorCategory(null); setEditorOpen(true); }}>Kategori ekle</Button>
      </div>
      {(message || actionError || error) && (
        <div className="mb-4">
          <AdminNotice kind={actionError || error ? "error" : "success"}>
            {actionError || error || message}
          </AdminNotice>
        </div>
      )}

      <Card className="overflow-hidden rounded-lg">
        {loading ? (
          <div className="p-5"><AdminLoading label="Kategoriler" /></div>
        ) : !categories?.length ? (
          <div className="p-5">
            <AdminEmpty
              title="Henüz kategori yok"
              description="Yeni bir kategori ekleyerek başlayabilirsiniz."
            />
          </div>
        ) : (
          <div className="divide-y divide-border">
            {categories.map((category) => (
              <article
                key={category._id}
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
              >
                <div className="flex min-w-0 items-start gap-3">
                  {category.imageUrl ? (
                    <Image
                      src={category.imageUrl}
                      alt={`${category.title} kategori görseli`}
                      width={64}
                      height={64}
                      unoptimized
                      className="h-16 w-16 shrink-0 rounded-lg border border-border object-cover"
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      className="h-16 w-16 shrink-0 rounded-lg border border-dashed border-border bg-muted"
                    />
                  )}
                  <div className="min-w-0">
                    <h3 className="font-semibold text-foreground">{category.title}</h3>
                    <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                      /search/{category.slug}
                    </p>
                    {category.description && (
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                        {category.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2 sm:pl-5">
                  <Button
                    variant="outline"
                    className="min-h-10"
                    onClick={() => { setEditorCategory(category); setEditorOpen(true); }}
                  >
                    Düzenle
                  </Button>
                  <Button
                    variant="ghost"
                    className="min-h-10"
                    onClick={() => void handleDelete(category)}
                  >
                    Sil
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

export default function AdminCategoriesPage() {
  return <AdminCategoriesContent />;
}
