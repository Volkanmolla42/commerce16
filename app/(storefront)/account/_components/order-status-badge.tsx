import type { Doc } from "@/convex/_generated/dataModel";
import { DeliveryTruck01Icon, CheckmarkBadge01Icon, Clock01Icon, Cancel01Icon } from "hugeicons-react";
import { orderStatusLabels } from "@/lib/orders";
import { Badge } from "@/components/ui/badge";

export function OrderStatusBadge({ status }: { status: Doc<"orders">["status"] }) {
  switch (status) {
    case "paid":
      return (
        <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 gap-1.5 font-medium">
          <CheckmarkBadge01Icon className="h-3.5 w-3.5" />
          {orderStatusLabels[status]}
        </Badge>
      );
    case "shipped":
      return (
        <Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 gap-1.5 font-medium">
          <DeliveryTruck01Icon className="h-3.5 w-3.5" />
          {orderStatusLabels[status]}
        </Badge>
      );
    case "delivered":
      return (
        <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 gap-1.5 font-medium">
          <CheckmarkBadge01Icon className="h-3.5 w-3.5" />
          {orderStatusLabels[status]}
        </Badge>
      );
    case "cancelled":
      return (
        <Badge variant="destructive" className="gap-1.5 font-medium">
          <Cancel01Icon className="h-3.5 w-3.5" />
          {orderStatusLabels[status]}
        </Badge>
      );
    default:
      return (
        <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 gap-1.5 font-medium">
          <Clock01Icon className="h-3.5 w-3.5" />
          {orderStatusLabels[status]}
        </Badge>
      );
  }
}
