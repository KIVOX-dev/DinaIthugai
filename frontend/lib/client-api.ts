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

export type UploadedMedia = { id: string; url: string; thumb: string; caption: { ta?: string; en?: string }; credit?: string };

/** Multipart upload with progress (fetch has no upload-progress events, so XHR is used). */
export function uploadFile(file: File, onProgress?: (pct: number) => void, meta?: Record<string, string>): Promise<ApiResult<{ media: UploadedMedia }>> {
  return new Promise((resolve) => {
    const fd = new FormData();
    fd.append("file", file);
    for (const [k, v] of Object.entries(meta ?? {})) if (v) fd.append(k, v);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/media");
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onerror = () => resolve({ ok: false, status: 0, error: "Network error", code: "network" });
    xhr.onload = () => {
      let json: Record<string, unknown> = {};
      try {
        json = JSON.parse(xhr.responseText || "{}");
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300) resolve({ ok: true, data: json as { media: UploadedMedia } });
      else resolve({ ok: false, status: xhr.status, error: String(json.error ?? "Upload failed"), code: json.code as string | undefined, fieldErrors: json.fieldErrors as Record<string, string> | undefined });
    };
    xhr.send(fd);
  });
}
