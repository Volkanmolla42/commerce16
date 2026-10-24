"use client";

import { useState, type ComponentType, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowDownIcon,
  ArrowPathIcon,
  ArrowUpIcon,
  BanknotesIcon,
  ClockIcon,
  CursorArrowRaysIcon,
  ReceiptPercentIcon,
  ShoppingBagIcon,
  StarIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AdminEmpty, AdminLoading, AdminNotice } from "../_components/admin-primitives";
import { AdminHeaderAction } from "../_components/admin-header-action";
import { useAdminResource } from "../_components/admin-api";
import { adminPath } from "@/lib/admin/routes";
import { formatMoney } from "@/lib/format-money";
import type { AnalyticsDashboard } from "@/lib/analytics/types";
import { AnalyticsTrendChart } from "./analytics-chart";

type IconComponent = ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;

const numberFormatter = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 });

const SOURCE_LABELS: Record<string, string> = {
  direct: "Doğrudan",
  google: "Google",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  youtube: "YouTube",
  twitter: "X",
  x: "X",
  bing: "Bing",
  newsletter: "Bülten",
  email: "E-posta",
  whatsapp: "WhatsApp",
  referral: "Yönlendirme",
};

const MEDIUM_LABELS: Record<string, string> = {
  organic: "Organik",
  cpc: "Reklam",
  paid: "Ücretli",
  social: "Sosyal",
  email: "E-posta",
  referral: "Yönlendirme",
  affiliate: "Ortaklık",
};

const STATUS_COLORS: Record<string, string> = {
  received: "bg-blue-500",
  shipped: "bg-sky-500",
  delivered: "bg-emerald-500",
  cancelled: "bg-red-500",
};

const PAYMENT_COLORS: Record<string, string> = {
  paid: "bg-emerald-500",
  pending: "bg-amber-500",
  failed: "bg-red-500",
  refunded: "bg-purple-500",
};

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function formatPercent(value: number) {
  return `%${numberFormatter.format(value)}`;
}

function change(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function pointsChange(current: number, previous: number) {
  return Math.round((current - previous) * 10) / 10;
}

function sourceLabel(value: string) {
  if (!value) return "Bilinmiyor";
  return SOURCE_LABELS[value] ?? value.charAt(0).toLocaleUpperCase("tr-TR") + value.slice(1);
}

function mediumLabel(value: string) {
  if (!value || value === "none") return "—";
  return MEDIUM_LABELS[value] ?? value;
}

function Delta({ value, unit = "percent" }: { value: number | null; unit?: "percent" | "points" }) {
  if (value === null) {
    return <span className="text-muted-foreground" title="Önceki dönemde veri yok">—</span>;
  }
  if (value === 0) return <span className="text-muted-foreground">Değişim yok</span>;
  const Icon = value > 0 ? ArrowUpIcon : ArrowDownIcon;
  return (
    <span className={`inline-flex items-center gap-0.5 font-medium ${value > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
      <Icon aria-hidden="true" className="size-3" />
      {unit === "points" ? `${formatNumber(Math.abs(value))} puan` : `%${formatNumber(Math.abs(value))}`}
    </span>
  );
}

function MetricCard({
  title,
  value,
  note,
  icon: Icon,
  delta,
  deltaUnit = "percent",
  href,
  accent = "",
}: {
  title: string;
  value: string;
  note: string;
  icon: IconComponent;
  delta?: number | null;
  deltaUnit?: "percent" | "points";
  href?: string;
  accent?: string;
}) {
  const content = (
    <Card className={`h-full rounded-xl p-4 transition-colors hover:border-foreground/20 ${accent}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      </div>
      <p className="mt-3 truncate text-xl font-semibold tabular-nums tracking-tight text-foreground sm:text-2xl">{value}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
        {delta !== undefined && <Delta value={delta} unit={deltaUnit} />}
        <span className="text-muted-foreground">{note}</span>
      </div>
    </Card>
  );
  return href ? <Link href={href} className="block h-full cursor-pointer">{content}</Link> : content;
}

function SectionCard({
  title,
  description,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={`overflow-hidden rounded-xl ${className}`}>
      <div className="border-b border-border bg-muted/20 px-5 py-3.5">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </Card>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return <p className="grid min-h-40 place-items-center px-4 py-8 text-center text-sm text-muted-foreground">{text}</p>;
}

function MiniStat({ label, value, note, href }: { label: string; value: string; note?: string; href?: string }) {
  const content = (
    <>
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-base font-semibold tabular-nums text-foreground">{value}</p>
      {note && <p className="mt-0.5 text-[11px] text-muted-foreground">{note}</p>}
    </>
  );
  return href ? (
    <Link href={href} className="block rounded-lg bg-muted/40 p-3 transition-colors hover:bg-muted/60">
      {content}
    </Link>
  ) : (
    <div className="rounded-lg bg-muted/40 p-3">{content}</div>
  );
}

const PERIODS: Array<{ value: 7 | 30 | 90; label: string }> = [
  { value: 7, label: "7 gün" },
  { value: 30, label: "30 gün" },
  { value: 90, label: "90 gün" },
];

function PeriodSelector({
  days,
  onChange,
  loading,
  onRefresh,
}: {
  days: 7 | 30 | 90;
  onChange: (days: 7 | 30 | 90) => void;
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center rounded-lg border border-border bg-card p-0.5" role="group" aria-label="Analitik dönemi">
        {PERIODS.map((period) => (
          <button
            key={period.value}
            type="button"
            onClick={() => onChange(period.value)}
            aria-pressed={days === period.value}
            aria-label={`Son ${period.value} gün`}
            className={`rounded-md px-2 py-1.5 text-[11px] font-semibold transition-colors sm:px-2.5 sm:text-xs ${
              days === period.value
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {period.label}
          </button>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={onRefresh}
        disabled={loading}
        aria-label="Verileri yenile"
        title="Verileri yenile"
        className="size-9 shrink-0"
      >
        <ArrowPathIcon aria-hidden="true" className={loading ? "motion-safe:animate-spin" : ""} />
      </Button>
    </div>
  );
}

export function AnalyticsPage() {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const { data, error, loading, refresh } = useAdminResource<AnalyticsDashboard>("analytics", { days: String(days) });

  return (
    <>
      <AdminHeaderAction route={adminPath("analytics")}>
        <PeriodSelector
          days={days}
          onChange={(value) => setDays(value)}
          loading={loading}
          onRefresh={() => void refresh()}
        />
      </AdminHeaderAction>

      <div className="space-y-6">
        {error && <AdminNotice kind="error">{error}</AdminNotice>}
        {loading && !data ? (
          <AdminLoading label="E-ticaret analitiği" variant="analytics-content" />
        ) : data ? (
          <AnalyticsContent data={data} />
        ) : (
          <AdminEmpty title="Analitik yüklenemedi" description="Yönetici bağlantısını kontrol edip sayfayı yenileyebilirsin." />
        )}
      </div>
    </>
  );
}

function AnalyticsContent({ data }: { data: AnalyticsDashboard }) {
  const { summary, previous } = data;
  const overallFunnelRate = data.funnel[0]?.sessions
    ? (data.funnel[data.funnel.length - 1].sessions / data.funnel[0].sessions) * 100
    : 0;
  const statusTotal = data.statuses.reduce((sum, status) => sum + status.count, 0);
  const maxProductRevenue = Math.max(...data.products.map((product) => product.revenueCents), 1);
  const maxCategoryRevenue = Math.max(...data.categories.map((category) => category.revenueCents), 1);
  const orderTotal = summary.orderCount + summary.cancelledOrders;
  const limitedSources: string[] = [];
  if (data.coverage.sessionsLimited) limitedSources.push("oturumlar");
  if (data.coverage.ordersLimited) limitedSources.push("siparişler");
  if (data.coverage.catalogLimited) limitedSources.push("ürün eşleşmeleri");

  return (
    <div className="space-y-6">
      <section aria-label="Dönem göstergeleri">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
          <MetricCard
            title="Ciro"
            value={formatMoney(summary.revenueCents / 100)}
            note={`${formatNumber(summary.paidOrders)} ödenen sipariş`}
            icon={BanknotesIcon}
            delta={change(summary.revenueCents, previous.revenueCents)}
          />
          <MetricCard
            title="Sipariş"
            value={formatNumber(summary.orderCount)}
            note={summary.cancelledOrders > 0 ? `${formatNumber(summary.cancelledOrders)} iptal` : "İptaller hariç"}
            icon={ShoppingBagIcon}
            delta={change(summary.orderCount, previous.orderCount)}
          />
          <MetricCard
            title="Ortalama Sepet"
            value={formatMoney(summary.averageOrderValueCents / 100)}
            note={`${formatNumber(summary.orderCount)} sipariş üzerinden`}
            icon={ReceiptPercentIcon}
            delta={change(summary.averageOrderValueCents, previous.averageOrderValueCents)}
          />
          <MetricCard
            title="Ziyaretçi"
            value={formatNumber(summary.uniqueVisitors)}
            note={`${formatNumber(summary.sessions)} oturum · ${formatNumber(summary.averagePageViews)} sayfa/oturum`}
            icon={UsersIcon}
            delta={change(summary.uniqueVisitors, previous.uniqueVisitors)}
          />
          <MetricCard
            title="Dönüşüm"
            value={formatPercent(summary.conversionRate)}
            note={`${formatNumber(summary.orderCount)} sipariş / ${formatNumber(summary.uniqueVisitors)} ziyaretçi`}
            icon={CursorArrowRaysIcon}
            delta={pointsChange(summary.conversionRate, previous.conversionRate)}
            deltaUnit="points"
          />
          <MetricCard
            title="Tahsilat Bekleyen"
            value={formatMoney(summary.pendingValueCents / 100)}
            note={summary.pendingOrders > 0 ? `${formatNumber(summary.pendingOrders)} sipariş` : "Bekleyen ödeme yok"}
            icon={ClockIcon}
            href={adminPath("orders")}
            accent={summary.pendingValueCents > 0 ? "border-amber-500/30 bg-amber-500/5" : ""}
          />
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Karşılaştırmalar bir önceki eşit döneme göredir. Ciro yalnızca ödemesi alınmış ve iptal edilmemiş siparişleri kapsar.
        </p>
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <AnalyticsTrendChart key={data.days} data={data} className="xl:col-span-2" />
        <SectionCard title="Dönüşüm Hunisi" description="Oturumdan siparişe">
          {summary.sessions === 0 ? (
            <EmptyPanel text="Bu dönemde oturum verisi yok. Mağaza ziyaretleri geldiğinde huni oluşur." />
          ) : (
            <div className="space-y-3.5 p-4 sm:p-5">
              {data.funnel.map((step, index) => {
                const share = (step.sessions / summary.sessions) * 100;
                return (
                  <div key={step.key}>
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="font-medium text-foreground">{step.label}</span>
                      <span className="tabular-nums text-muted-foreground">{formatNumber(step.sessions)}</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                      <div
                        className={`h-full rounded-full ${index === data.funnel.length - 1 ? "bg-emerald-500" : "bg-foreground/70"}`}
                        style={{ width: `${Math.max(step.sessions > 0 ? 1 : 0, share)}%` }}
                      />
                    </div>
                    {index > 0 && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Önceki adıma göre <span className="font-medium text-foreground">{formatPercent(step.conversionFromPrevious)}</span>
                        {step.dropOffFromPrevious > 0 ? ` · ${formatNumber(step.dropOffFromPrevious)}% kayıp` : ""}
                      </p>
                    )}
                  </div>
                );
              })}
              <div className="flex items-center justify-between border-t border-border pt-3 text-xs">
                <span className="text-muted-foreground">Oturum → sipariş</span>
                <span className="font-semibold text-foreground">{formatPercent(overallFunnelRate)}</span>
              </div>
              {data.coverage.unattributedOrders > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  {formatNumber(data.coverage.unattributedOrders)} sipariş analitik oturumuyla eşleşmedi; huni ve kanal dönüşümleri eksik olabilir.
                </p>
              )}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard className="xl:col-span-2" title="Kanal Performansı" description="Oturum, satın alma ve atfedilen ciro">
          {data.channels.length === 0 ? (
            <EmptyPanel text="Bu dönemde kanal verisi yok." />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <caption className="sr-only">Kanal performansı</caption>
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-4 py-2.5 font-medium">Kaynak</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">Trafik türü</th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium">Oturum</th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium">Satın Alma</th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium">Dönüşüm</th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium">Atfedilen Ciro</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.channels.map((channel) => (
                      <tr key={`${channel.source}:${channel.medium}`} className="transition-colors hover:bg-muted/30">
                        <td className="px-4 py-2.5 font-medium text-foreground">{sourceLabel(channel.source)}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{mediumLabel(channel.medium)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-foreground">{formatNumber(channel.sessions)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-foreground">{formatNumber(channel.paidOrders)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-foreground">{formatPercent(channel.conversionRate)}</td>
                        <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-foreground">{formatMoney(channel.revenueCents / 100)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
                Oturumlar analitik oturumlarından; satın alma ve ciro, son tıklama atıflama kayıtlarından gelir ve silinmiş siparişleri de içerebilir.
              </p>
            </>
          )}
        </SectionCard>

        <SectionCard title="Sipariş ve Tahsilat" description="Dönem içinde oluşturulan siparişler">
          {orderTotal === 0 ? (
            <EmptyPanel text="Bu dönemde sipariş yok." />
          ) : (
            <div className="space-y-5 p-4 sm:p-5">
              <div>
                <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Durum</h3>
                <div className="mt-2 space-y-2">
                  {data.statuses.map((status) => (
                    <div key={status.key}>
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="flex items-center gap-1.5 text-foreground">
                          <span className={`size-2 rounded-full ${STATUS_COLORS[status.key]}`} aria-hidden="true" />
                          {status.label}
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                          {formatNumber(status.count)} · {formatMoney(status.valueCents / 100)}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                        <div
                          className={`h-full rounded-full ${STATUS_COLORS[status.key]}`}
                          style={{ width: `${statusTotal > 0 ? (status.count / statusTotal) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Ödeme durumu</h3>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {data.paymentStatuses.map((status) => (
                    <div key={status.key} className="rounded-lg bg-muted/40 p-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className={`size-2 rounded-full ${PAYMENT_COLORS[status.key]}`} aria-hidden="true" />
                        <span className="text-[11px] text-muted-foreground">{status.label}</span>
                      </div>
                      <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">{formatNumber(status.count)}</p>
                      <p className="text-[10px] tabular-nums text-muted-foreground">{formatMoney(status.valueCents / 100)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Ödeme yöntemi</h3>
                <div className="mt-2 space-y-2">
                  {data.paymentMethods.map((method) => (
                    <div key={method.key} className="flex items-start justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <p className="text-foreground">{method.label}</p>
                        {method.pendingValueCents > 0 && (
                          <p className="text-[10px] text-amber-700 dark:text-amber-400">
                            {formatMoney(method.pendingValueCents / 100)} bekliyor
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="tabular-nums text-foreground">{formatNumber(method.count)} sipariş</p>
                        <p className="text-[10px] tabular-nums text-muted-foreground">{formatMoney(method.valueCents / 100)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard className="xl:col-span-2" title="En Çok Satan Ürünler" description="Sipariş adedi ve brüt ürün tutarı">
          {data.products.length === 0 ? (
            <EmptyPanel text="Bu dönemde satılan ürün yok." />
          ) : (
            <>
              <div className="divide-y divide-border">
                {data.products.map((product, index) => (
                  <Link
                    key={product.productId}
                    href={adminPath(`products/${product.productId}/edit`)}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30 sm:px-5"
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{product.title}</p>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                        <div
                          className="h-full rounded-full bg-foreground/60"
                          style={{ width: `${(product.revenueCents / maxProductRevenue) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold tabular-nums text-foreground">{formatMoney(product.revenueCents / 100)}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatNumber(product.quantity)} adet · {formatNumber(product.orderCount)} sipariş
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
              <p className="border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground sm:px-5">
                Ürün tutarları sipariş indirimleri ve kargo hariç, brüt sepet değeridir.
              </p>
            </>
          )}
        </SectionCard>

        <SectionCard title="Kategori Performansı" description="Brüt ürün tutarına göre">
          {data.categories.length === 0 ? (
            <EmptyPanel text="Bu dönemde kategori verisi yok." />
          ) : (
            <div className="space-y-3 p-4 sm:p-5">
              {data.categories.map((category) => (
                <div key={category.slug || "uncategorized"}>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate font-medium text-foreground">{category.title}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{formatMoney(category.revenueCents / 100)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                    <div
                      className="h-full rounded-full bg-foreground/60"
                      style={{ width: `${(category.revenueCents / maxCategoryRevenue) * 100}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">{formatNumber(category.quantity)} adet</p>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Müşteriler" description="Dönem müşterileri ve 24 aylık değer">
        <div className="grid xl:grid-cols-2">
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 sm:p-5 xl:grid-cols-2">
            <MiniStat label="Yeni müşteri" value={formatNumber(data.customers.newCustomers)} note={`Önceki dönem: ${formatNumber(previous.newCustomers)}`} />
            <MiniStat label="Geri dönen" value={formatNumber(data.customers.returningCustomers)} />
            <MiniStat label="Tekrar oranı" value={formatPercent(data.customers.repeatRate)} note="24 ayda 2+ sipariş" />
            <MiniStat label="Gözlenen LTV" value={formatMoney(data.customers.ltvCents / 100)} note="Ödeme yapan müşteri başına" />
          </div>
          <div className="flex min-h-40 flex-col border-t border-border xl:border-t-0 xl:border-l">
            <h3 className="px-4 pt-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:px-5">
              Dönemin en yüksek sepetleri
            </h3>
            {data.customers.top.length === 0 ? (
              <p className="flex flex-1 items-center px-4 pb-4 text-xs text-muted-foreground sm:px-5">
                Siparişler geldikçe en yüksek sepetler burada listelenir.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-border">
                {data.customers.top.map((customer) => (
                  <li key={customer.email} className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{customer.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{customer.email}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold tabular-nums text-foreground">{formatMoney(customer.valueCents / 100)}</p>
                      <p className="text-[11px] text-muted-foreground">{formatNumber(customer.orderCount)} sipariş</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Pazarlama ve Sepet" description="Kupon, kampanya ve hatırlatma">
            <div className="space-y-4 p-4 sm:p-5">
              <div className="grid grid-cols-2 gap-3">
                <MiniStat label="Aktif kupon" value={formatNumber(data.marketing.activeCoupons)} href={adminPath("coupons")} />
                <MiniStat label="Aktif kampanya" value={formatNumber(data.marketing.activePromotions)} href={adminPath("promotions")} />
                <MiniStat
                  label="Kuponlu sipariş"
                  value={formatNumber(data.marketing.couponOrders)}
                  note={`${formatMoney(data.marketing.couponDiscountCents / 100)} indirim`}
                />
                <MiniStat
                  label="Sepet hatırlatma"
                  value={formatNumber(data.marketing.cartReminders)}
                  note={`${formatNumber(data.marketing.recoveredCarts)} dönüşen`}
                  href={adminPath("carts")}
                />
              </div>
              <div className="flex items-center justify-between border-t border-border pt-3 text-xs">
                <span className="text-muted-foreground">Sepet kurtarma oranı</span>
                <span className="font-semibold text-foreground">{formatPercent(data.marketing.recoveryRate)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Gönderilen hatırlatma e-postası</span>
                <span className="font-semibold text-foreground">{formatNumber(data.marketing.reminderEmails)}</span>
              </div>
              {data.marketing.topCoupons.length > 0 && (
                <div className="border-t border-border pt-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">En çok kullanılan kuponlar</p>
                  <ul className="mt-2 space-y-1.5">
                    {data.marketing.topCoupons.map((coupon) => (
                      <li key={coupon.code} className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate font-mono font-medium text-foreground">{coupon.code}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {formatNumber(coupon.orderCount)} sipariş · {formatMoney(coupon.discountCents / 100)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Müşteri Memnuniyeti" description="Değerlendirme ve sorular">
            {data.satisfaction.feedbackCount === 0 && data.satisfaction.approvedReviews === 0 && data.satisfaction.pendingQuestions === 0 ? (
              <EmptyPanel text="Bu dönemde değerlendirme veya bekleyen soru yok." />
            ) : (
              <div className="space-y-3 p-4 sm:p-5">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-muted-foreground"><StarIcon aria-hidden="true" className="size-3.5" />Mağaza puanı</span>
                  <span className="font-semibold text-foreground">{data.satisfaction.storeRating > 0 ? `${formatNumber(data.satisfaction.storeRating)} / 5` : "—"}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Teslimat puanı</span>
                  <span className="font-semibold text-foreground">{data.satisfaction.deliveryRating > 0 ? `${formatNumber(data.satisfaction.deliveryRating)} / 5` : "—"}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Onaylı yorum</span>
                  <span className="font-semibold text-foreground">
                    {formatNumber(data.satisfaction.approvedReviews)}
                    {data.satisfaction.averageReviewRating > 0 ? ` · ${formatNumber(data.satisfaction.averageReviewRating)} / 5` : ""}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-3 text-xs">
                  <span className="text-muted-foreground">Yanıt bekleyen soru</span>
                  {data.satisfaction.pendingQuestions > 0 ? (
                    <Link href={adminPath("questions")} className="font-semibold text-foreground underline-offset-4 hover:underline">
                      {formatNumber(data.satisfaction.pendingQuestions)} →
                    </Link>
                  ) : (
                    <span className="font-semibold text-foreground">0</span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">{formatNumber(data.satisfaction.feedbackCount)} alışveriş değerlendirmesi</p>
              </div>
            )}
        </SectionCard>
      </div>

      <SectionCard title="Müşteri Tutma" description="İlk sipariş ayına göre 12 aylık aktiflik">
        {data.cohorts.length === 0 ? (
          <EmptyPanel text="Kohort oluşturmak için sipariş gerekir." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[840px] text-center text-xs">
                <caption className="sr-only">Müşteri tutma oranları</caption>
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th scope="col" className="sticky left-0 z-10 bg-muted/40 px-3 py-2.5 text-left font-medium">Kohort</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">Müşteri</th>
                    {Array.from({ length: 12 }, (_, age) => (
                      <th key={age} scope="col" className="px-2 py-2.5 font-medium">{age}. ay</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.cohorts.map((cohort) => (
                    <tr key={cohort.month}>
                      <th scope="row" className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-medium text-foreground">{cohort.label}</th>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{formatNumber(cohort.customers)}</td>
                      {Array.from({ length: 12 }, (_, age) => {
                        const cell = cohort.cells.find((item) => item.age === age);
                        if (!cell) return <td key={age} className="px-1.5 py-1.5 text-muted-foreground">—</td>;
                        const intensity = Math.max(0, Math.min(100, cell.retentionPercent));
                        return (
                          <td key={age} className="px-1.5 py-1.5">
                            <span
                              className="inline-flex min-w-12 items-center justify-center rounded-md px-2 py-1 font-semibold tabular-nums"
                              style={{
                                backgroundColor: `color-mix(in srgb, var(--primary) ${intensity}%, transparent)`,
                                color: intensity >= 50 ? "var(--primary-foreground)" : "var(--foreground)",
                              }}
                            >
                              {formatPercent(cell.retentionPercent)}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-2 border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground sm:px-5">
              <span>Düşük</span>
              <span className="h-2 w-24 rounded-full" style={{ background: "linear-gradient(to right, transparent, var(--primary))" }} aria-hidden="true" />
              <span>Yüksek</span>
              <span className="ml-auto">İptal edilmeyen siparişler esas alınır.</span>
            </div>
          </>
        )}
      </SectionCard>

      {limitedSources.length > 0 && (
        <AdminNotice kind="info">
          Yoğun veri nedeniyle {limitedSources.join(", ")} son kayıtlarla sınırlandırıldı; toplamlar yaklaşıktır.
        </AdminNotice>
      )}
    </div>
  );
}
