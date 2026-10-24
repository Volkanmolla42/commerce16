"use client";

import { routes } from "@/lib/storefront-routes";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowTopRightOnSquareIcon,
  CheckIcon,
  PencilSquareIcon,
  PhotoIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AdminActionNotice, AdminEmpty, AdminLoading } from "../_components/admin-primitives";
import { runAdminAction, useAdminResource } from "../_components/admin-api";
import { formatDateTime } from "@/lib/format-date";

type QuestionStatus = "pending" | "approved" | "rejected";
type QuestionFilter = QuestionStatus | "all";

type AdminQuestion = {
  _id: string;
  productId: string;
  productTitle: string | null;
  productSlug: string | null;
  productImage: string | null;
  user: { name: string; email: string | null } | null;
  question: string;
  answer?: string;
  answeredAt?: number;
  status: QuestionStatus;
  _creationTime: number;
};

const statusMeta: Record<QuestionStatus, { label: string; className: string }> = {
  pending: { label: "Bekliyor", className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20" },
  approved: { label: "Yayında", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" },
  rejected: { label: "Reddedildi", className: "bg-muted text-muted-foreground border-border" },
};

const tabs: { id: QuestionFilter; label: string }[] = [
  { id: "pending", label: "Bekleyen" },
  { id: "approved", label: "Yayında" },
  { id: "rejected", label: "Reddedilen" },
  { id: "all", label: "Tümü" },
];

const emptyCopy: Record<QuestionFilter, { title: string; description: string }> = {
  pending: { title: "Bekleyen soru yok", description: "Müşterilerden gelen yeni sorular moderasyon için burada listelenir." },
  approved: { title: "Yayında soru yok", description: "Yanıtlanıp yayınlanan sorular ürün sayfasında görünür." },
  rejected: { title: "Reddedilen soru yok", description: "Reddettiğiniz sorular bu sekmede saklanır." },
  all: { title: "Henüz soru yok", description: "Ürün sayfalarındaki soru formundan gelen sorular burada toplanır." },
};

function QuestionCard({
  item,
  onChanged,
}: {
  item: AdminQuestion;
  onChanged: () => void;
}) {
  const [draft, setDraft] = useState(item.answer ?? "");
  const [editing, setEditing] = useState(item.status !== "approved");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveAnswer = async () => {
    setBusy(true);
    setError(null);
    try {
      await runAdminAction("product-question.answer", { answer: draft }, item._id);
      setEditing(false);
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Yanıt kaydedilemedi.");
    }
    setBusy(false);
  };

  const changeStatus = async (status: QuestionStatus) => {
    setBusy(true);
    setError(null);
    try {
      await runAdminAction("product-question.status", { status }, item._id);
      setEditing(status !== "approved");
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Soru durumu güncellenemedi.");
    }
    setBusy(false);
  };

  const removeQuestion = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await runAdminAction("product-question.delete", undefined, item._id);
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Soru silinemedi.");
    }
    setBusy(false);
  };

  const status = statusMeta[item.status];

  return (
    <article className="space-y-3 px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-3">
          <div className="relative size-12 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
            {item.productImage ? (
              <Image src={item.productImage} alt="" fill className="object-cover" sizes="48px" />
            ) : (
              <span className="grid size-full place-items-center text-muted-foreground">
                <PhotoIcon className="size-5" aria-hidden="true" />
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                {item.productTitle ?? "Ürün silinmiş"}
              </h3>
              <Badge variant="outline" className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${status.className}`}>
                {status.label}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {item.user?.name ?? "Silinmiş kullanıcı"}
              {item.user?.email ? (
                <>
                  {" · "}
                  <a href={`mailto:${item.user.email}`} className="hover:text-foreground hover:underline">
                    {item.user.email}
                  </a>
                </>
              ) : null}
              {" · "}
              {formatDateTime(item._creationTime, { dateStyle: "medium", timeStyle: "short" })}
            </p>
          </div>
        </div>
        {item.productSlug ? (
          <Link
            href={routes.product(item.productSlug)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Ürüne git
            <ArrowTopRightOnSquareIcon className="size-3.5" aria-hidden="true" />
          </Link>
        ) : null}
      </div>

      <p className="whitespace-pre-line rounded-lg border border-border/70 bg-muted/30 px-3.5 py-3 text-sm leading-6 text-foreground">
        {item.question}
      </p>

      {item.status === "approved" && !editing ? (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3.5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            Yanıt
          </p>
          <p className="mt-1 whitespace-pre-line text-sm leading-6 text-foreground">{item.answer}</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <label htmlFor={`answer-${item._id}`} className="text-xs font-medium text-foreground">
            Yanıt
          </label>
          <textarea
            id={`answer-${item._id}`}
            rows={3}
            maxLength={2000}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Müşterinin sorusuna verilecek yanıtı yazın..."
            className="w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm leading-relaxed text-foreground shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      )}

      {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        {editing ? (
          <Button size="sm" disabled={busy} onClick={() => void saveAnswer()}>
            <CheckIcon className="size-3.5" aria-hidden="true" />
            {busy ? "Kaydediliyor…" : "Yanıtla ve Yayınla"}
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => {
              setDraft(item.answer ?? "");
              setEditing(true);
            }}
          >
            <PencilSquareIcon className="size-3.5" aria-hidden="true" />
            Yanıtı Düzenle
          </Button>
        )}

        {item.status === "pending" ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            onClick={() => void changeStatus("rejected")}
          >
            Reddet
          </Button>
        ) : item.status === "approved" ? (
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => void changeStatus("pending")}>
            Yayından Kaldır
          </Button>
        ) : (
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => void changeStatus("pending")}>
            Beklemeye Al
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          onClick={() => void removeQuestion()}
        >
          <TrashIcon className="size-3.5" aria-hidden="true" />
          {confirmDelete ? "Silmeyi Onayla" : "Sil"}
        </Button>
        {confirmDelete ? (
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirmDelete(false)}>
            Vazgeç
          </Button>
        ) : null}
      </div>
    </article>
  );
}

export default function AdminQuestionsPage() {
  const [filter, setFilter] = useState<QuestionFilter>("pending");
  const { data: questions, error, loading, refresh } = useAdminResource<AdminQuestion[]>(
    "product-questions",
    { status: filter },
  );

  return (
    <div className="space-y-5">
      <AdminActionNotice error={error} />

      <Card className="overflow-hidden rounded-lg">
        <div className="border-b border-border p-4 sm:px-5">
          <div className="flex flex-wrap items-center gap-1.5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                aria-pressed={filter === tab.id}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  filter === tab.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <AdminLoading label="Ürün soruları" variant="list" />
        ) : !questions?.length ? (
          <div className="p-5">
            <AdminEmpty title={emptyCopy[filter].title} description={emptyCopy[filter].description} />
          </div>
        ) : (
          <div className="divide-y divide-border">
            {questions.map((item) => (
              <QuestionCard key={item._id} item={item} onChanged={() => void refresh()} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
