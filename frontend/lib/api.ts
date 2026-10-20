import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Locale } from "./shared/i18n";
import type { Principal } from "./types";

export const BACKEND_URL = (process.env.BACKEND_URL ?? "http://localhost:4000").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
  }
}

/** Server-side GET against the backend, forwarding the visitor's session cookie. Never cached. */
export async function apiGet<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T> {
  const qs = query ? "?" + new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)])).toString() : "";
  const jar = await cookies();
  const cookie = jar.getAll().map((c) => `${c.name}=${encodeURIComponent(c.value)}`).join("; ");
  const res = await fetch(`${BACKEND_URL}/api${path}${qs}`, { cache: "no-store", headers: cookie ? { cookie } : {} });
  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {}
    throw new ApiError(res.status, (body as { error?: string })?.error ?? res.statusText, body);
  }
  return (await res.json()) as T;
}

/** Like apiGet but returns null for 404 (use with notFound()). */
export async function apiGetOrNull<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T | null> {
  try {
    return await apiGet<T>(path, query);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) return null;
    throw e;
  }
}

export async function getCurrentUser(): Promise<Principal | null> {
  const jar = await cookies();
  if (!jar.get(process.env.SESSION_COOKIE ?? "di_session")) return null;
  try {
    return (await apiGet<{ user: Principal | null }>("/auth/me")).user;
  } catch {
    return null;
  }
}

/** Page guard: send anonymous visitors to the login page, returning here afterwards. */
export async function requireUserPage(lang: Locale, next: string): Promise<Principal> {
  const u = await getCurrentUser();
  if (!u) redirect(`/${lang}/login?next=${encodeURIComponent(next)}`);
  return u;
}
