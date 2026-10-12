import { Suspense } from "react";
import OrderSuccessClient from "./_components/order-success-client";
import { OrderSuccessSkeleton } from "./_components/order-success-skeleton";

type OrderSuccessPageProps = {
  params: Promise<{ id: string }>;
};

export default function OrderSuccessPage({ params }: OrderSuccessPageProps) {
  return (
    <Suspense fallback={<OrderSuccessSkeleton />}>
      <OrderSuccessContent params={params} />
    </Suspense>
  );
}

async function OrderSuccessContent({ params }: OrderSuccessPageProps) {
  const { id } = await params;
  return <OrderSuccessClient orderId={id} />;
}
