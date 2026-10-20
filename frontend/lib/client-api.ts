"use client";

export type ApiResult<T = unknown> = { ok: true; data: T } | { ok: false; status: number; error: string; code?: string; fieldErrors?: Record<string, string> };

/** Browser → /api/* (proxied to the backend by Next rewrites, so the session cookie stays first-party). */
export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown; form?: FormData } = {}): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`/api${path}`, {
      method: init.method ?? (init.body || init.form ? "POST" : "GET"),
      credentials: "same-origin",
      headers: init.form ? undefined : init.body ? { "content-type": "application/json" } : undefined,
      body: init.form ?? (init.body ? JSON.stringify(init.body) : undefined),
    });
    const text = await res.text();
    const json = text ? JSON.parse(text) : {};
    if (!res.ok) return { ok: false, status: res.status, error: json.error ?? res.statusText, code: json.code, fieldErrors: json.fieldErrors };
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, status: 0, error: "Network error", code: "network" };
  }
}
