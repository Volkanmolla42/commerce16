"use client";

import { useConvexAuth } from "@convex-dev/auth/react";
import { UserIcon } from "hugeicons-react";
import Link from "next/link";

export function UserNav() {
  const { isAuthenticated, isLoading } = useConvexAuth();

  if (isLoading) {
    return (
      <div className="h-9 w-9 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-800" />
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
