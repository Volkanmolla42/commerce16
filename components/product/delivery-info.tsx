import { routes } from "@/lib/storefront-routes";
import { ArrowTopRightOnSquareIcon, ArrowUturnLeftIcon, TruckIcon } from "@heroicons/react/24/outline";

const links = [
  {
    href: routes.preInformationForm,
    icon: TruckIcon,
    title: "Teslimat bilgileri",
    description: "Kargo süresi ve teslimat koşulları",
  },
  {
    href: routes.refundPolicy,
    icon: ArrowUturnLeftIcon,
    title: "İade koşulları",
    description: "Cayma hakkı ve iade süreci",
  },
];

export function DeliveryInfo() {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground">
        Teslimat ve iade
      </h4>
      <div className="mt-2.5 space-y-2.5">
        {links.map(({ href, icon: Icon, title, description }) => (
          <a
            key={href}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            title="Yeni sekmede açılır"
            className="group flex items-start gap-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              <span className="flex items-center gap-1 text-sm font-medium text-foreground group-hover:underline">
                {title}
                <ArrowTopRightOnSquareIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
                <span className="sr-only"> (yeni sekmede açılır)</span>
              </span>
              <span className="block text-xs">{description}</span>
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
