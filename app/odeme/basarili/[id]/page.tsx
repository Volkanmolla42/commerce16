import { Suspense } from "react";
import OrderSuccessClient from "./_components/order-success-client";
import { OrderSuccessSkeleton } from "./_components/order-success-skeleton";

type OrderSuccessPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default function OrderSuccessPage({ params, searchParams }: OrderSuccessPageProps) {
  return (
    <Suspense fallback={<OrderSuccessSkeleton />}>
      <OrderSuccessContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function OrderSuccessContent({ params, searchParams }: OrderSuccessPageProps) {
  const { id } = await params;
  const query = await searchParams;
  const token = typeof query?.token === "string" ? query.token : undefined;
  return <OrderSuccessClient orderId={id} token={token} quickBuy={query?.mode === "quick-buy"} />;
}
