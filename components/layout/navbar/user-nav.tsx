"use client";

import { useConvexAuth } from "@convex-dev/auth/react";
import { UserIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

export function UserNav() {
  const { isAuthenticated, isLoading } = useConvexAuth();

  if (isLoading) {
    return (
      <div
        aria-hidden
        className="flex h-10 w-10 items-center justify-center gap-2 rounded-full border border-neutral-200 bg-white p-0 animate-pulse sm:w-auto sm:justify-start sm:px-3 dark:border-neutral-800 dark:bg-neutral-900"
      >
        <div className="h-5 w-5 rounded-full bg-neutral-200 dark:bg-neutral-800" />
        <div className="hidden sm:block h-3 w-14 rounded bg-neutral-200 dark:bg-neutral-800" />
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <Link
        href="/account/orders"
        aria-label="Hesabım"
        className="flex h-10 w-10 items-center justify-center gap-2 rounded-full border border-neutral-200 bg-white p-0 text-xs font-medium text-neutral-800 transition hover:border-neutral-400 hover:text-black sm:w-auto sm:justify-start sm:px-3 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:border-neutral-600 dark:hover:text-white"
      >
        <UserIcon className="h-5 w-5" />
        <span className="hidden sm:inline">Hesabım</span>
      </Link>
    );
  }

  return (
    <Link
      href="/login"
      aria-label="Giriş Yap"
      className="flex h-10 w-10 items-center justify-center gap-2 rounded-full border border-neutral-200 bg-white p-0 text-xs font-medium text-neutral-800 transition hover:border-neutral-400 hover:text-black sm:w-auto sm:justify-start sm:px-3 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:border-neutral-600 dark:hover:text-white"
    >
      <UserIcon className="h-5 w-5" />
      <span className="hidden sm:inline">Giriş Yap</span>
    </Link>
  );
}
