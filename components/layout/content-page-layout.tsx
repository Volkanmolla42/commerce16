import type { ReactNode } from "react";
import Link from "next/link";
import Footer from "@/components/layout/footer";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

export default function ContentPageLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-12">
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" />
            <span>Ana Sayfaya Dön</span>
          </Link>
        </div>
        <div className="rounded-3xl border border-border bg-card p-6 sm:p-10 shadow-xs">
          {children}
        </div>
      </div>
      <Footer />
    </>
  );
}
