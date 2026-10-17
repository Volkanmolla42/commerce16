"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { Button, Card, Dialog, DialogContent, DialogHeader, DialogTitle, Input, Label } from "@/components/ui";
import { AdminEmpty, AdminLoading, AdminNotice } from "../_components/admin-primitives";
import { OrderStatusBadge, OrderPaymentStatusBadge } from "@/components/orders/order-badges";
import { CsvExportButton } from "../_components/export-button";
import { useAdminResource } from "../_components/admin-api";
import { adminPath } from "@/lib/admin/routes";
import { formatMoney } from "@/lib/format-money";
import { formatOrderCode, type OrderStatus, type OrderPaymentStatus } from "@/lib/orders";
import { formatDate, formatDateTime } from "@/lib/format-date";

type Customer = {
  key: string;
  userId?: string;
  name: string;
  email: string;
  phone: string;
  registeredAt?: number;
  firstOrderAt?: number;
  lastOrderAt?: number;
  orderCount: number;
  totalSpent: string;
  addressCount: number;
};

type CustomersPage = {
  page: Customer[];
  continueCursor: string;
  isDone: boolean;
  totalCount: number;
};

type CustomerAddress = {
  _id: string;
  title: string;
  fullName: string;
  phone: string;
  city: string;
  district: string;
  addressLine1: string;
  isDefault: boolean;
};

type CustomerOrder = {
  _id: string;
  _creationTime: number;
  status: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  total: string;
  itemCount: number;
};

type CustomerDetail = {
  name: string;
  email: string;
  phone: string;
  image?: string;
  registeredAt?: number;
  firstOrderAt?: number;
  lastOrderAt?: number;
  orderCount: number;
  totalSpent: string;
  addresses: CustomerAddress[];
  orders: CustomerOrder[];
};

const LIST_COLUMNS = "lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_90px_130px_90px]";

function customerLabel(customer: { name: string; email: string }) {
  return customer.name || customer.email || "İsimsiz müşteri";
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function CustomerDetailsDialog({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const { data, error, loading } = useAdminResource<CustomerDetail>("customer", {
    userId: customer.userId ?? "",
    email: customer.email,
  });

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[92dvh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle className="truncate">{customerLabel(customer)}</DialogTitle>
            {customer.userId ? (
              <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">Kayıtlı Müşteri</span>
            ) : (
              <span className="rounded bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">Misafir</span>
            )}
          </div>
        </DialogHeader>

        {loading && !data ? (
          <AdminLoading label="Müşteri" variant="form-content" />
        ) : error || !data ? (
          <AdminNotice kind="error">{error || "Müşteri bilgileri yüklenemedi."}</AdminNotice>
        ) : (
          <div className="space-y-6">
            <section className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">İletişim</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {data.email ? (
                  <a
                    href={`mailto:${data.email}`}
                    className="flex items-center justify-between rounded-lg border border-border bg-card p-3 text-sm transition-colors hover:bg-muted/40"
                  >
                    <span className="truncate text-foreground">{data.email}</span>
                    <span className="shrink-0 text-xs text-primary font-medium">E-posta Gönder</span>
                  </a>
                ) : null}
                {data.phone ? (
                  <a
                    href={`tel:${data.phone}`}
                    className="flex items-center justify-between rounded-lg border border-border bg-card p-3 text-sm transition-colors hover:bg-muted/40"
                  >
                    <span className="truncate text-foreground">{data.phone}</span>
                    <span className="shrink-0 text-xs text-primary font-medium">Ara</span>
                  </a>
                ) : null}
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Genel Bakış</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <SummaryTile label="Sipariş Sayısı" value={String(data.orderCount)} />
                <SummaryTile label="Toplam Harcama" value={formatMoney(data.totalSpent)} />
                <SummaryTile label={data.registeredAt ? "Kayıt Tarihi" : "İlk Sipariş"} value={formatDate(data.registeredAt ?? data.firstOrderAt)} />
                <SummaryTile label="Son Sipariş" value={formatDate(data.lastOrderAt)} />
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Kayıtlı Adresler ({data.addresses.length})</h3>
              {data.addresses.length === 0 ? (
                <p className="rounded-lg border border-border bg-card p-4 text-center text-sm text-muted-foreground">Kayıtlı adres bulunmuyor.</p>
              ) : (
                <div className="divide-y divide-border rounded-lg border border-border bg-card">
                  {data.addresses.map((address) => (
                    <div key={address._id} className="space-y-1.5 p-4 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-foreground">{address.title}</span>
                        {address.isDefault ? <span className="rounded bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">Varsayılan</span> : null}
                      </div>
                      <p className="text-muted-foreground">{address.fullName} · {address.phone}</p>
                      <p className="leading-relaxed text-foreground">{address.addressLine1}, {address.district} / {address.city}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Sipariş Geçmişi ({data.orders.length})</h3>
              {data.orders.length === 0 ? (
                <p className="rounded-lg border border-border bg-card p-4 text-center text-sm text-muted-foreground">Henüz verilmiş bir sipariş bulunmuyor.</p>
              ) : (
                <div className="divide-y divide-border rounded-lg border border-border bg-card overflow-hidden">
                  {data.orders.map((order) => (
                    <Link
                      key={order._id}
                      href={`${adminPath("orders")}?order=${encodeURIComponent(order._id)}`}
                      className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-muted/40"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-xs font-bold text-foreground">{formatOrderCode(order._id, true)}</p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {formatDateTime(order._creationTime)} · {order.itemCount} adet ürün
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2.5">
                        <OrderStatusBadge status={order.status} />
                        <OrderPaymentStatusBadge
                          status={order.paymentStatus}
                          className="text-[10px] px-1.5 py-0.5"
                        />
                        <span className="text-sm font-semibold tabular-nums text-foreground">{formatMoney(order.total)}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function AdminCustomersPage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [cursors, setCursors] = useState<Array<string | null>>([null]);
  const [selected, setSelected] = useState<Customer | null>(null);
  const cursor = cursors[cursors.length - 1] ?? "";

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
      setCursors([null]);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const { data, error, loading } = useAdminResource<CustomersPage>("customers", { q: debouncedQuery, cursor });
  const pending = loading || debouncedQuery !== query.trim();
  const customers = data?.page ?? [];

  return (
    <>
      {error && <div className="mb-4"><AdminNotice kind="error">{error}</AdminNotice></div>}

      <Card className="overflow-hidden rounded-lg">
        <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5">
          <div className="relative min-w-0">
            <Label htmlFor="customer-search" className="sr-only">Müşteri ara</Label>
            <MagnifyingGlassIcon aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="customer-search" name="customer-search" type="search" placeholder="Ad, e-posta veya telefon ara" value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" />
          </div>
          <div className="flex items-center justify-between gap-3 sm:justify-end">
            {data ? <p className="text-sm text-muted-foreground">{data.totalCount} müşteri</p> : null}
            <CsvExportButton type="customers" label="Müşterileri CSV olarak indir" />
          </div>
        </div>

        {loading && !data ? <AdminLoading label="Müşteriler" variant="table" /> : customers.length === 0 ? (
          <div className="p-5">
            <AdminEmpty
              title={query ? "Eşleşen müşteri yok" : "Henüz müşteri yok"}
              description={query ? "Arama terimini değiştirip yeniden dene." : "Kayıt olan ve sipariş veren müşteriler burada listelenir."}
            />
          </div>
        ) : (
          <div className="divide-y divide-border" aria-busy={pending}>
            <div className={`hidden gap-4 bg-muted/40 px-4 py-2.5 text-xs font-medium text-muted-foreground sm:px-5 lg:grid lg:items-center ${LIST_COLUMNS}`}>
              <span>Müşteri</span>
              <span>Kayıt / Son sipariş</span>
              <span>Sipariş</span>
              <span>Toplam</span>
              <span className="text-right">İşlem</span>
            </div>
            {customers.map((customer) => (
              <article key={customer.key} className={`grid gap-4 px-4 py-4 sm:px-5 lg:items-center hover:bg-muted/30 transition-colors ${LIST_COLUMNS}`}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">{customerLabel(customer)}</p>
                    {!customer.userId ? <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">Misafir</span> : null}
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{customer.email || "E-posta yok"}</p>
                  {customer.phone ? <p className="truncate text-xs text-muted-foreground">{customer.phone}</p> : null}
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p><span className="mr-2 font-medium lg:hidden">Kayıt:</span>{formatDate(customer.registeredAt ?? customer.firstOrderAt)}</p>
                  <p><span className="mr-2 font-medium lg:hidden">Son Sipariş:</span>{formatDate(customer.lastOrderAt)}</p>
                </div>
                <p className="text-sm text-foreground"><span className="mr-2 font-medium text-muted-foreground lg:hidden">Sipariş:</span>{customer.orderCount}</p>
                <p className="text-sm font-semibold tabular-nums text-foreground">{formatMoney(customer.totalSpent)}</p>
                <Button variant="outline" size="sm" className="min-h-9 lg:justify-self-end" onClick={() => setSelected(customer)}>Detay</Button>
              </article>
            ))}
          </div>
        )}
      </Card>

      {data && (cursors.length > 1 || !data.isDone) && (
        <nav aria-label="Müşteri sayfaları" className="mt-4 flex items-center justify-between gap-3">
          <Button variant="outline" disabled={pending || cursors.length <= 1} onClick={() => setCursors((current) => current.slice(0, -1))}>Önceki</Button>
          <span className="text-sm text-muted-foreground">Sayfa {cursors.length}</span>
          <Button variant="outline" disabled={pending || data.isDone} onClick={() => setCursors((current) => [...current, data.continueCursor])}>Sonraki</Button>
        </nav>
      )}

      {selected && <CustomerDetailsDialog customer={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
