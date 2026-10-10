"use client";

import { LockIcon } from "hugeicons-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button, Card, CardContent } from "@/components/ui";

export function AdminGate() {
  const storeSettings = useQuery(api.settings.getStoreSettings, {});
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const verifyPin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(pin)) {
      setError("6 haneli PIN'i gir.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/admin-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const result: { success?: boolean; error?: string } = await response.json();
      if (!response.ok || !result.success) {
        setError(result.error || "Yönetici PIN'i doğrulanamadı.");
        setPin("");
        return;
      }
      router.refresh();
    } catch {
      setError("Giriş doğrulanamadı. Tekrar dene.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="fixed inset-0 z-50 grid min-h-[100dvh] place-items-center bg-background px-4 py-10 text-foreground">
      <Card className="w-full max-w-sm overflow-hidden">
        <CardContent className="p-6 sm:p-8">
          <div className="mb-7 flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-md bg-primary text-primary-foreground">
              <LockIcon className="size-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{storeSettings?.storeName || "Mağaza"}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Yönetim paneli</p>
            </div>
          </div>

          <h1 className="text-xl font-semibold tracking-tight">Yönetici PIN&apos;i</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Mağaza yönetimine devam etmek için 6 haneli PIN&apos;ini gir.
          </p>

          <form className="mt-6" onSubmit={verifyPin}>
            <label htmlFor="admin-pin" className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              6 Haneli PIN
            </label>
            <input
              id="admin-pin"
              name="pin"
              type="password"
              autoComplete="current-password"
              inputMode="numeric"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              placeholder="••••••"
              required
              autoFocus
              value={pin}
              onChange={(event) => {
                setPin(event.target.value.replace(/\D/g, "").slice(0, 6));
                setError(null);
              }}
              disabled={submitting}
              className="h-12 w-full rounded-xl border border-input bg-background px-4 text-center font-mono text-xl tracking-[0.4em] text-foreground transition focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 outline-none disabled:opacity-60"
            />

            {error && <p role="alert" aria-live="polite" className="mt-3 text-xs font-medium text-destructive">{error}</p>}

            <Button type="submit" disabled={submitting || pin.length !== 6} className="mt-5 h-11 w-full rounded-xl font-medium">
              {submitting ? "Doğrulanıyor…" : "Yönetim Paneline Gir"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
