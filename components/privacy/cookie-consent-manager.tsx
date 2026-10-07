"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui";
import { COOKIE_CONSENT_POLICY_VERSION, COOKIE_CONSENT_STORAGE_KEY } from "@/lib/privacy/consent";

type Consent = {
  necessary: true;
  preferences: boolean;
  analytics: boolean;
  marketing: boolean;
  policyVersion: string;
  updatedAt: number;
};

const categories = [
  { key: "preferences", title: "İşlevsel", description: "Dil ve benzeri tercihleri hatırlar." },
  { key: "analytics", title: "Analitik", description: "Mağaza kullanımını ölçmeye yardımcı olur." },
  { key: "marketing", title: "Pazarlama", description: "İlgi alanlarına uygun kampanya ölçümü sağlar." },
] as const;

const CONSENT_NOT_READ = undefined;

function subscribeConsent(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener("commerce-cookie-consent-change", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("commerce-cookie-consent-change", onChange);
  };
}

function readStoredConsent() {
  try {
    return localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
  } catch {
    return null;
  }
}

function decodeConsent(rawValue: string | null): Consent | null {
  try {
    const value: unknown = JSON.parse(rawValue || "null");
    if (!value || typeof value !== "object") return null;
    const consent = value as Partial<Consent>;
    if (consent.policyVersion !== COOKIE_CONSENT_POLICY_VERSION || typeof consent.updatedAt !== "number") return null;
    if ([consent.preferences, consent.analytics, consent.marketing].some((item) => typeof item !== "boolean")) return null;
    return {
      necessary: true,
      preferences: consent.preferences!,
      analytics: consent.analytics!,
      marketing: consent.marketing!,
      policyVersion: COOKIE_CONSENT_POLICY_VERSION,
      updatedAt: consent.updatedAt,
    };
  } catch {
    return null;
  }
}

export function CookieConsentManager() {
  const storedConsent = useSyncExternalStore(subscribeConsent, readStoredConsent, () => CONSENT_NOT_READ);
  const consentWasRead = storedConsent !== CONSENT_NOT_READ;
  const [memoryConsent, setMemoryConsent] = useState<Consent | null>(null);
  const consent = memoryConsent ?? (consentWasRead ? decodeConsent(storedConsent) : null);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [draft, setDraft] = useState({ preferences: false, analytics: false, marketing: false });

  useEffect(() => {
    const openPreferences = () => {
      const saved = memoryConsent ?? decodeConsent(readStoredConsent());
      setDraft({
        preferences: saved?.preferences ?? false,
        analytics: saved?.analytics ?? false,
        marketing: saved?.marketing ?? false,
      });
      setPreferencesOpen(true);
    };

    window.addEventListener("commerce-cookie-preferences-open", openPreferences);
    return () => window.removeEventListener("commerce-cookie-preferences-open", openPreferences);
  }, [memoryConsent]);

  const save = (next: typeof draft) => {
    const saved: Consent = { necessary: true, ...next, policyVersion: COOKIE_CONSENT_POLICY_VERSION, updatedAt: Date.now() };
    try {
      localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(saved));
      window.dispatchEvent(new Event("commerce-cookie-consent-change"));
    } catch {
      // The selection remains active in this tab when browser storage is unavailable.
      setMemoryConsent(saved);
    }
    setDraft(next);
    setPreferencesOpen(false);
  };

  if (!consentWasRead || (consent && !preferencesOpen)) return null;

  return (
    <aside role="region" aria-label="Çerez tercihleri" className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-3xl rounded-2xl border border-border bg-background p-4 shadow-2xl sm:inset-x-6 sm:bottom-6 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-xl space-y-1">
          <h2 className="text-sm font-semibold text-foreground">Çerez tercihleri</h2>
          <p className="text-xs leading-5 text-muted-foreground">
            Zorunlu çerezler mağazanın çalışması için kullanılır. Diğer kategorileri seçebilir, tercihinizi daha sonra değiştirebilirsiniz. <Link href="/privacy-policy" className="underline underline-offset-4">Gizlilik politikası</Link>
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {!preferencesOpen ? (
            <>
              <Button type="button" size="sm" variant="outline" onClick={() => save({ preferences: false, analytics: false, marketing: false })}>Tümünü reddet</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => {
                setDraft({ preferences: consent?.preferences ?? false, analytics: consent?.analytics ?? false, marketing: consent?.marketing ?? false });
                setPreferencesOpen(true);
              }}>Tercihleri yönet</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => save({ preferences: true, analytics: true, marketing: true })}>Tümünü kabul et</Button>
            </>
          ) : (
            <Button type="button" size="sm" variant="outline" onClick={() => setPreferencesOpen(false)}>Kapat</Button>
          )}
        </div>
      </div>
      {preferencesOpen && (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          <label className="flex items-start justify-between gap-4 rounded-lg bg-muted/40 p-3 text-sm">
            <span><span className="block font-medium text-foreground">Zorunlu</span><span className="mt-1 block text-xs text-muted-foreground">Sepet ve güvenlik için gereklidir; kapatılamaz.</span></span>
            <input type="checkbox" checked readOnly aria-label="Zorunlu çerezler her zaman açık" className="mt-1 h-4 w-4 accent-primary" />
          </label>
          {categories.map((category) => (
            <label key={category.key} className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-border p-3 text-sm">
              <span><span className="block font-medium text-foreground">{category.title}</span><span className="mt-1 block text-xs text-muted-foreground">{category.description}</span></span>
              <input
                type="checkbox"
                checked={draft[category.key]}
                onChange={(event) => setDraft((current) => ({ ...current, [category.key]: event.target.checked }))}
                aria-label={`${category.title} çerezlerine izin ver`}
                className="mt-1 h-4 w-4 accent-primary"
              />
            </label>
          ))}
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => save({ preferences: false, analytics: false, marketing: false })}>Tümünü reddet</Button>
            <Button type="button" size="sm" onClick={() => save(draft)}>Seçimi kaydet</Button>
          </div>
        </div>
      )}
    </aside>
  );
}

export function CookiePreferencesButton() {
  return (
    <Button
      type="button"
      variant="link"
      size="sm"
      className="h-auto p-0 text-xs text-neutral-500 underline-offset-4 hover:text-black dark:text-neutral-400 dark:hover:text-white"
      onClick={() => window.dispatchEvent(new Event("commerce-cookie-preferences-open"))}
    >
      Çerez tercihleri
    </Button>
  );
}
