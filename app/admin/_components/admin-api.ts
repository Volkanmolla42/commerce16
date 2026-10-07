"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
  const request = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const paramsKey = JSON.stringify(params);

  const load = useCallback(() => {
    if (!mounted.current) return Promise.resolve();
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const search = new URLSearchParams({ resource, ...JSON.parse(paramsKey) as Record<string, string> });
    return adminRequest<T>(
        `/api/admin?${search.toString()}`,
        { cache: "no-store", signal: controller.signal },
        "Veriler yüklenemedi.",
      ).then((payload) => {
      if (!controller.signal.aborted) {
        setData(payload);
        setError(null);
      }
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : "Veriler yüklenemedi.");
      }
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
  }, [paramsKey, resource]);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
      request.current?.abort();
    };
  }, [load]);

  const refresh = useCallback(async () => {
    if (!mounted.current) return;
    setLoading(true);
    setError(null);
    await load();
  }, [load]);

  return { data, error, loading, refresh };
}

export async function runAdminAction<T = unknown>(action: string, input?: unknown, id?: string) {
  return adminRequest<T>("/api/admin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, input, id }),
  }, "İşlem tamamlanamadı.");
}
