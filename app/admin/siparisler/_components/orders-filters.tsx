"use client";

import {
  CalendarDaysIcon,
  CreditCardIcon,
  ListBulletIcon,
  ViewColumnsIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { Label } from "@/components/ui/label";
import {
  ORDER_PAYMENT_STATUS_KEYS,
  ORDER_STATUS_KEYS,
  orderPaymentStatusLabels,
  orderStatusLabels,
  type OrderStatus,
} from "@/lib/orders";
import { AdminSearchField } from "../../_components/admin-primitives";
import { ExportMenu } from "../../_components/export-button";
import { dateRangeOptions, type DateRangeFilter } from "./order-admin-shared";

export function OrdersFilters({
  statusFilter,
  onStatusFilterChange,
  counts,
  totalCount,
  query,
  onQueryChange,
  dateFilter,
  onDateFilterChange,
  paymentMethodFilter,
  onPaymentMethodFilterChange,
  paymentStatusFilter,
  onPaymentStatusFilterChange,
  onReset,
  viewMode,
  onViewModeChange,
  resultCount,
}: {
  statusFilter: "all" | OrderStatus;
  onStatusFilterChange: (value: "all" | OrderStatus) => void;
  counts: Record<string, number>;
  totalCount: number;
  query: string;
  onQueryChange: (value: string) => void;
  dateFilter: DateRangeFilter;
  onDateFilterChange: (value: DateRangeFilter) => void;
  paymentMethodFilter: string;
  onPaymentMethodFilterChange: (value: string) => void;
  paymentStatusFilter: string;
  onPaymentStatusFilterChange: (value: string) => void;
  onReset: () => void;
  viewMode: "list" | "kanban";
  onViewModeChange: (value: "list" | "kanban") => void;
  resultCount: number;
}) {
  return (
    <>
      {/* 1. Satır: Durum Sekmeleri & Sipariş Sayısı */}
      <div className="flex items-center justify-between gap-3 border-b border-border p-3 sm:px-5">
        <div className="flex items-center gap-1 overflow-x-auto min-w-0 pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => onStatusFilterChange("all")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 ${statusFilter === "all"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
          >
            <span>Tümü</span>
            <span className="font-mono text-[10px] opacity-80">{totalCount}</span>
          </button>
          {ORDER_STATUS_KEYS.map((status) => {
            const count = counts[status] || 0;
            return (
              <button
                key={status}
                type="button"
                onClick={() => onStatusFilterChange(status)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 ${statusFilter === status
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
              >
                <span>{orderStatusLabels[status]}</span>
                {count > 0 && <span className="font-mono text-[10px] opacity-80">{count}</span>}
              </button>
            );
          })}
        </div>

        <div className="shrink-0">
          <ExportMenu type="orders" />
        </div>
      </div>

      {/* 2. Satır: Filtreler (Sol) & Görünüm Geçişi / CSV İndir (Sağ) */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 sm:px-5 bg-muted/20 border-b border-border">
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-52 sm:w-64">
            <AdminSearchField
              id="order-search"
              label="Sipariş ara"
              placeholder="Sipariş no, müşteri ara..."
              value={query}
              onChange={onQueryChange}
              className="h-9 text-xs"
            />
          </div>

          <div className="relative shrink-0">
            <Label htmlFor="order-date-filter" className="sr-only">
              Tarih Filtresi
            </Label>
            <CalendarDaysIcon
              aria-hidden="true"
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <select
              id="order-date-filter"
              value={dateFilter}
              onChange={(e) => onDateFilterChange(e.target.value as DateRangeFilter)}
              className="h-9 rounded-md border border-input bg-background pl-8 pr-7 text-xs font-medium text-foreground outline-none focus-visible:border-ring cursor-pointer"
            >
              {dateRangeOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="relative shrink-0">
            <Label htmlFor="order-payment-filter" className="sr-only">
              Ödeme Yöntemi
            </Label>
            <CreditCardIcon
              aria-hidden="true"
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <select
              id="order-payment-filter"
              value={paymentMethodFilter}
              onChange={(e) => onPaymentMethodFilterChange(e.target.value)}
              className="h-9 rounded-md border border-input bg-background pl-8 pr-7 text-xs font-medium text-foreground outline-none focus-visible:border-ring cursor-pointer"
            >
              <option value="all">Tüm Ödemeler</option>
              <option value="paytr">PayTR / Kart</option>
              <option value="bank_transfer">Havale / EFT</option>
              <option value="cash_on_delivery">Kapıda Ödeme</option>
            </select>
          </div>

          <div className="relative shrink-0">
            <Label htmlFor="order-payment-status-filter" className="sr-only">
              Ödeme Durumu
            </Label>
            <select
              id="order-payment-status-filter"
              value={paymentStatusFilter}
              onChange={(e) => onPaymentStatusFilterChange(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground outline-none focus-visible:border-ring cursor-pointer"
            >
              <option value="all">Tüm Tahsilat Durumları</option>
              {ORDER_PAYMENT_STATUS_KEYS.map((paymentStatus) => (
                <option key={paymentStatus} value={paymentStatus}>
                  {orderPaymentStatusLabels[paymentStatus]}
                </option>
              ))}
            </select>
          </div>

          {(dateFilter !== "all" || paymentMethodFilter !== "all" || paymentStatusFilter !== "all" || query.trim() !== "") && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground underline px-1 py-1 cursor-pointer transition-colors"
            >
              <XMarkIcon className="size-3.5" />
              <span>Temizle</span>
            </button>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 shrink-0 ml-auto">
          <div className="inline-flex items-center rounded-lg border border-border p-0.5 bg-background">
            <button
              type="button"
              onClick={() => onViewModeChange("kanban")}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors cursor-pointer ${viewMode === "kanban"
                ? "bg-muted text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
                }`}
              title="Kanban Panosu"
            >
              <ViewColumnsIcon className="size-3.5" />
              <span className="hidden sm:inline">Kanban</span>
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange("list")}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors cursor-pointer ${viewMode === "list"
                ? "bg-muted text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
                }`}
              title="Liste Görünümü"
            >
              <ListBulletIcon className="size-3.5" />
              <span className="hidden sm:inline">Liste</span>
            </button>
          </div>
          <div className="text-xs font-mono text-muted-foreground tabular-nums shrink-0">
            <span>{resultCount} sipariş</span>
          </div>
        </div>
      </div>
    </>
  );
}
