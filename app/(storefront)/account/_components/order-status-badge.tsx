import type { Doc } from "@/convex/_generated/dataModel";
import {
  CheckBadgeIcon,
  CheckCircleIcon,
  ClockIcon,
  TruckIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { orderStatusLabels } from "@/lib/orders";
import { Badge } from "@/components/ui";

export function OrderStatusBadge({ status }: { status: Doc<"orders">["status"] }) {
  switch (status) {
    case "delivered":
      return (
        <Badge
          variant="outline"
          className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 gap-1.5 font-medium"
        >
          <CheckBadgeIcon className="h-3.5 w-3.5" />
          {orderStatusLabels.delivered}
        </Badge>
      );
    case "shipped":
      return (
        <Badge
          variant="outline"
          className="bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20 gap-1.5 font-medium"
        >
          <TruckIcon className="h-3.5 w-3.5" />
          {orderStatusLabels.shipped}
        </Badge>
      );
    case "paid":
      return (
        <Badge
          variant="outline"
          className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 gap-1.5 font-medium"
        >
          <CheckCircleIcon className="h-3.5 w-3.5" />
          {orderStatusLabels.paid}
        </Badge>
      );
    case "pending":
      return (
        <Badge
          variant="outline"
          className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 gap-1.5 font-medium"
        >
          <ClockIcon className="h-3.5 w-3.5" />
          {orderStatusLabels.pending}
        </Badge>
      );
    case "cancelled":
      return (
        <Badge
          variant="outline"
          className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 gap-1.5 font-medium"
        >
          <XCircleIcon className="h-3.5 w-3.5" />
          {orderStatusLabels.cancelled}
        </Badge>
      );
    default:
      return (
        <Badge
          variant="outline"
          className="bg-muted text-muted-foreground border-border gap-1.5 font-medium"
        >
          <ClockIcon className="h-3.5 w-3.5" />
          {orderStatusLabels[status as keyof typeof orderStatusLabels] || status}
        </Badge>
      );
  }
}
