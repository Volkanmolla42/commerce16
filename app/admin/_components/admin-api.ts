"use client";

import { useCallback, useEffect, useState } from "react";

type ResourceState<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

async function adminRequest<T>(url: string, options: RequestInit, fallback: string): Promise<T> {
  const response = await fetch(url, options);
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : fallback;
    throw new Error(message);
  }
  if (payload === null) throw new Error(fallback);
  return payload as T;
}

export function useAdminResource<T>(resource: string, params: Record<string, string> = {}): ResourceState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const paramsKey = JSON.stringify(params);

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const parsedParams = JSON.parse(paramsKey) as Record<string, string>;
      const search = new URLSearchParams({ resource, ...parsedParams });
      const payload = await adminRequest<T>(
        `/api/admin?${search.toString()}`,
        { cache: "no-store", signal },
        "Veriler yüklenemedi.",
      );
      if (!signal?.aborted) {
        setData(payload);
        setError(null);
      }
    } catch (cause: unknown) {
      if (!signal?.aborted) {
        setData(null);
        setError(cause instanceof Error ? cause.message : "Veriler yüklenemedi.");
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [resource, paramsKey]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchData(controller.signal);

    return () => {
      controller.abort();
    };
  }, [fetchData]);

  const refresh = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  return { data, error, loading, refresh };
}

export async function runAdminAction<T = unknown>(action: string, input?: unknown, id?: string) {
  return adminRequest<T>("/api/admin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, input, id }),
  }, "İşlem tamamlanamadı.");
}
