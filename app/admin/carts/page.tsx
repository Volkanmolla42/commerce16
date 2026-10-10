"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  CheckIcon,
  ClipboardDocumentIcon,
  ClockIcon,
  EnvelopeIcon,
  EyeIcon,
  MagnifyingGlassIcon,
  ShoppingCartIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
} from "@/components/ui";
import { AdminEmpty, AdminLoading, AdminNotice, AdminPageHeader } from "../_components/admin-primitives";
import { runAdminAction, useAdminResource } from "../_components/admin-api";
import { formatMoney } from "@/lib/format-money";
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
  reminderScheduled: boolean;
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

const statusConfig: Record<
  string,
  { label: string; className: string }
> = {
  active: {
    label: "Bekliyor",
    className: "border-border bg-muted text-muted-foreground",
  },
  sending: {
    label: "Gönderiliyor",
    className: "border-border bg-muted text-muted-foreground",
  },
  sent: {
    label: "Hatırlatıldı",
    className: "border-border bg-muted text-muted-foreground",
  },
  converted: {
    label: "Satışa Dönüştü",
    className: "border-border bg-muted text-muted-foreground",
  },
  unsubscribed: {
    label: "Abonelikten Çıktı",
    className: "border-border bg-muted text-muted-foreground",
  },
  failed: {
    label: "Gönderilemedi",
    className: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  expired: {
    label: "Süresi Doldu",
    className: "border-border bg-muted text-muted-foreground",
  },
};

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
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
    if (!window.confirm("Bu terk edilmiş sepet kaydını silmek istediğinize emin misiniz?")) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await runAdminAction("cart.delete", undefined, cart._id);
      onDeleted();
      onClose();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Sepet silinemedi.");
      setDeleting(false);
    }
  };

  const status = isLiveCart ? "active" : cart.status;
  const statusInfo = statusConfig[status] ?? {
    label: status,
    className: "border-border bg-muted text-muted-foreground",
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4 pr-6">
            <DialogTitle className="text-xl font-bold text-foreground">
              Sepet ayrıntısı
            </DialogTitle>
            <Badge variant="outline" className="rounded-md px-2 py-0.5 text-xs font-medium">
              {isLiveCart ? "Aktif sepet" : statusInfo.label}
            </Badge>
          </div>
        </DialogHeader>

        {deleteError && <AdminNotice kind="error">{deleteError}</AdminNotice>}

        <div className="space-y-6 text-sm">
          {/* Müşteri ve Oturum Özeti */}
          <div className="grid gap-3 rounded-lg border border-border bg-muted/30 p-4 sm:grid-cols-2">
            {!isLiveCart && <div>
              <span className="text-xs font-medium text-muted-foreground">Müşteri e-postası</span>
              <p className="mt-0.5 font-semibold text-foreground">{cart.email || "Anonim ziyaretçi"}</p>
            </div>}
            {isLiveCart ? <div>
              <span className="text-xs font-medium text-muted-foreground">Ziyaretçi oturumu</span>
              <p className="mt-0.5 truncate font-mono text-xs text-foreground" title={cart.sessionKey}>{cart.sessionKey}</p>
            </div> : <div>
              <span className="text-xs font-medium text-muted-foreground">E-posta hatırlatma izni</span>
              <p className="mt-0.5 flex items-center gap-1.5 font-semibold text-foreground">
                {cart.emailConsent ? <><CheckCircleIcon className="size-4 text-muted-foreground" /><span>İzin verildi</span></> : <><ClockIcon className="size-4 text-muted-foreground" /><span>İzin verilmedi</span></>}
              </p>
            </div>}
            <div>
              <span className="text-xs font-medium text-muted-foreground">Oluşturulma tarihi</span>
              <p className="mt-0.5 text-foreground">{formatDate(cart._creationTime)}</p>
            </div>
            <div>
              <span className="text-xs font-medium text-muted-foreground">Son güncelleme</span>
              <p className="mt-0.5 text-foreground">{formatDate(activityAt)}</p>
            </div>
            {!isLiveCart && cart.emailSentAt && (
              <div>
                <span className="text-xs font-medium text-muted-foreground">E-posta Gönderilme Zamanı</span>
                <p className="mt-0.5 flex items-center gap-1 text-muted-foreground">
                  <EnvelopeIcon className="size-4" />
                  {formatDate(cart.emailSentAt)}
                </p>
              </div>
            )}
            {!isLiveCart && cart.orderId && (
              <div>
                <span className="text-xs font-medium text-muted-foreground">Oluşan Sipariş</span>
                <p className="mt-0.5">
                  <Link
                    href={adminPath(`orders?search=${cart.orderId}`)}
                    className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                  >
                    Siparişi Gör ({cart.orderId.slice(-6)})
                    <ArrowTopRightOnSquareIcon className="size-3.5" />
                  </Link>
                </p>
              </div>
            )}
          </div>

          {/* Kurtarma Linki */}
          {!isLiveCart && recoverUrl && <div className="space-y-1.5 rounded-lg border border-border bg-card p-4">
            <span className="text-xs font-semibold text-foreground">Müşteri Kurtarma Bağlantısı</span>
            <p className="text-xs text-muted-foreground">
              Müşteri bu bağlantıyı tıkladığında sepetindeki tüm ürünler anında geri yüklenir.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <Input
                readOnly
                value={recoverUrl}
                className="h-10 text-xs font-mono select-all bg-muted/40"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={copyRecoverLink}
                className="h-10 shrink-0 gap-1.5 px-3"
              >
                {copied ? <CheckIcon className="size-4 text-muted-foreground" /> : <ClipboardDocumentIcon className="size-4" />}
                <span>{copied ? "Kopyalandı" : "Kopyala"}</span>
              </Button>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-10 shrink-0 px-3"
              >
                <a href={recoverUrl} target="_blank" rel="noopener noreferrer" title="Yeni sekmede aç">
                  <ArrowTopRightOnSquareIcon className="size-4" />
                </a>
              </Button>
            </div>
          </div>}

          {/* Sepetteki Ürünler */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">
                Sepetteki Ürünler ({cart.itemCount} adet)
              </h3>
              <span className="font-bold text-foreground">
                Tahmini Tutar: {formatMoney(cart.estimatedTotal)}
              </span>
            </div>

            <div className="divide-y divide-border rounded-2xl border border-border bg-card overflow-hidden">
              {cart.items.map((item, index) => (
                <div key={`${item.productId}-${item.variantId ?? index}`} className="flex items-center gap-3.5 p-3.5">
                  <div className="relative size-12 shrink-0 overflow-hidden rounded-xl border border-border bg-muted/30">
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
            {!isLiveCart ? <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={deleting}
              onClick={handleDelete}
              className="gap-1.5"
            >
              <TrashIcon className="size-4" />
              <span>{deleting ? "Siliniyor…" : "Sepet Kaydını Sil"}</span>
            </Button> : <span className="text-xs text-muted-foreground">Sepet verisi anonim oturumdan alınır.</span>}
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
  const [consentFilter, setConsentFilter] = useState<string>("all");
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

  const recoveryStats = (() => {
    if (!carts) return { active: 0, recoveredRevenue: "0.00" };
    const active = carts.filter((c) => c.status === "active").length;
    const converted = carts.filter((c) => c.status === "converted");
    const recoveredRevenue = converted.reduce(
      (sum, c) => sum + (parseFloat(c.estimatedTotal) || 0),
      0,
    );

    return {
      active,
      recoveredRevenue: recoveredRevenue.toFixed(2),
    };
  })();

  const cartSource: CartEntry[] = view === "active" ? activeCarts ?? [] : carts ?? [];
  const filteredCarts = cartSource.filter((cart) => {
    const isLiveCart = "updatedAt" in cart;
    if (!isLiveCart && statusFilter !== "all" && cart.status !== statusFilter) return false;
    if (!isLiveCart && consentFilter === "consented" && !cart.emailConsent) return false;
    if (!isLiveCart && consentFilter === "no_consent" && cart.emailConsent) return false;

    if (search.trim()) {
      const query = search.toLowerCase();
      const emailMatch = !isLiveCart && cart.email?.toLowerCase().includes(query);
      const sessionMatch = cart.sessionKey.toLowerCase().includes(query);
      const itemMatch = cart.items.some((item) => item.title.toLowerCase().includes(query));
      if (!emailMatch && !sessionMatch && !itemMatch) return false;
    }
    return true;
  });

  const liveItemCount = (activeCarts ?? []).reduce((sum, cart) => sum + cart.itemCount, 0);
  const liveCartValue = (activeCarts ?? []).reduce((sum, cart) => sum + (Number.parseFloat(cart.estimatedTotal) || 0), 0);

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Sepetler"
        description="Aktif sepetleri ve terk edilen sepet hatırlatmalarını görüntüleyin."
      />

      {currentError && <AdminNotice kind="error">{currentError}</AdminNotice>}

      <div role="group" aria-label="Sepet türü" className="flex gap-5 border-b border-border">
        <button type="button" aria-pressed={view === "active"} onClick={() => { setView("active"); setStatusFilter("all"); setConsentFilter("all"); }} className={`flex min-h-10 items-center gap-2 border-b-2 px-1 text-sm font-medium ${view === "active" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          Aktif sepetler <Badge variant="outline" className="rounded-md px-1.5 py-0 text-xs">{activeCarts?.length ?? 0}</Badge>
        </button>
        <button type="button" aria-pressed={view === "abandoned"} onClick={() => setView("abandoned")} className={`flex min-h-10 items-center gap-2 border-b-2 px-1 text-sm font-medium ${view === "abandoned" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          Terk edilenler <Badge variant="outline" className="rounded-md px-1.5 py-0 text-xs">{carts?.length ?? 0}</Badge>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {view === "active" ? <>
          <Card className="min-w-0 rounded-lg px-3 py-2.5 sm:px-4 sm:py-3"><p className="text-[11px] leading-4 text-muted-foreground sm:text-xs">Ürün adedi</p><p className="mt-1 truncate text-base font-semibold tabular-nums text-foreground sm:text-xl">{liveItemCount}</p></Card>
          <Card className="min-w-0 rounded-lg px-3 py-2.5 sm:px-4 sm:py-3"><p className="text-[11px] leading-4 text-muted-foreground sm:text-xs">Sepet toplamı</p><p className="mt-1 truncate text-base font-semibold tabular-nums text-foreground sm:text-xl">{formatMoney(liveCartValue.toFixed(2))}</p></Card>
        </> : <>
          <Card className="min-w-0 rounded-lg px-3 py-2.5 sm:px-4 sm:py-3"><p className="text-[11px] leading-4 text-muted-foreground sm:text-xs">Hatırlatma bekleyen</p><p className="mt-1 truncate text-base font-semibold tabular-nums text-foreground sm:text-xl">{recoveryStats.active}</p></Card>
          <Card className="min-w-0 rounded-lg px-3 py-2.5 sm:px-4 sm:py-3"><p className="text-[11px] leading-4 text-muted-foreground sm:text-xs">Kurtarılan ciro</p><p className="mt-1 truncate text-base font-semibold tabular-nums text-foreground sm:text-xl">{formatMoney(recoveryStats.recoveredRevenue)}</p></Card>
        </>}
      </div>

      <Card className="rounded-lg p-3">
        <div className={`grid gap-2 ${view === "active" ? "sm:grid-cols-[minmax(0,1fr)_auto]" : "sm:grid-cols-[minmax(0,1fr)_190px_190px]"}`}>
          <div className="relative min-w-0">
            <MagnifyingGlassIcon aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Sepetlerde ara" type="search" placeholder={view === "active" ? "Oturum anahtarı veya ürün ara" : "E-posta, oturum veya ürün ara"} value={search} onChange={(event) => setSearch(event.target.value)} className="h-10 pl-9" />
          </div>
          {view === "abandoned" && <>
            <select aria-label="Hatırlatma durumuna göre filtrele" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring">
              <option value="all">Tüm durumlar</option>
              <option value="active">Bekliyor</option>
              <option value="sending">Gönderiliyor</option>
              <option value="sent">Hatırlatıldı</option>
              <option value="converted">Satışa dönüştü</option>
              <option value="unsubscribed">İzin kaldırıldı</option>
              <option value="expired">Süresi doldu</option>
              <option value="failed">Gönderilemedi</option>
            </select>
            <select aria-label="E-posta iznine göre filtrele" value={consentFilter} onChange={(event) => setConsentFilter(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring">
              <option value="all">Tüm izinler</option>
              <option value="consented">İzin verilenler</option>
              <option value="no_consent">İzin verilmeyenler</option>
            </select>
          </>}
        </div>
      </Card>

      <p aria-live="polite" className="sr-only">{currentLoading ? "Sepetler yükleniyor…" : `${filteredCarts.length} sepet listelendi`}</p>
      {currentLoading ? <AdminLoading label={view === "active" ? "Aktif sepetler" : "Terk edilen sepetler"} variant="table" /> : filteredCarts.length === 0 ? (
        <AdminEmpty
          title={search || (view === "abandoned" && (statusFilter !== "all" || consentFilter !== "all")) ? "Aramayla eşleşen sepet yok" : view === "active" ? "Aktif sepet yok" : "Terk edilmiş sepet bulunamadı"}
          description={search || (view === "abandoned" && (statusFilter !== "all" || consentFilter !== "all")) ? "Aramayı veya filtreleri değiştirip yeniden deneyin." : view === "active" ? "Ziyaretçi mağazada ürün eklediğinde sepeti burada görünür." : "Ödeme aşamasında terk edilmiş bir sepet kaydı henüz oluşmamış."}
        />
      ) : (
        <Card className="overflow-hidden rounded-lg">
          <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_110px_130px_150px_auto] gap-3 border-b border-border bg-muted/40 px-4 py-2.5 text-xs font-medium text-muted-foreground md:grid">
            <span>Ziyaretçi</span><span>Ürünler</span><span>Tutar</span><span>Durum</span><span>Son hareket</span><span className="text-right">İşlemler</span>
          </div>
          <div className="divide-y divide-border">
            {filteredCarts.map((cart) => {
              const isLiveCart = "updatedAt" in cart;
              const status = isLiveCart ? "active" : cart.status;
              const statusInfo = statusConfig[status] ?? { label: status, className: "border-border bg-muted text-muted-foreground" };
              return <article key={cart._id} className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_110px_130px_150px_auto] md:items-center">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{isLiveCart ? "Anonim ziyaretçi" : cart.email || "Anonim ziyaretçi"}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground" title={cart.sessionKey}>{cart.sessionKey.slice(0, 12)}…</p>
                </div>
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex shrink-0 -space-x-2 overflow-hidden">
                    {cart.items.slice(0, 3).map((item, index) => <div key={`${item.productId}-${item.variantId ?? index}`} className="relative size-8 overflow-hidden rounded-md border border-background bg-muted">
                      {item.image ? <Image src={item.image} alt="" fill className="object-cover" sizes="32px" /> : <span className="grid size-full place-items-center text-[10px] text-muted-foreground">{item.quantity}</span>}
                    </div>)}
                  </div>
                  <span className="truncate text-xs text-muted-foreground">{cart.items[0]?.title}{cart.items.length > 1 ? ` +${cart.items.length - 1}` : ""}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{cart.itemCount} adet</span>
                </div>
                <div><span className="mb-1 block text-xs text-muted-foreground md:hidden">Tutar</span><p className="text-sm font-semibold tabular-nums text-foreground">{formatMoney(cart.estimatedTotal)}</p></div>
                <div><span className="mb-1 block text-xs text-muted-foreground md:hidden">Durum</span><Badge variant="outline" className={`rounded-md px-2 py-0.5 text-xs font-medium ${isLiveCart ? "" : statusInfo.className}`}>{isLiveCart ? "Aktif sepet" : statusInfo.label}</Badge>{!isLiveCart && cart.emailConsent && <span className="ml-2 text-xs text-muted-foreground">İzinli</span>}</div>
                <div><span className="mb-1 block text-xs text-muted-foreground md:hidden">Son hareket</span><p className="text-xs text-muted-foreground">{formatDate(isLiveCart ? cart.updatedAt : cart.lastActivityAt)}</p></div>
                <div className="flex items-center gap-1 md:justify-end">
                  {!isLiveCart && <Button type="button" variant="ghost" size="sm" onClick={() => void copyLink(cart)} className="h-9 px-2 text-xs" title="Kurtarma bağlantısını kopyala">{copiedId === cart._id ? <CheckIcon className="size-4 text-muted-foreground" /> : <ClipboardDocumentIcon className="size-4" />}<span className="ml-1">{copiedId === cart._id ? "Kopyalandı" : "Link"}</span></Button>}
                  <Button type="button" variant="outline" size="sm" onClick={() => setSelectedCart(cart)} className="h-9 px-2.5 text-xs"><EyeIcon className="mr-1 size-4" />İncele</Button>
                </div>
              </article>;
            })}
          </div>
        </Card>
      )}

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
