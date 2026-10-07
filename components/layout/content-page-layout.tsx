import type { ReactNode } from "react";
import Footer from "@/components/layout/footer";

export default function ContentPageLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="mx-auto w-full max-w-3xl px-4 py-12">{children}</div>
      <Footer />
    </>
  );
}
