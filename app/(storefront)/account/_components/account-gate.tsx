"use client";

import Link from "next/link";
import { UserIcon, ArrowRight01Icon } from "hugeicons-react";
import { Button, Card } from "@/components/ui";

export function AccountLoginCard() {
  return (
    <div className="mx-auto max-w-md px-4 py-12 text-center">
      <Card className="rounded-3xl border-border bg-card p-8 shadow-xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <UserIcon className="h-8 w-8" />
        </div>
        <h1 className="mt-6 text-xl font-bold text-foreground">
          Giriş Yapmanız Gerekiyor
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Hesabınızı ve siparişlerinizi görüntülemek için lütfen giriş yapın.
        </p>
        <Button
          asChild
          size="lg"
          className="mt-6 w-full rounded-2xl font-semibold shadow-md"
        >
          <Link href="/login">
            Giriş Yap <ArrowRight01Icon className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </Card>
    </div>
  );
}
