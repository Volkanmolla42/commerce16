import { Suspense } from "react";
import AccountOrderDetailsClient, {
  AccountOrderDetailsSkeleton,
} from "../../_components/account-order-details-client";

type AccountOrderDetailsPageProps = {
  params: Promise<{ id: string }>;
};

export default function AccountOrderDetailsPage({
  params,
}: AccountOrderDetailsPageProps) {
  return (
    <Suspense fallback={<AccountOrderDetailsSkeleton />}>
      <AccountOrderDetailsContent params={params} />
    </Suspense>
  );
}

async function AccountOrderDetailsContent({
  params,
}: AccountOrderDetailsPageProps) {
  const { id } = await params;
  return <AccountOrderDetailsClient orderId={id} />;
}
