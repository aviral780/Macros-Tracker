"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export async function api<T = unknown>(url: string, init?: Omit<RequestInit, "body"> & { body?: unknown }): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}

/** Fetches JSON and keeps showing the previous data while a new URL loads. */
export function useData<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const latest = useRef(url);

  useEffect(() => {
    latest.current = url;
    if (!url) return;
    let live = true;
    api<T>(url)
      .then((d) => {
        if (!live) return;
        setData(d);
        setError(null);
      })
      .catch((e) => live && setError(e instanceof Error ? e.message : "Couldn't load"))
      .finally(() => live && setLoadedUrl(url));
    return () => {
      live = false;
    };
  }, [url]);

  const reload = useCallback(async () => {
    const u = url;
    if (!u) return;
    try {
      const d = await api<T>(u);
      if (latest.current === u) {
        setData(d);
        setError(null);
      }
    } catch (e) {
      if (latest.current === u) setError(e instanceof Error ? e.message : "Couldn't load");
    }
  }, [url]);

  return { data, setData, error, loading: !!url && loadedUrl !== url, reload };
}
