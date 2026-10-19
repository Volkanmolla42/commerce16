"use client";

import { useState } from "react";
import type { ChangeEvent, SyntheticEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import Image from "next/image";
import { StarRating } from "@/components/product/star-rating";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  ChatBubbleLeftRightIcon,
  ShieldCheckIcon,
  TruckIcon,
  BuildingStorefrontIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";

type OrderItem = {
  productId: string;
  variantId?: string;
  title: string;
  quantity: number;
  price: string;
  image?: string;
};

type OrderReviewModalProps = {
  orderId: Id<"orders">;
  items: OrderItem[];
  customerName?: string;
};

export function OrderReviewModal({ orderId, items }: OrderReviewModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Mevcut değerlendirme durumunu çek
  const reviewStatus = useQuery(api.reviews.getOrderReviewStatus, { orderId });
  const submitReviewMutation = useMutation(api.reviews.submitOrderReview);

  // Ürün puanları ve yorumları state'i (productId bazlı)
  const [productRatings, setProductRatings] = useState<Record<string, number>>({});
  const [productComments, setProductComments] = useState<Record<string, string>>({});

  // Mağaza / Alışveriş deneyimi state'i
  const [storeRating, setStoreRating] = useState<number>(5);
  const [deliveryRating, setDeliveryRating] = useState<number>(5);
  const [storeComment, setStoreComment] = useState<string>("");

  const handleProductRatingChange = (productId: string, rating: number) => {
    setProductRatings((prev) => ({ ...prev, [productId]: rating }));
  };

  const handleProductCommentChange = (productId: string, comment: string) => {
    setProductComments((prev) => ({ ...prev, [productId]: comment }));
  };

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // Puanlanmış veya yorum yazılmış ürünleri hazırla
      const productReviewsPayload: {
        productId: Id<"products">;
        rating: number;
        content: string;
      }[] = [];

      for (const item of items) {
        const rating = productRatings[item.productId] ?? 5;
        const comment = productComments[item.productId]?.trim();

        if (comment) {
          if (comment.length < 3) {
            setErrorMessage(`"${item.title}" için ürün yorumu en az 3 karakter olmalıdır.`);
            setIsSubmitting(false);
            return;
          }
          productReviewsPayload.push({
            productId: item.productId as Id<"products">,
            rating,
            content: comment,
          });
        }
      }

      await submitReviewMutation({
        orderId,
        productReviews: productReviewsPayload,
        storeFeedback: {
          storeRating,
          deliveryRating,
          comment: storeComment.trim() ? storeComment.trim() : undefined,
        },
      });

      setFeedbackSuccess(true);
      setTimeout(() => {
        setIsOpen(false);
        setFeedbackSuccess(false);
      }, 1800);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Değerlendirme kaydedilirken bir hata oluştu.";
      setErrorMessage(message);
    }
    setIsSubmitting(false);
  };

  const reviewedIds: string[] = reviewStatus?.reviewedProductIds ?? [];
  const isAlreadyReviewed = Boolean(reviewStatus?.hasStoreFeedback || reviewedIds.length > 0);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant={isAlreadyReviewed ? "outline" : "default"}
          size="sm"
          className={
            isAlreadyReviewed
              ? "rounded-xl border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 hover:bg-emerald-100/50"
              : "rounded-xl font-medium shadow-xs"
          }
        >
          {isAlreadyReviewed ? (
            <>
              <CheckCircleIcon className="mr-1.5 h-3.5 w-3.5" />
              <span>Değerlendirildi</span>
            </>
          ) : (
            <>
              <ChatBubbleLeftRightIcon className="mr-1.5 h-3.5 w-3.5" />
              <span>Siparişi Değerlendir</span>
            </>
          )}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl rounded-3xl p-6">
        <DialogHeader className="border-b border-border/60 pb-4 text-left">
          <DialogTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
            <ChatBubbleLeftRightIcon className="h-5 w-5 text-primary" />
            <span>Sipariş Değerlendirmesi</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Satın aldığınız ürünleri puanlayabilir ve alışveriş deneyiminizi doğrudan mağaza yönetimine iletebilirsiniz.
          </DialogDescription>
        </DialogHeader>

        {feedbackSuccess ? (
          <div className="py-12 text-center space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
              <CheckCircleIcon className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-foreground">Değerlendirmeniz Alındı!</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Geri bildiriminiz için teşekkür ederiz. Ürün yorumlarınız sayfada yayınlanırken, alışveriş deneyimi geri bildiriminiz yöneticimize iletildi.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6 pt-2">
            {errorMessage && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs font-medium text-destructive">
                {errorMessage}
              </div>
            )}

            {/* BÖLÜM 1: ÜRÜN DEĞERLENDİRMELERİ (Ürün Sayfasına Gider) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs text-primary font-bold">1</span>
                  Ürün Değerlendirmeleri
                </h4>
                <span className="text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                  Ürün Sayfasında Yayınlanır
                </span>
              </div>

              <div className="space-y-4">
                {items.map((item) => {
                  const currentRating = productRatings[item.productId] ?? 5;
                  const currentComment = productComments[item.productId] ?? "";
                  const wasReviewed = reviewedIds.includes(item.productId);

                  return (
                    <div
                      key={item.productId}
                      className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-xs"
                    >
                      <div className="flex items-start gap-3">
                        {item.image && (
                          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
                            <Image
                              src={item.image}
                              alt={item.title}
                              fill
                              sizes="48px"
                              className="object-contain"
                            />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground line-clamp-1">{item.title}</p>
                          <div className="mt-1 flex items-center gap-2">
                            <StarRating
                              rating={currentRating}
                              interactive={true}
                              size="sm"
                              showText={false}
                              onRate={(val) => handleProductRatingChange(item.productId, val)}
                            />
                            <span className="text-xs font-semibold text-foreground">
                              {currentRating} / 5 Yıldız
                            </span>
                            {wasReviewed && (
                              <span className="text-[10px] text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
                                Daha önce yorumlandı
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <textarea
                        aria-label={`${item.title} için ürün yorumu`}
                        placeholder="Bu ürün hakkında ne düşünüyorsunuz? Kalite, kumaş, ebat veya kullanım deneyiminizi paylaşın..."
                        rows={2}
                        value={currentComment}
                        onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                          handleProductCommentChange(item.productId, e.target.value)
                        }
                        className="w-full rounded-xl border border-input bg-muted/20 p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* BÖLÜM 2: MAĞAZA VE ALIŞVERİŞ DENEYİMİ (Yalnızca Admin/Yöneticiye Gider) */}
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground font-bold">2</span>
                  Alışveriş & Hizmet Deneyimi
                </h4>
                <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-500/20">
                  <ShieldCheckIcon className="h-3.5 w-3.5" />
                  <span>Sadece Mağaza Yönetimine İletilir</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Mağaza & Paketleme Puanı */}
                <div className="space-y-1.5 bg-background/80 p-3 rounded-xl border border-border">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <BuildingStorefrontIcon className="h-4 w-4 text-primary" />
                    <span>Paketleme & Hizmet Kalitesi</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <StarRating
                      rating={storeRating}
                      interactive={true}
                      size="sm"
                      showText={false}
                      onRate={setStoreRating}
                    />
                    <span className="text-xs font-bold text-foreground">{storeRating} / 5</span>
                  </div>
                </div>

                {/* Kargo & Teslimat Puanı */}
                <div className="space-y-1.5 bg-background/80 p-3 rounded-xl border border-border">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <TruckIcon className="h-4 w-4 text-primary" />
                    <span>Kargo Hızı & Teslimat Süreci</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <StarRating
                      rating={deliveryRating}
                      interactive={true}
                      size="sm"
                      showText={false}
                      onRate={setDeliveryRating}
                    />
                    <span className="text-xs font-bold text-foreground">{deliveryRating} / 5</span>
                  </div>
                </div>
              </div>

              {/* Mağazaya Özel Geri Bildirim */}
              <div className="space-y-1.5">
                <label htmlFor="store-feedback" className="text-xs font-medium text-muted-foreground">
                  Mağazaya iletmek istediğiniz özel görüş veya öneriniz (opsiyonel):
                </label>
                <textarea
                  id="store-feedback"
                  placeholder="Kargo süreci, paketleme veya mağaza hizmetimiz hakkında geri bildiriminizi yazabilirsiniz..."
                  rows={2}
                  value={storeComment}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setStoreComment(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsOpen(false)}
                className="rounded-xl text-xs"
              >
                Vazgeç
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="rounded-xl font-semibold shadow-sm"
              >
                {isSubmitting ? "Gönderiliyor..." : "Değerlendirmeyi Kaydet"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
