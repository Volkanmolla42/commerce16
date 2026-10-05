import { redirect } from "next/navigation";
import { Suspense } from "react";

async function OrderRedirect(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  return redirect(`/account/orders/${params.id}`);
}

export default function OrderRedirectPage(props: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={null}><OrderRedirect params={props.params} /></Suspense>;
}
