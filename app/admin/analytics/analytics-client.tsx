"use client";

import { useState } from "react";
import { AdminEmpty, AdminLoading, AdminNotice, AdminPageHeader } from "../_components/admin-primitives";
import { useAdminResource } from "../_components/admin-api";
import { AnalyticsDashboard } from "@/lib/analytics/types";
import { Card } from "@/components/ui";
import { formatMoney } from "@/lib/format-money";

function formatNumber(value: number) {
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 }).format(value);
}

function Metric({ title, value, note }: { title: string; value: string; note: string }) {
  return (
    <Card className="min-w-0 rounded-lg p-4 sm:p-5">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <p className="mt-2 truncate text-xl font-semibold tabular-nums text-foreground sm:text-2xl">{value}</p>
      <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{note}</p>
    </Card>
  );
}

export function AnalyticsContent() {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const { data, error, loading } = useAdminResource<AnalyticsDashboard>("analytics", { days: String(days) });

  if (loading && !data) return <AdminLoading label="E-ticaret analitiği" variant="analytics" />;

  return (
    <>
      <AdminPageHeader
        title="E-ticaret analitiği"
        description="Satın alma hunisi, müşteri değeri ve kampanya performansı."
        actions={<label className="flex items-center gap-2 text-sm font-medium text-foreground">
          Dönem
          <select
            value={days}
            onChange={(event) => setDays(Number(event.target.value) as 7 | 30 | 90)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          >
            <option value={7}>Son 7 gün</option>
            <option value={30}>Son 30 gün</option>
            <option value={90}>Son 90 gün</option>
          </select>
        </label>}
      />

      {error && <div className="mb-4"><AdminNotice kind="error">{error}</AdminNotice></div>}
      {data ? (
        <>
          <section aria-label="Satış ve müşteri ölçümleri" className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-5">
            <Metric title="Tekil ziyaretçi" value={formatNumber(data.summary.uniqueVisitors)} note={`${formatNumber(data.summary.sessions)} izinli oturum`} />
            <Metric title="Ciro" value={formatMoney(data.summary.revenueCents / 100)} note={`${data.summary.paidOrders} tamamlanan sipariş`} />
            <Metric title="Ortalama sepet" value={formatMoney(data.summary.averageOrderValueCents / 100)} note="Seçili dönemdeki tamamlanan siparişler" />
            <Metric title="Gözlenen LTV" value={formatMoney(data.summary.observedLtvCents / 100)} note="Son 24 ayda müşteri başına gerçekleşen ciro" />
            <Metric title="Tekrar satın alma" value={`%${formatNumber(data.summary.repeatCustomerRate)}`} note="Son 24 ayda 2+ sipariş veren müşteriler" />
          </section>

          <section className="mt-5">
            <Card className="overflow-hidden rounded-lg">
              <div className="border-b border-border px-4 py-4 sm:px-5">
                <h2 className="text-sm font-semibold text-foreground">Dönüşüm hunisi</h2>
                <p className="mt-1 text-xs text-muted-foreground">İzinli oturumlarda her adıma ulaşan benzersiz oturum.</p>
              </div>
              <div className="space-y-4 p-4 sm:p-5">
                {data.funnel.map((step, index) => (
                  <div key={step.key}>
                    <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
                      <span className="font-medium text-foreground">{step.label}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatNumber(step.sessions)}
                        {index > 0 && <span className="ml-2 text-xs">{formatNumber(step.conversionFromPrevious)}% dönüşüm · {formatNumber(step.dropOffFromPrevious)}% kayıp</span>}
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

          <Card className="mt-4 overflow-hidden rounded-lg">
            <div className="border-b border-border px-4 py-4 sm:px-5">
              <h2 className="text-sm font-semibold text-foreground">Kanal ve kampanya performansı</h2>
              <p className="mt-1 text-xs text-muted-foreground">Yeni müşteri, ölçülebilen ilk tamamlanmış sipariş ve izni bulunan oturumla eşleştirilir.</p>
            </div>
            {data.channels.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">Bu dönem için ilişkilendirilmiş satın alma yok.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-left text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Kanal</th>
                      <th className="px-4 py-3 font-medium">Kampanya</th>
                      <th className="px-4 py-3 text-right font-medium">Yeni müşteri</th>
                      <th className="px-4 py-3 text-right font-medium">İlişkilendirilmiş ciro</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.channels.map((channel) => (
                      <tr key={`${channel.source}:${channel.campaign}`}>
                        <td className="px-4 py-3 font-medium text-foreground">{channel.source}</td>
                        <td className="px-4 py-3 text-muted-foreground">{channel.campaign || "Kampanyasız"}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-foreground">{channel.newCustomers}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-foreground">{formatMoney(channel.attributedRevenueCents / 100)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="mt-4 overflow-hidden rounded-lg">
            <div className="border-b border-border px-4 py-4 sm:px-5">
              <h2 className="text-sm font-semibold text-foreground">Müşteri kohortları</h2>
              <p className="mt-1 text-xs text-muted-foreground">İlk gözlenen sipariş ayına göre sonraki aylarda tekrar sipariş veren müşteri oranı.</p>
            </div>
            {data.cohorts.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">Kohort tablosu için son 24 ayda tamamlanmış sipariş bulunamadı.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-center text-xs">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="sticky left-0 bg-muted/50 px-3 py-3 text-left font-medium">Kohort</th>
                      <th className="px-3 py-3 text-right font-medium">Müşteri</th>
                      {Array.from({ length: 12 }, (_, age) => <th key={age} className="px-3 py-3 font-medium">Ay {age}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.cohorts.map((cohort) => (
                      <tr key={cohort.month}>
                        <th className="sticky left-0 bg-card px-3 py-3 text-left font-medium text-foreground">{cohort.month}</th>
                        <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{cohort.customers}</td>
                        {Array.from({ length: 12 }, (_, age) => {
                          const cell = cohort.cells.find((item) => item.age === age);
                          return (
                            <td key={age} className="px-2 py-2 tabular-nums text-foreground">
                              {cell ? <span className="inline-block min-w-12 rounded px-2 py-1" style={{ backgroundColor: `color-mix(in srgb, var(--primary) ${cell.retentionPercent}%, transparent)` }}>{formatNumber(cell.retentionPercent)}%</span> : <span className="text-muted-foreground">—</span>}
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

          <div className="mt-4 space-y-2">
            <AdminNotice>
              Funnel ölçümü yalnızca analitik izni veren ziyaretçilerden başlar. LTV ve kohortlar son 24 aydaki tamamlanmış siparişlere dayanır; geçmiş trafik için geriye dönük veri oluşturulmaz.
            </AdminNotice>
            {(data.coverage.funnelLimited || data.coverage.purchaseLimited || data.coverage.orderHistoryLimited) && (
              <AdminNotice kind="info">Bu görünüm bir sorgu sınırına ulaştı; yoğun trafikte sonuçlar örneklenmiş olabilir.</AdminNotice>
            )}
            {loading && <p role="status" className="text-xs text-muted-foreground">Ölçümler yükleniyor…</p>}
          </div>
        </>
      ) : (
        <AdminEmpty title="Analitik yüklenemedi" description="Yönetici bağlantısını kontrol edip yeniden deneyebilirsin." />
      )}
    </>
  );
}
