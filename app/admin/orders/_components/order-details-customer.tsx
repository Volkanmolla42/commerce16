"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowTopRightOnSquareIcon,
  ClipboardDocumentIcon,
  DocumentTextIcon,
  EnvelopeIcon,
  MapPinIcon,
  PencilSquareIcon,
  ShoppingBagIcon,
} from "@heroicons/react/24/outline";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { adminPath } from "@/lib/admin/routes";
import { formatMoney } from "@/lib/format-money";
import { formatPhone, formatWhatsAppUrl } from "@/lib/orders";
import type { Order } from "./order-admin-shared";

export function OrderDetailsCustomer({
  order,
  copiedKey,
  onCopy,
}: {
  order: Order;
  copiedKey: string | null;
  onCopy: (text: string, key: string) => void;
}) {
  const whatsAppUrl = formatWhatsAppUrl(order.customerPhone);

  return (
    <>
      {/* 2. ÖNCELİK: Sipariş Kalemleri (Paketleme & Hazırlama) */}
      <section className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-[.12em] text-muted-foreground flex items-center gap-1.5">
          <ShoppingBagIcon className="size-3.5" /> Paketlenecek Ürünler ({order.items.length})
        </h3>

        <div className="divide-y divide-border rounded-xl border border-border bg-card/60 overflow-hidden">
          {order.items.map((item) => {
            const parts = item.title.split("—");
            const mainTitle = parts[0]?.trim() || item.title;
            const variantInfo = parts.length > 1 ? parts.slice(1).join("—").trim() : null;

            return (
              <div
                key={`${item.productId}-${item.variantId ?? ""}`}
                className="flex items-center gap-3.5 p-3.5 text-sm hover:bg-muted/20 transition-colors"
              >
                {item.image ? (
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                    <Image
                      src={item.image}
                      alt={item.title}
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex size-14 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
                    <ShoppingBagIcon className="size-5 opacity-40" />
                  </div>
                )}

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-foreground text-sm leading-snug line-clamp-1">
                      {mainTitle}
                    </p>
                    {variantInfo && (
                      <span className="inline-flex items-center rounded-md bg-muted text-foreground border border-border px-2 py-0.5 text-xs font-medium">
                        {variantInfo}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-2.5 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {item.quantity} adet × {formatMoney(item.price)}
                    </span>
                    {item.sku && (
                      <>
                        <span>•</span>
                        <span className="font-mono text-[11px] bg-muted/70 px-1.5 py-0.5 rounded">
                          SKU: {item.sku}
                        </span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5 pt-0.5 text-xs">
                    <Link
                      href={adminPath("products")}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                    >
                      <PencilSquareIcon className="size-3" />
                      <span>Ürün</span>
                    </Link>
                    <span className="text-border text-[10px]">•</span>
                    <Link
                      href={`/search?q=${encodeURIComponent(mainTitle)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:underline"
                    >
                      <ArrowTopRightOnSquareIcon className="size-3" />
                      <span>Mağaza</span>
                    </Link>
                  </div>
                </div>

                <div className="shrink-0 text-right pl-2">
                  <p className="font-bold tabular-nums text-foreground text-sm">
                    {formatMoney(Number(item.price) * item.quantity)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. ÖNCELİK: Teslimat Adresi & Müşteri İletişim (Kargo Etiketi) */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        {/* Teslimat Adresi (Kargo Gönderiminin En Kritik Parçası) */}
        <div className="rounded-xl border border-border bg-card/60 p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-[.12em] text-muted-foreground flex items-center gap-1.5">
              <MapPinIcon className="size-3.5 text-primary" /> Teslimat Adresi
            </h3>
            {order.shippingAddress && (
              <button
                type="button"
                onClick={() => onCopy(order.shippingAddress!, "address")}
                className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
              >
                {copiedKey === "address" ? (
                  <span className="text-emerald-500 font-medium">Kopyalandı</span>
                ) : (
                  <>
                    <ClipboardDocumentIcon className="size-3" />
                    <span>Adresi Kopyala</span>
                  </>
                )}
              </button>
            )}
          </div>
          <p className="whitespace-pre-wrap text-xs font-medium leading-relaxed text-foreground bg-muted/30 p-2.5 rounded-lg border border-border/50">
            {order.shippingAddress || "Adres belirtilmemiş."}
          </p>
        </div>

        {/* Müşteri İletişimi */}
        <div className="rounded-xl border border-border bg-card/60 p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-[.12em] text-muted-foreground flex items-center gap-1.5">
              <EnvelopeIcon className="size-3.5 text-primary" /> Müşteri &amp; İletişim
            </h3>
            <Link
              href={adminPath(`customers?q=${encodeURIComponent(order.customerEmail)}`)}
              className="text-[11px] font-medium text-muted-foreground hover:text-foreground hover:underline"
            >
              Profil →
            </Link>
          </div>

          <div className="space-y-2">
            <p className="font-semibold text-foreground text-sm">{order.customerName}</p>

            {order.customerPhone && (
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-mono font-medium text-foreground">
                  {formatPhone(order.customerPhone)}
                </span>
                {whatsAppUrl && (
                  <a
                    href={whatsAppUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11px] font-medium text-foreground hover:text-primary transition-colors bg-muted/60 hover:bg-muted border border-border px-2 py-0.5 rounded-md"
                  >
                    <WhatsAppIcon className="size-3.5 text-emerald-500" />
                    <span>WhatsApp</span>
                  </a>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-2 text-xs pt-1 border-t border-border/60">
              <a
                href={`mailto:${order.customerEmail}`}
                className="truncate text-muted-foreground hover:text-foreground hover:underline"
              >
                {order.customerEmail}
              </a>
              <button
                type="button"
                onClick={() => onCopy(order.customerEmail, "email")}
                className="shrink-0 text-muted-foreground hover:text-foreground p-0.5 cursor-pointer"
                title="E-posta Kopyala"
              >
                {copiedKey === "email" ? (
                  <span className="text-emerald-500 text-[11px] font-medium">Kopyalandı</span>
                ) : (
                  <ClipboardDocumentIcon className="size-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Fatura Bilgileri (Kurumsal / Bireysel) */}
      <div className="rounded-xl border border-border bg-card/60 p-3.5 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-[.12em] text-muted-foreground flex items-center gap-1.5">
            <DocumentTextIcon className="size-3.5 text-primary" /> Fatura Bilgileri
            <span
              className={`ml-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                order.billingType === "corporate"
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "bg-muted text-muted-foreground border border-border"
              }`}
            >
              {order.billingType === "corporate" ? "Kurumsal Fatura" : "Bireysel Fatura"}
            </span>
          </h3>
          {order.billingAddress && (
            <button
              type="button"
              onClick={() => onCopy(order.billingAddress!, "billingAddress")}
              className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
            >
              {copiedKey === "billingAddress" ? (
                <span className="text-emerald-500 font-medium">Kopyalandı</span>
              ) : (
                <>
                  <ClipboardDocumentIcon className="size-3" />
                  <span>Fatura Adresini Kopyala</span>
                </>
              )}
            </button>
          )}
        </div>

        {order.billingType === "corporate" ? (
          <div className="space-y-2.5 bg-muted/30 p-2.5 rounded-lg border border-border/50 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="sm:col-span-2">
                <span className="text-muted-foreground block text-[11px]">Firma Resmi Unvanı:</span>
                <span className="font-semibold text-foreground text-xs leading-snug">
                  {order.companyName || "Belirtilmemiş"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Vergi No / TCKN:</span>
                <span className="font-mono font-medium text-foreground text-xs">
                  {order.taxNumber || "Belirtilmemiş"}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1.5 border-t border-border/40">
              <div>
                <span className="text-muted-foreground block text-[11px]">Vergi Dairesi:</span>
                <span className="font-medium text-foreground">{order.taxOffice || "Belirtilmemiş"}</span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-muted-foreground block text-[11px]">Fatura Adresi:</span>
                <span className="font-medium text-foreground leading-relaxed">
                  {order.billingAddress || order.shippingAddress || "Teslimat adresiyle aynı."}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-xs font-medium leading-relaxed text-foreground bg-muted/30 p-2.5 rounded-lg border border-border/50">
            {order.billingAddress || order.shippingAddress || "Teslimat adresiyle aynı."}
          </p>
        )}
      </div>
    </>
  );
}
