"use client";

import { useConvexAuth } from "@convex-dev/auth/react";
import { UserIcon } from "hugeicons-react";
import Link from "next/link";

export function UserNav() {
  const { isAuthenticated, isLoading } = useConvexAuth();

  if (isLoading) {
    return (
      <div
        aria-hidden
        className="flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1.5 animate-pulse dark:border-neutral-800 dark:bg-neutral-900"
      >
        <div className="h-4 w-4 rounded-full bg-neutral-200 dark:bg-neutral-800" />
        <div className="hidden sm:block h-3 w-14 rounded bg-neutral-200 dark:bg-neutral-800" />
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <Link
        href="/account"
        aria-label="Hesabım"
        className="flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 transition hover:border-neutral-400 hover:text-black dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:border-neutral-600 dark:hover:text-white"
      >
        <UserIcon className="h-4 w-4" />
        <span className="hidden sm:inline">Hesabım</span>
      </Link>
    );
  }

  return (
    <Link
      href="/login"
      aria-label="Giriş Yap"
      className="flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 transition hover:border-neutral-400 hover:text-black dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:border-neutral-600 dark:hover:text-white"
    >
      <UserIcon className="h-4 w-4" />
      <span className="hidden sm:inline">Giriş Yap</span>
    </Link>
  );
}
