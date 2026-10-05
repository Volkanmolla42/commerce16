"use client";

import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import Form from "next/form";
import { useSearchParams } from "next/navigation";

export default function Search() {
  const searchParams = useSearchParams();

  return (
    <Form
      action="/search"
      className="relative w-full max-w-xs sm:max-w-sm md:max-w-md"
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-400">
        <MagnifyingGlassIcon className="h-4 w-4" aria-hidden="true" />
      </div>
      <input
        key={searchParams?.get("q")}
        type="text"
        name="q"
        placeholder="Ürün ara..."
        autoComplete="off"
        defaultValue={searchParams?.get("q") || ""}
        className="w-full rounded-full border border-neutral-200 bg-neutral-100/80 py-2 pl-9 pr-4 text-sm text-black transition placeholder:text-neutral-500 focus:border-neutral-400 focus:bg-white focus:outline-hidden dark:border-neutral-800 dark:bg-neutral-800/80 dark:text-white dark:placeholder:text-neutral-400 dark:focus:border-neutral-600 dark:focus:bg-neutral-900"
      />
    </Form>
  );
}

export function SearchSkeleton() {
  return (
    <div className="relative w-full max-w-xs sm:max-w-sm md:max-w-md">
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-400">
        <MagnifyingGlassIcon className="h-4 w-4" aria-hidden="true" />
      </div>
      <input
        placeholder="Ürün ara..."
        disabled
        className="w-full rounded-full border border-neutral-200 bg-neutral-100/80 py-2 pl-9 pr-4 text-sm text-black placeholder:text-neutral-500 dark:border-neutral-800 dark:bg-neutral-800/80 dark:text-white dark:placeholder:text-neutral-400"
      />
    </div>
  );
}
