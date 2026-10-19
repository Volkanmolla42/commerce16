"use client";

import { EnvelopeIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { isRetryableOrderEvent } from "@/convex/emails/events";
import {
  emailEventLabels,
  emailStatusLabels,
  type Order,
  type OrderEmailEvent,
} from "./order-admin-shared";

export function OrderEmailHistory({
  order,
  retryingEmailKey,
  onRetryEmail,
}: {
  order: Order;
  retryingEmailKey: string | null;
  onRetryEmail: (event: OrderEmailEvent) => void;
}) {
  return (
    <details className="group rounded-xl border border-border bg-card/40 overflow-hidden text-xs">
      <summary className="flex items-center justify-between p-3.5 font-semibold text-muted-foreground hover:text-foreground cursor-pointer select-none transition-colors">
        <span className="flex items-center gap-2">
          <EnvelopeIcon className="size-3.5" />
          <span>E-posta Bildirim Geçmişi ({(order.emailEvents ?? []).length})</span>
        </span>
        <span className="text-[10px] text-muted-foreground transition-transform group-open:rotate-180">
          ▼
        </span>
      </summary>
      <div className="p-3.5 pt-0 space-y-2 border-t border-border/50">
        {(order.emailEvents ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground">Bildirim kaydı bulunmuyor.</p>
        ) : (
          (order.emailEvents ?? []).map((emailEvent) => (
            <div key={emailEvent._id} className="space-y-1.5 rounded-lg border border-border/70 bg-background/50 p-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-foreground">{emailEventLabels[emailEvent.event]}</span>
                <span className="text-xs text-muted-foreground">{emailStatusLabels[emailEvent.status]}</span>
              </div>
              {emailEvent.error && <p className="text-xs text-destructive">{emailEvent.error}</p>}
              {(isRetryableOrderEvent(emailEvent.event) &&
                (emailEvent.status === "failed" || emailEvent.status === "not_configured")) && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs cursor-pointer"
                    disabled={retryingEmailKey === `${order._id}:${emailEvent.event}`}
                    onClick={() => onRetryEmail(emailEvent.event)}
                  >
                    {retryingEmailKey === `${order._id}:${emailEvent.event}` ? "Deneniyor..." : "Yeniden Dene"}
                  </Button>
                )}
            </div>
          ))
        )}
      </div>
    </details>
  );
}
