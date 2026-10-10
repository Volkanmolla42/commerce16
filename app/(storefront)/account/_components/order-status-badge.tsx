import type { Doc } from "@/convex/_generated/dataModel";
import { CheckBadgeIcon, ClockIcon, XCircleIcon } from "@heroicons/react/24/outline";
import { orderStatusLabels } from "@/lib/orders";
import { Badge } from "@/components/ui";

export function OrderStatusBadge({ status }: { status: Doc<"orders">["status"] }) {
  switch (status) {
    case "paid":
      return (
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 gap-1.5 font-medium">
          <CheckBadgeIcon className="h-3.5 w-3.5" />
          {orderStatusLabels[status]}
        </Badge>
      );
    case "cancelled":
      return (
        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 gap-1.5 font-medium">
          <XCircleIcon className="h-3.5 w-3.5" />
          {orderStatusLabels[status]}
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 gap-1.5 font-medium">
          <ClockIcon className="h-3.5 w-3.5" />
          {orderStatusLabels[status]}
        </Badge>
      );
  }
}
