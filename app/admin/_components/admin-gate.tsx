"use client";

import { LockIcon } from "hugeicons-react";
import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function AdminGate({ children }: { children: React.ReactNode }) {
  const storeSettings = useQuery(api.settings.getStoreSettings, {});
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/admin-auth", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { authenticated?: boolean }) => {
        if (active) setAuthenticated(data.authenticated === true);
      })
      .catch(() => {
        if (active) setAuthenticated(false);
      });
    return () => {
      active = false;
    };
  }, []);

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
      setAuthenticated(true);
    } catch {
      setError("Giriş doğrulanamadı. Tekrar dene.");
    } finally {
      setSubmitting(false);
    }
  };

  if (authenticated === null) {
    return (
      <>
        <div className="grid min-h-[100dvh] place-items-center bg-neutral-50">
          <div className="size-7 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-800" />
        </div>
      </>
    );
  }

  if (!authenticated) {
    return (
      <>
        <main className="grid min-h-[100dvh] place-items-center bg-neutral-50 px-4 py-10 text-neutral-950">
          <Card className="w-full max-w-sm overflow-hidden rounded-lg border-neutral-200 bg-white shadow-none">
            <CardContent className="p-6 sm:p-8">
              <div className="mb-7 flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-md bg-black text-white">
                  <LockIcon className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-neutral-950">{storeSettings?.storeName || "Mağaza"}</p>
                  <p className="mt-0.5 text-xs text-neutral-500">Yönetim paneli</p>
                </div>
              </div>

              <h1 className="text-xl font-semibold tracking-tight">Yönetici PIN&apos;i</h1>
              <p className="mt-2 text-sm leading-6 text-neutral-600">
                Mağaza yönetimine devam etmek için 6 haneli PIN&apos;ini gir.
              </p>

              <form className="mt-6" onSubmit={verifyPin}>
                <label htmlFor="admin-pin" className="mb-2 block text-sm font-medium text-neutral-800">
                  6 haneli PIN
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
                  required
                  value={pin}
                  onChange={(event) => {
                    setPin(event.target.value.replace(/\D/g, "").slice(0, 6));
                    setError(null);
                  }}
                  disabled={submitting}
                  className="h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-neutral-950 outline-none transition focus-visible:border-neutral-800 focus-visible:ring-2 focus-visible:ring-neutral-950/10 disabled:opacity-60"
                />

                {error && <p role="alert" aria-live="polite" className="mt-4 text-sm font-medium text-rose-700">{error}</p>}

                <Button type="submit" disabled={submitting || pin.length !== 6} className="mt-5 h-11 w-full rounded-md bg-black font-medium text-white shadow-none hover:bg-neutral-800">
                  {submitting ? "Doğrulanıyor…" : "Yönetim paneline gir"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </main>
      </>
    );
  }

  return children;
}
