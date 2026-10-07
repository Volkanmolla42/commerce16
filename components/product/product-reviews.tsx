"use client";

import { useEffect, useRef, useState, type FormEvent, type ChangeEvent } from "react";
import { useConvexAuth } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import Image from "next/image";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const allowedImages = new Set(["image/jpeg", "image/png", "image/webp"]);
const allowedVideos = new Set(["video/mp4", "video/webm"]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 30 * 1024 * 1024;

type Preview = { file: File; url: string; uploadId?: Id<"reviewUploads"> };

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(date);
}

function RatingStars({ rating }: { rating: number }) {
  return (
    <span aria-label={`${rating} / 5 yıldız`} className="tracking-wide text-amber-500">
      {"★".repeat(Math.max(0, Math.min(5, Math.round(rating))))}
      <span className="text-neutral-300 dark:text-neutral-700">{"★".repeat(Math.max(0, 5 - Math.round(rating)))}</span>
    </span>
  );
}

export function ProductReviews({ productId, productTitle }: { productId: string; productTitle: string }) {
  const id = productId as Id<"products">;
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const data = useQuery(api.reviews.listForProduct, { productId: id });
  const generateUploadUrl = useMutation(api.reviews.generateUploadUrl);
  const registerMedia = useMutation(api.reviews.registerMedia);
  const removeStagedMedia = useMutation(api.reviews.removeStagedMedia);
  const createReview = useMutation(api.reviews.create);
  const [rating, setRating] = useState(0);
  const [previews, setPreviews] = useState<Preview[]>([]);
  const previewUrls = useRef(new Set<string>());
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => () => {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrls.current.clear();
  }, []);

  function onFilesSelected(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    setError("");
    if (previews.length + selected.length > 5) {
      setError("En fazla 5 fotoğraf veya video ekleyebilirsiniz.");
      return;
    }
    const combined = [...previews.map(({ file }) => file), ...selected];
    if (combined.filter((file) => allowedVideos.has(file.type)).length > 1) {
      setError("Bir yorumda en fazla 1 video paylaşabilirsiniz.");
      return;
    }
    const invalid = selected.find((file) => {
      if (allowedImages.has(file.type)) return file.size > MAX_IMAGE_BYTES;
      if (allowedVideos.has(file.type)) return file.size > MAX_VIDEO_BYTES;
      return true;
    });
    if (invalid) {
      setError("Fotoğraflar JPEG, PNG veya WebP (en fazla 5 MB); videolar MP4 veya WebM (en fazla 30 MB) olmalı.");
      return;
    }
    const nextPreviews = selected.map((file) => {
      const url = URL.createObjectURL(file);
      previewUrls.current.add(url);
      return { file, url };
    });
    setPreviews((current) => [...current, ...nextPreviews]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    const body = String(form.get("body") ?? "").trim();
    if (rating < 1 || rating > 5) {
      setError("Lütfen 1 ile 5 yıldız arasında puan verin.");
      return;
    }

    setSubmitting(true);
    try {
      const mediaUploadIds: Id<"reviewUploads">[] = [];
      for (const [index, preview] of previews.entries()) {
        const { file } = preview;
        setStatus(`${index + 1}/${previews.length} medya dosyası yükleniyor…`);
        let uploadId = preview.uploadId;
        if (!uploadId) {
          const uploadUrl = await generateUploadUrl({ productId: id });
          const response = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": file.type },
            body: file,
          });
          if (!response.ok) throw new Error("Medya dosyası yüklenemedi. Lütfen tekrar deneyin.");
          const result = await response.json() as { storageId: Id<"_storage"> };
          uploadId = await registerMedia({ productId: id, storageId: result.storageId });
          setPreviews((current) => current.map((item) => item.url === preview.url ? { ...item, uploadId } : item));
        }
        mediaUploadIds.push(uploadId);
      }

      await createReview({ productId: id, rating, title, body, mediaUploadIds });
      previews.forEach(({ url }) => {
        URL.revokeObjectURL(url);
        previewUrls.current.delete(url);
      });
      setPreviews([]);
      setRating(0);
      setStatus("Yorumunuz yayınlandı. Teşekkür ederiz.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Yorum gönderilemedi. Lütfen tekrar deneyin.");
      setStatus("");
    } finally {
      setSubmitting(false);
    }
  }

  const averageRating = data?.averageRating ?? 0;
  return (
    <section id="reviews" className="mx-auto mt-12 max-w-(--breakpoint-2xl) px-4 py-8" aria-labelledby="reviews-title">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-neutral-200 pb-5 dark:border-neutral-800">
        <div>
          <h2 id="reviews-title" className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">Müşteri yorumları</h2>
          {data && data.totalReviews > 0 ? (
            <div className="mt-2 flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
              <RatingStars rating={averageRating} />
              <strong className="text-neutral-900 dark:text-white">{averageRating.toFixed(1)}</strong>
              <span>· {data.totalReviews >= 500 ? "500+" : data.totalReviews} doğrulanmış yorum</span>
            </div>
          ) : (
            <p className="mt-2 text-sm text-neutral-500">Henüz yorum yok. İlk değerlendirmeyi siz yapın.</p>
          )}
        </div>
      </div>

      {data?.canReview && !data.hasReviewed ? (
        <form onSubmit={submit} className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">{productTitle} için yorum yazın</h3>
          <p className="mt-1 text-sm text-neutral-500">Yorumlar yalnızca ürünü içeren tamamlanmış siparişlerden gönderilebilir.</p>

          <fieldset className="mt-5">
            <legend className="mb-2 text-sm font-medium text-neutral-800 dark:text-neutral-200">Puanınız <span aria-hidden="true">*</span></legend>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <label key={value} className="cursor-pointer rounded-sm focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-blue-500">
                  <input
                    className="peer sr-only"
                    type="radio"
                    name="rating"
                    value={value}
                    checked={rating === value}
                    onChange={() => setRating(value)}
                    required
                  />
                  <span aria-hidden="true" className={`text-3xl transition-colors ${rating >= value ? "text-amber-500" : "text-neutral-300 dark:text-neutral-700"}`}>★</span>
                  <span className="sr-only">{value} yıldız</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="mt-4 grid gap-4">
            <div>
              <label htmlFor="review-title" className="mb-1.5 block text-sm font-medium text-neutral-800 dark:text-neutral-200">Başlık</label>
              <input id="review-title" name="title" required minLength={3} maxLength={100} className="w-full rounded-xl border border-neutral-300 bg-transparent px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-neutral-700" />
            </div>
            <div>
              <label htmlFor="review-body" className="mb-1.5 block text-sm font-medium text-neutral-800 dark:text-neutral-200">Yorumunuz</label>
              <textarea id="review-body" name="body" required minLength={10} maxLength={2000} rows={4} className="w-full resize-y rounded-xl border border-neutral-300 bg-transparent px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-neutral-700" />
            </div>
            <div>
              <label htmlFor="review-media" className="mb-1.5 block text-sm font-medium text-neutral-800 dark:text-neutral-200">Fotoğraf veya video <span className="font-normal text-neutral-500">(isteğe bağlı, en fazla 5 dosya)</span></label>
              <input id="review-media" name="media" type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" onChange={onFilesSelected} aria-describedby="review-media-help" disabled={submitting} className="block w-full text-sm text-neutral-700 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-100 file:px-3 file:py-2 file:font-medium disabled:opacity-60 dark:text-neutral-300 dark:file:bg-neutral-800" />
              <p id="review-media-help" className="mt-1 text-xs text-neutral-500">JPEG, PNG veya WebP en fazla 5 MB; MP4 veya WebM en fazla 30 MB. Bir yorumda en fazla 1 video.</p>
              {previews.length > 0 && (
                <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Seçilen medya dosyaları">
                  {previews.map(({ file, url }, index) => (
                      <li key={`${file.name}-${file.lastModified}-${index}`} className="relative overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
                      {allowedVideos.has(file.type)
                        ? <video src={url} controls preload="none" className="aspect-video w-full bg-black object-contain" aria-label={`${file.name} önizlemesi`} />
                        : <Image src={url} alt={`${file.name} önizlemesi`} width={480} height={320} unoptimized className="aspect-video w-full object-cover" />}
                      <button type="button" disabled={submitting} onClick={async () => {
                        const preview = previews[index];
                        if (preview.uploadId) {
                          try {
                            await removeStagedMedia({ uploadId: preview.uploadId });
                          } catch (cause) {
                            setError(cause instanceof Error ? cause.message : "Dosya kaldırılamadı.");
                            return;
                          }
                        }
                        URL.revokeObjectURL(url);
                        previewUrls.current.delete(url);
                        setPreviews((current) => current.filter((_, currentIndex) => currentIndex !== index));
                      }} className="absolute right-2 top-2 rounded-full bg-black/75 px-2.5 py-1 text-xs font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50">Kaldır</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
          {status && <p role="status" aria-live="polite" className="mt-4 text-sm text-emerald-700 dark:text-emerald-300">{status}</p>}
          <button type="submit" disabled={submitting} className="mt-5 rounded-xl bg-neutral-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:cursor-wait disabled:opacity-60 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200">
            {submitting ? "Gönderiliyor…" : "Doğrulanmış yorum gönder"}
          </button>
        </form>
      ) : null}

      {!authLoading && !isAuthenticated && (
        <p className="mt-6 rounded-xl bg-neutral-100 px-4 py-3 text-sm text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
          Yorum yazmak için <Link href="/login" className="font-semibold underline underline-offset-2">giriş yapın</Link>. Doğrulanmış alıcı rozeti, tamamlanmış siparişle kontrol edilir.
        </p>
      )}
      {isAuthenticated && data?.hasReviewed && (
        <p className="mt-6 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">Bu ürün için doğrulanmış yorumunuz yayınlandı.</p>
      )}
      {isAuthenticated && data && !data.canReview && !data.hasReviewed && (
        <p className="mt-6 text-sm text-neutral-500">Yorum yazabilmek için bu ürünü içeren tamamlanmış bir sipariş gerekir.</p>
      )}

      {!data ? (
        <p className="mt-6 text-sm text-neutral-500" role="status">Yorumlar yükleniyor…</p>
      ) : data.reviews.length > 0 ? (
        <ul className="mt-6 divide-y divide-neutral-200 dark:divide-neutral-800">
          {data.reviews.map((review) => (
            <li key={review.id} className="py-6 first:pt-0">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-neutral-900 dark:text-white">{review.authorName}</p>
                  <p className="mt-0.5 text-xs text-neutral-500">{formatDate(review.createdAt)}</p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                  <span aria-hidden="true">✓</span> Doğrulanmış alıcı
                </span>
              </div>
              <div className="mt-3"><RatingStars rating={review.rating} /></div>
              <h3 className="mt-2 font-semibold text-neutral-900 dark:text-white">{review.title}</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-neutral-700 dark:text-neutral-300">{review.body}</p>
              {review.media.length > 0 && (
                <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Yorum fotoğraf ve videoları">
                  {review.media.map((media, index) => (
                    <li key={`${review.id}-${index}`} className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
                      {media.mediaType === "video"
                        ? <video src={media.url} controls preload="none" className="aspect-video w-full bg-black object-contain" aria-label={`${review.authorName} tarafından paylaşılan video`} />
                        : <Image src={media.url} alt={`${review.authorName} tarafından paylaşılan ürün fotoğrafı`} width={640} height={480} unoptimized className="aspect-video w-full object-cover" />}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-sm text-neutral-500">Henüz yorum paylaşılmamış.</p>
      )}
    </section>
  );
}
