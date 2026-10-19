"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowTopRightOnSquareIcon,
  CheckIcon,
  ClipboardDocumentIcon,
  EyeIcon,
  MagnifyingGlassIcon,
  ShoppingCartIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AdminEmpty, AdminLoading, AdminNotice } from "../_components/admin-primitives";
import { runAdminAction, useAdminResource } from "../_components/admin-api";
import { formatMoney } from "@/lib/format-money";
import { formatDateTime } from "@/lib/format-date";
import { adminPath } from "@/lib/admin/routes";

type AbandonedCartItem = {
  productId: string;
  variantId?: string;
  quantity: number;
  title: string;
  variantTitle?: string;
  price: string;
  image?: string;
};

type AbandonedCart = {
  _id: string;
  _creationTime: number;
  sessionKey: string;
  email?: string;
  emailConsent: boolean;
  emailConsentedAt?: number;
  status: "active" | "sending" | "sent" | "converted" | "unsubscribed" | "failed" | "expired" | string;
  orderId?: string;
  restoreToken: string;
  lastActivityAt: number;
  expiresAt: number;
  emailSentAt?: number;
  itemCount: number;
  estimatedTotal: string;
  items: AbandonedCartItem[];
};

type LiveCart = {
  _id: string;
  _creationTime: number;
  sessionKey: string;
  updatedAt: number;
  expiresAt: number;
  itemCount: number;
  estimatedTotal: string;
  items: AbandonedCartItem[];
};

type CartEntry = AbandonedCart | LiveCart;

const statusBadgeConfig: Record<string, { label: string; className: string }> = {
  active: { label: "Bekliyor", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  sending: { label: "Gönderiliyor", className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" },
  sent: { label: "Hatırlatıldı", className: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20" },
  converted: { label: "Satışa Dönüştü", className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  unsubscribed: { label: "Abonelikten Çıktı", className: "bg-muted text-muted-foreground border-border" },
  failed: { label: "İletilemedi", className: "bg-destructive/10 text-destructive border-destructive/20" },
  expired: { label: "Süresi Doldu", className: "bg-muted text-muted-foreground border-border" },
};

function formatDate(timestamp: number) {
  return formatDateTime(timestamp, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function CartDetailModal({
  cart,
  onClose,
  onDeleted,
}: {
  cart: CartEntry;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const isLiveCart = "updatedAt" in cart;
  const activityAt = isLiveCart ? cart.updatedAt : cart.lastActivityAt;
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const recoverUrl = !isLiveCart && typeof window !== "undefined"
    ? `${window.location.origin}/cart?recover=${cart.restoreToken}`
    : !isLiveCart ? `/cart?recover=${cart.restoreToken}` : null;

  const copyRecoverLink = async () => {
    try {
      if (!recoverUrl) return;
      await navigator.clipboard.writeText(recoverUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignored
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      await runAdminAction("cart.delete", undefined, cart._id);
      onDeleted();
      onClose();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Sepet silinemedi.");
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const status = isLiveCart ? "active" : cart.status;
  const statusInfo = statusBadgeConfig[status] ?? {
    label: status,
    className: "bg-muted text-muted-foreground border-border",
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4 pr-6">
            <DialogTitle className="text-lg font-bold text-foreground">
              {isLiveCart ? "Canlı Sepet Detayı" : "Terk Edilmiş Sepet Detayı"}
            </DialogTitle>
            <Badge variant="outline" className={`rounded-md px-2 py-0.5 text-xs font-semibold ${isLiveCart ? "bg-primary/10 text-primary border-primary/20" : statusInfo.className}`}>
              {isLiveCart ? "Aktif Ziyaretçi" : statusInfo.label}
            </Badge>
          </div>
        </DialogHeader>

        {deleteError && <AdminNotice kind="error">{deleteError}</AdminNotice>}

        <div className="space-y-5 text-sm">
          {/* Müşteri ve Oturum Kartı */}
          <div className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2">
            <div>
              <span className="text-xs font-medium text-muted-foreground">Müşteri / Ziyaretçi</span>
              <p className="mt-0.5 font-semibold text-foreground">
                {!isLiveCart && cart.email ? cart.email : `Anonim (${cart.sessionKey.slice(0, 10)}…)`}
              </p>
            </div>
            <div>
              <span className="text-xs font-medium text-muted-foreground">Son Aktivite</span>
              <p className="mt-0.5 font-medium text-foreground">{formatDate(activityAt)}</p>
            </div>
            {!isLiveCart && (
              <div>
                <span className="text-xs font-medium text-muted-foreground">E-posta İzni</span>
                <p className="mt-0.5 font-medium text-foreground">
                  {cart.emailConsent ? "Hatırlatma İzni Verildi" : "İzin Verilmedi"}
                </p>
              </div>
            )}
            {!isLiveCart && cart.orderId && (
              <div>
                <span className="text-xs font-medium text-muted-foreground">Tamamlanan Sipariş</span>
                <p className="mt-0.5">
                  <Link
                    href={`${adminPath("orders")}?order=${cart.orderId}`}
                    className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                  >
                    Siparişe Git (#{cart.orderId.slice(-6).toUpperCase()})
                    <ArrowTopRightOnSquareIcon className="size-3.5" />
                  </Link>
                </p>
              </div>
            )}
          </div>

          {/* Kurtarma Bağlantısı */}
          {!isLiveCart && recoverUrl && (
            <div className="space-y-2 rounded-lg border border-border bg-card p-4">
              <span className="text-xs font-semibold text-foreground">Sepet Kurtarma Bağlantısı</span>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={recoverUrl}
                  className="h-9 text-xs font-mono select-all bg-muted/40"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={copyRecoverLink}
                  className="h-9 shrink-0 gap-1.5 px-3"
                >
                  {copied ? <CheckIcon className="size-4 text-primary" /> : <ClipboardDocumentIcon className="size-4" />}
                  <span>{copied ? "Kopyalandı" : "Kopyala"}</span>
                </Button>
                <Button asChild variant="outline" size="sm" className="h-9 shrink-0 px-3">
                  <a href={recoverUrl} target="_blank" rel="noopener noreferrer" title="Yeni sekmede aç">
                    <ArrowTopRightOnSquareIcon className="size-4" />
                  </a>
                </Button>
              </div>
            </div>
          )}

          {/* Sepetteki Ürünler */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">
                Sepet İçeriği ({cart.itemCount} adet ürün)
              </h3>
              <span className="font-bold text-foreground">
                Toplam: {formatMoney(cart.estimatedTotal)}
              </span>
            </div>

            <div className="divide-y divide-border rounded-lg border border-border bg-card overflow-hidden">
              {cart.items.map((item, index) => (
                <div key={`${item.productId}-${item.variantId ?? index}`} className="flex items-center gap-3.5 p-3.5">
                  <div className="relative size-12 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                    {item.image ? (
                      <Image
                        src={item.image}
                        alt={item.title}
                        fill
                        className="object-cover"
                        sizes="48px"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-muted-foreground">
                        <ShoppingCartIcon className="size-5" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{item.title}</p>
                    {item.variantTitle && (
                      <p className="text-xs text-muted-foreground">{item.variantTitle}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {item.quantity} adet × {formatMoney(item.price)}
                    </p>
                  </div>
                  <div className="text-right font-semibold text-foreground shrink-0">
                    {formatMoney((parseFloat(item.price || "0") * item.quantity).toFixed(2))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Aksiyon Butonları */}
          <div className="flex items-center justify-between border-t border-border pt-4">
            {!isLiveCart ? (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={deleting}
                  onClick={handleDelete}
                  className="gap-1.5"
                >
                  <TrashIcon className="size-4" />
                  <span>{deleting ? "Siliniyor…" : confirmDelete ? "Silmeyi Onayla" : "Sepet Kaydını Sil"}</span>
                </Button>
                {confirmDelete && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={deleting}
                    onClick={() => setConfirmDelete(false)}
                    className="text-xs"
                  >
                    Vazgeç
                  </Button>
                )}
              </div>
            ) : <div />}
            <Button type="button" variant="outline" onClick={onClose}>
              Kapat
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminCartsPage() {
  const { data: carts, loading, error, refresh } = useAdminResource<AbandonedCart[]>("abandoned-carts");
  const { data: activeCarts, loading: activeLoading, error: activeError } = useAdminResource<LiveCart[]>("active-carts");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [view, setView] = useState<"active" | "abandoned">("active");
  const [selectedCart, setSelectedCart] = useState<CartEntry | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const currentLoading = view === "active" ? activeLoading : loading;
  const currentError = view === "active" ? activeError : error;

  const copyLink = async (cart: AbandonedCart) => {
    try {
      const url = `${window.location.origin}/cart?recover=${cart.restoreToken}`;
      await navigator.clipboard.writeText(url);
      setCopiedId(cart._id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Ignored
    }
  };

  const liveCount = activeCarts?.length ?? 0;
  const abandonedCount = carts?.length ?? 0;

  // Filtrelenmiş Liste
  const cartSource: CartEntry[] = view === "active" ? activeCarts ?? [] : carts ?? [];
  const filteredCarts = cartSource.filter((cart) => {
    const isLiveCart = "updatedAt" in cart;
    if (!isLiveCart && statusFilter !== "all" && cart.status !== statusFilter) return false;

    if (search.trim()) {
      const query = search.toLowerCase();
      const emailMatch = !isLiveCart && cart.email?.toLowerCase().includes(query);
      const sessionMatch = cart.sessionKey.toLowerCase().includes(query);
      const itemMatch = cart.items.some((item) => item.title.toLowerCase().includes(query));
      if (!emailMatch && !sessionMatch && !itemMatch) return false;
    }
    return true;
  });

  return (
    <div className="space-y-5">
      {currentError && <AdminNotice kind="error">{currentError}</AdminNotice>}

      {/* Ana Sepet Tablo Kartı */}
      <Card className="overflow-hidden rounded-lg">
        {/* Üst Filtre Barı */}
        <div className="border-b border-border p-4 sm:px-5 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Sekmeler */}
            <div className="flex items-center rounded-lg border border-border bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => {
                  setView("active");
                  setStatusFilter("all");
                }}
                className={`flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  view === "active"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>Canlı Sepetler</span>
                <span className="rounded-full bg-primary/15 text-primary px-1.5 py-0.2 text-[10px] font-mono font-bold">
                  {liveCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setView("abandoned")}
                className={`flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  view === "abandoned"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>Terk Edilmişler</span>
                <span className="rounded-full bg-muted text-muted-foreground px-1.5 py-0.2 text-[10px] font-mono font-bold">
                  {abandonedCount}
                </span>
              </button>
            </div>

            {/* Arama Input */}
            <div className="relative min-w-0 sm:w-72">
              <MagnifyingGlassIcon
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                aria-label="Sepetlerde ara"
                type="search"
                placeholder={view === "active" ? "Ürün veya oturum ara..." : "E-posta veya ürün ara..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 pl-9 text-xs"
              />
            </div>
          </div>

          {/* Terk Edilmiş Sepet Durum Filtreleri */}
          {view === "abandoned" && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border/60">
              {[
                { id: "all", label: "Tüm Durumlar" },
                { id: "active", label: "Bekliyor" },
                { id: "sent", label: "Hatırlatıldı" },
                { id: "converted", label: "Satışa Dönüştü" },
                { id: "expired", label: "Süresi Doldu" },
              ].map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setStatusFilter(filter.id)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                    statusFilter === filter.id
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tablo İçeriği */}
        {currentLoading ? (
          <AdminLoading label={view === "active" ? "Canlı sepetler" : "Terk edilen sepetler"} variant="table" />
        ) : filteredCarts.length === 0 ? (
          <div className="p-6">
            <AdminEmpty
              title={search ? "Aramayla eşleşen sepet bulunamadı" : view === "active" ? "Şu an aktif sepet bulunmuyor" : "Terk edilmiş sepet kaydı yok"}
              description={search ? "Arama kriterlerinizi değiştirip yeniden deneyin." : view === "active" ? "Ziyaretçiler sepete ürün ekledikçe anlık olarak burada listelenir." : "Ödeme adımında bırakılan sepetler otomatik olarak burada toplanır."}
            />
          </div>
        ) : (
          <div>
            {/* Masaüstü Başlık */}
            <div className="hidden grid-cols-[minmax(0,1.3fr)_minmax(0,1.4fr)_110px_130px_130px_100px] gap-4 border-b border-border bg-muted/40 px-4 py-2.5 text-xs font-medium text-muted-foreground md:grid md:items-center sm:px-5">
              <span>Ziyaretçi / Müşteri</span>
              <span>Sepetteki Ürünler</span>
              <span>Tutar</span>
              <span>Durum</span>
              <span>Son Hareket</span>
              <span className="text-right">İşlem</span>
            </div>

            {/* Satırlar */}
            <div className="divide-y divide-border">
              {filteredCarts.map((cart) => {
                const isLiveCart = "updatedAt" in cart;
                const status = isLiveCart ? "active" : cart.status;
                const statusInfo = statusBadgeConfig[status] ?? { label: status, className: "bg-muted text-muted-foreground border-border" };

                return (
                  <article
                    key={cart._id}
                    className="grid gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.4fr)_110px_130px_130px_100px] md:items-center sm:px-5"
                  >
                    {/* Ziyaretçi / Müşteri */}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {!isLiveCart && cart.email ? cart.email : "Ziyaretçi"}
                      </p>
                      <p className="truncate font-mono text-[11px] text-muted-foreground" title={cart.sessionKey}>
                        #{cart.sessionKey.slice(0, 10)}…
                      </p>
                    </div>

                    {/* Ürünler */}
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="relative size-9 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                        {cart.items[0]?.image ? (
                          <Image src={cart.items[0].image} alt="" fill className="object-cover" sizes="36px" />
                        ) : (
                          <span className="grid size-full place-items-center text-xs text-muted-foreground">
                            <ShoppingCartIcon className="size-4" />
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-foreground">
                          {cart.items[0]?.title || "Ürün"}
                          {cart.items.length > 1 ? ` (+${cart.items.length - 1} ürün)` : ""}
                        </p>
                        <p className="text-[11px] text-muted-foreground">{cart.itemCount} adet ürün</p>
                      </div>
                    </div>

                    {/* Tutar */}
                    <div>
                      <span className="mb-1 block text-xs text-muted-foreground md:hidden">Tutar:</span>
                      <p className="text-sm font-semibold tabular-nums text-foreground">
                        {formatMoney(cart.estimatedTotal)}
                      </p>
                    </div>

                    {/* Durum */}
                    <div>
                      <span className="mb-1 block text-xs text-muted-foreground md:hidden">Durum:</span>
                      <Badge variant="outline" className={`rounded-md px-2 py-0.5 text-xs font-semibold ${isLiveCart ? "bg-primary/10 text-primary border-primary/20" : statusInfo.className}`}>
                        {isLiveCart ? "Canlı Sepet" : statusInfo.label}
                      </Badge>
                    </div>

                    {/* Son Hareket */}
                    <div>
                      <span className="mb-1 block text-xs text-muted-foreground md:hidden">Son Hareket:</span>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(isLiveCart ? cart.updatedAt : cart.lastActivityAt)}
                      </p>
                    </div>

                    {/* İşlem */}
                    <div className="flex items-center gap-1.5 md:justify-end">
                      {!isLiveCart && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => void copyLink(cart)}
                          className="h-8 px-2 text-xs"
                          title="Kurtarma bağlantısını kopyala"
                        >
                          {copiedId === cart._id ? (
                            <CheckIcon className="size-4 text-primary" />
                          ) : (
                            <ClipboardDocumentIcon className="size-4" />
                          )}
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedCart(cart)}
                        className="h-8 px-2.5 text-xs"
                      >
                        <EyeIcon className="mr-1 size-3.5" />
                        Detay
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {/* Detay Modalı */}
      {selectedCart && (
        <CartDetailModal
          cart={selectedCart}
          onClose={() => setSelectedCart(null)}
          onDeleted={() => {
            void refresh();
          }}
        />
      )}
    </div>
  );
}
