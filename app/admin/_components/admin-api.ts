"use client";

import { useEffect, useState } from "react";

type ResourceState<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

function cleanErrorMessage(raw: string): string {
  return raw
    .replace(/^\[Request ID:[^\]]+\]\s*/i, "")
    .replace(/^Server Error\s*/i, "")
    .replace(/^Uncaught (?:Convex)?Error:\s*/i, "")
    .replace(/^Error:\s*/i, "")
    .trim();
}

async function adminRequest<T>(url: string, options: RequestInit, fallback: string): Promise<T> {
  const response = await fetch(url, options);
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload &&
      typeof payload.error === "string"
        ? cleanErrorMessage(payload.error)
        : fallback;
    throw new Error(message || fallback);
  }
  if (payload === null) throw new Error(fallback);
  return payload as T;
}


export function useAdminResource<T>(resource: string, params: Record<string, string> = {}): ResourceState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const paramsKey = JSON.stringify(params);

  useEffect(() => {
    let ignore = false;
    const controller = new AbortController();

    async function run() {
      try {
        const parsedParams = JSON.parse(paramsKey) as Record<string, string>;
        const search = new URLSearchParams({ resource, ...parsedParams });
        const payload = await adminRequest<T>(
          `/api/admin?${search.toString()}`,
          { cache: "no-store", signal: controller.signal },
          "Veriler yüklenemedi.",
        );
        if (!ignore) {
          setData(payload);
          setError(null);
        }
      } catch (cause: unknown) {
        if (!ignore) {
          setData(null);
          setError(cause instanceof Error ? cause.message : "Veriler yüklenemedi.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void run();

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [resource, paramsKey]);

  const refresh = async () => {
    setLoading(true);
    try {
      const parsedParams = JSON.parse(paramsKey) as Record<string, string>;
      const search = new URLSearchParams({ resource, ...parsedParams });
      const payload = await adminRequest<T>(
        `/api/admin?${search.toString()}`,
        { cache: "no-store" },
        "Veriler yüklenemedi.",
      );
      setData(payload);
      setError(null);
    } catch (cause: unknown) {
      setData(null);
      setError(cause instanceof Error ? cause.message : "Veriler yüklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  return { data, error, loading, refresh };
}

export async function runAdminAction<T = unknown>(action: string, input?: unknown, id?: string) {
  return adminRequest<T>("/api/admin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, input, id }),
  }, "İşlem tamamlanamadı.");
}
