"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { useConvexAuth } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import { UserIcon } from "hugeicons-react";
import { Sk } from "./skeleton";

export function SidebarProfileSkeleton() {
  return (
    <div className="flex items-center gap-3 border-b border-border pb-4">
      <Sk className="h-11 w-11 shrink-0 rounded-full" />
      <div className="min-w-0 space-y-1.5">
        <Sk className="h-4 w-24" />
        <Sk className="h-3 w-36" />
      </div>
    </div>
  );
}

export function SidebarProfile() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const profile = useQuery(
    api.users.getMyProfile,
    isAuthenticated ? {} : "skip"
  );

  if (isLoading || (isAuthenticated && profile === undefined)) {
    return <SidebarProfileSkeleton />;
  }

  if (!isAuthenticated || !profile) {
    return (
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <UserIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground">Misafir</p>
          <Link
            href="/login"
            className="text-xs font-medium text-primary hover:underline"
          >
            Giriş yapın
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 border-b border-border pb-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-bold text-primary">
        {(profile.name?.[0] || profile.email?.[0] || "K").toUpperCase()}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-foreground">
          {profile.name || "Kullanıcı"}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {profile.email}
        </p>
      </div>
    </div>
  );
}
