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
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const paramsKey = JSON.stringify(params);
  const resourceKey = `${resource}:${paramsKey}`;
  const currentResourceKey = useRef(resourceKey);

  const load = useCallback(() => {
    if (!mounted.current || currentResourceKey.current !== resourceKey) return Promise.resolve();
    setLoading(true);
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
        setSettledKey(resourceKey);
      }
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) {
        setData(null);
        setError(cause instanceof Error ? cause.message : "Veriler yüklenemedi.");
        setSettledKey(resourceKey);
      }
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
  }, [paramsKey, resource, resourceKey]);

  useEffect(() => {
    mounted.current = true;
    currentResourceKey.current = resourceKey;
    void load();
    return () => {
      mounted.current = false;
      request.current?.abort();
    };
  }, [load, resourceKey]);

  const refresh = useCallback(async () => {
    if (!mounted.current || currentResourceKey.current !== resourceKey) return;
    setLoading(true);
    setError(null);
    await load();
  }, [load, resourceKey]);

  // Never expose the previous search/cursor's rows while the next request starts.
  const current = settledKey === resourceKey;
  return { data: current ? data : null, error: current ? error : null, loading: loading || !current, refresh };
}

export async function runAdminAction<T = unknown>(action: string, input?: unknown, id?: string) {
  return adminRequest<T>("/api/admin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, input, id }),
  }, "İşlem tamamlanamadı.");
}
