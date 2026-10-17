import { ArrowTopRightOnSquareIcon, ArrowUturnLeftIcon, TruckIcon } from "@heroicons/react/24/outline";

export function DeliveryInfo() {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground">
        Teslimat ve iade
      </h4>
      <div className="mt-2.5 space-y-2.5">
        <a
          href="/pre-information-form"
          target="_blank"
          rel="noopener noreferrer"
          title="Yeni sekmede açılır"
          className="group flex items-start gap-2 text-muted-foreground transition-colors hover:text-foreground"
        >
          <TruckIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            <span className="flex items-center gap-1 text-sm font-medium text-foreground group-hover:underline">
              Teslimat bilgileri
              <ArrowTopRightOnSquareIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
            </span>
            <span className="block text-xs">
              Kargo süresi ve teslimat koşulları
            </span>
          </span>
        </a>
        <a
          href="/distance-sales-agreement"
          target="_blank"
          rel="noopener noreferrer"
          title="Yeni sekmede açılır"
          className="group flex items-start gap-2 text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowUturnLeftIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            <span className="flex items-center gap-1 text-sm font-medium text-foreground group-hover:underline">
              İade koşulları
              <ArrowTopRightOnSquareIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
            </span>
            <span className="block text-xs">
              Cayma hakkı ve iade süreci
            </span>
          </span>
        </a>
      </div>
    </div>
  );
}
