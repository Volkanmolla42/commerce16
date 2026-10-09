import type { Doc } from "@/convex/_generated/dataModel";
import { CheckmarkBadge01Icon, Clock01Icon, Cancel01Icon } from "hugeicons-react";
import { orderStatusLabels } from "@/lib/orders";
import { Badge } from "@/components/ui";

export function OrderStatusBadge({ status }: { status: Doc<"orders">["status"] }) {
  switch (status) {
    case "paid":
      return (
        <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 gap-1.5 font-medium">
          <CheckmarkBadge01Icon className="h-3.5 w-3.5" />
          {orderStatusLabels[status]}
        </Badge>
      );
    case "cancelled":
      return (
        <Badge variant="outline" className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 gap-1.5 font-medium">
          <Cancel01Icon className="h-3.5 w-3.5" />
          {orderStatusLabels[status]}
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 gap-1.5 font-medium">
          <Clock01Icon className="h-3.5 w-3.5" />
          {orderStatusLabels[status]}
        </Badge>
      );
  }
}
