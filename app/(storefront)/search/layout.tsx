import { Suspense } from "react";
import ChildrenWrapper from "./children-wrapper";

export default function SearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-(--breakpoint-2xl) px-4 pb-16 pt-6 text-foreground sm:pt-8">
      <Suspense fallback={null}>
        <ChildrenWrapper>{children}</ChildrenWrapper>
      </Suspense>
    </div>
  );
}
