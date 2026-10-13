"use client";

import { Suspense, useState } from "react";
import { AdminEmpty, AdminLoading, AdminNotice } from "../_components/admin-primitives";
import { useAdminResource } from "../_components/admin-api";
import { AnalyticsDashboard } from "@/lib/analytics/types";
import { Card } from "@/components/ui";
import { formatMoney } from "@/lib/format-money";

function formatNumber(value: number) {
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 }).format(value);
}

function Metric({ title, value, note }: { title: string; value: string; note: string }) {
  return (
    <Card className="min-w-0 rounded-lg p-4 transition-colors hover:border-primary/30 sm:p-5">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <p className="mt-2 truncate text-xl font-bold tabular-nums text-foreground sm:text-2xl">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
    </Card>
  );
}

export function AnalyticsPage() {
  const [days, setDays] = useState<7 | 30 | 90>(30);

  const periods: Array<{ label: string; value: 7 | 30 | 90 }> = [
    { label: "Son 7 Gün", value: 7 },
    { label: "Son 30 Gün", value: 30 },
    { label: "Son 90 Gün", value: 90 },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-foreground">Mağaza Performansı</h1>
        <div className="flex items-center rounded-lg border border-border bg-card p-1">
          {periods.map((period) => (
            <button
              key={period.value}
              type="button"
              onClick={() => setDays(period.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                days === period.value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>
      <Suspense fallback={<AdminLoading label="E-ticaret analitiği" variant="analytics-content" />}>
        <AnalyticsContent days={days} />
      </Suspense>
    </div>
  );
}

function AnalyticsContent({ days }: { days: 7 | 30 | 90 }) {
  const { data, error, loading } = useAdminResource<AnalyticsDashboard>("analytics", { days: String(days) });

  return (
    <div className="space-y-5">
      {error && <AdminNotice kind="error">{error}</AdminNotice>}
      {loading && !data ? <AdminLoading label="E-ticaret analitiği" variant="analytics-content" /> : data ? (
        <>
          <section aria-label="Satış ve müşteri ölçümleri" className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-5">
            <Metric title="Ziyaretçiler" value={formatNumber(data.summary.uniqueVisitors)} note={`${formatNumber(data.summary.sessions)} oturum`} />
            <Metric title="Toplam Ciro" value={formatMoney(data.summary.revenueCents / 100)} note={`${data.summary.paidOrders} sipariş`} />
            <Metric title="Ortalama Sepet Tutarı" value={formatMoney(data.summary.averageOrderValueCents / 100)} note="Tamamlanan siparişler" />
            <Metric title="Müşteri Değeri (LTV)" value={formatMoney(data.summary.observedLtvCents / 100)} note="Müşteri başı ortalama" />
            <Metric title="Tekrar Satın Alma" value={`%${formatNumber(data.summary.repeatCustomerRate)}`} note="Çoklu sipariş verenler" />
          </section>

          <section className="mt-5">
            <Card className="overflow-hidden rounded-lg">
              <div className="border-b border-border px-4 py-3.5 sm:px-5">
                <h2 className="text-sm font-semibold text-foreground">Dönüşüm Hunisi</h2>
              </div>
              <div className="space-y-4 p-4 sm:p-5">
                {data.funnel.map((step, index) => (
                  <div key={step.key}>
                    <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
                      <span className="font-medium text-foreground">{step.label}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatNumber(step.sessions)} oturum
                        {index > 0 && <span className="ml-2 text-xs font-medium text-foreground">%{formatNumber(step.conversionFromPrevious)} dönüşüm</span>}
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                      <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${data.summary.sessions ? Math.max(1, step.sessions / data.summary.sessions * 100) : 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </section>

          <Card className="mt-5 overflow-hidden rounded-lg">
            <div className="border-b border-border px-4 py-3.5 sm:px-5">
              <h2 className="text-sm font-semibold text-foreground">Kanal ve Kampanya Performansı</h2>
            </div>
            {data.channels.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">Seçili dönemde ilişkilendirilmiş kanal verisi bulunmuyor.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-left text-sm">
                  <thead className="bg-muted/40 text-xs font-medium text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Kanal</th>
                      <th className="px-4 py-3 font-medium">Kampanya</th>
                      <th className="px-4 py-3 text-right font-medium">Yeni Müşteri</th>
                      <th className="px-4 py-3 text-right font-medium">Ciro</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.channels.map((channel) => (
                      <tr key={`${channel.source}:${channel.campaign}`} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">{channel.source}</td>
                        <td className="px-4 py-3 text-muted-foreground">{channel.campaign || "Doğrudan / Kampanyasız"}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-foreground">{channel.newCustomers}</td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">{formatMoney(channel.attributedRevenueCents / 100)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="mt-5 overflow-hidden rounded-lg">
            <div className="border-b border-border px-4 py-3.5 sm:px-5">
              <h2 className="text-sm font-semibold text-foreground">Müşteri Tutma Oranları (Kohortlar)</h2>
            </div>
            {data.cohorts.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">Son 24 ayda tamamlanmış kohort verisi bulunmuyor.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-center text-xs">
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="sticky left-0 bg-muted/40 px-3 py-3 text-left font-medium">Başlangıç Ayı</th>
                      <th className="px-3 py-3 text-right font-medium">Müşteri</th>
                      {Array.from({ length: 12 }, (_, age) => <th key={age} className="px-3 py-3 font-medium">{age}. Ay</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.cohorts.map((cohort) => (
                      <tr key={cohort.month} className="hover:bg-muted/30 transition-colors">
                        <th className="sticky left-0 bg-card px-3 py-3 text-left font-medium text-foreground">{cohort.month}</th>
                        <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{cohort.customers}</td>
                        {Array.from({ length: 12 }, (_, age) => {
                          const cell = cohort.cells.find((item) => item.age === age);
                          return (
                            <td key={age} className="px-2 py-2 tabular-nums text-foreground">
                              {cell ? <span className="inline-block min-w-12 rounded px-2 py-1 font-semibold" style={{ backgroundColor: `color-mix(in srgb, var(--primary) ${cell.retentionPercent}%, transparent)` }}>%{formatNumber(cell.retentionPercent)}</span> : <span className="text-muted-foreground">—</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {(data.coverage.funnelLimited || data.coverage.purchaseLimited || data.coverage.orderHistoryLimited) && (
            <div className="mt-4">
              <AdminNotice kind="info">Yoğun trafik sebebiyle veriler örnekleme yapılarak hesaplanmıştır.</AdminNotice>
            </div>
          )}
        </>
      ) : (
        <AdminEmpty title="Analitik yüklenemedi" description="Yönetici bağlantısını kontrol edip yeniden deneyebilirsin." />
      )}
    </div>
  );
}
