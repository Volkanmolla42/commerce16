import { Suspense } from "react";
import { AdminLoading } from "../_components/admin-primitives";
import { AnalyticsContent } from "./analytics-client";

export default function AdminAnalyticsPage() {
  return (
    <Suspense fallback={<AdminLoading label="E-ticaret analitiği" />}>
      <AnalyticsContent />
    </Suspense>
  );
}
