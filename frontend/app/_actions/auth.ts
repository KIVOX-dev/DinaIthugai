"use server";
import { redirect } from "next/navigation";
import { clearSessionCookie, getCurrentUser, getSessionToken, requestContext, setSessionCookie } from "@/backend/auth/current-user";
import { run, formToObject, type ActionResult } from "@/backend/actions";
import { login, logout, registerUser, requestPasswordReset, resendVerification, resetPassword } from "@/backend/services/auth";
import { isStaff } from "@/shared/permissions";
import { isLocale, type Locale } from "@/shared/i18n";

const lang = (v: unknown): Locale => (typeof v === "string" && isLocale(v) ? v : "ta");

function safeNext(next: unknown, l: Locale) {
  if (typeof next === "string" && /^\/(?!\/)[\w\-./%?=&]*$/.test(next) && !next.includes("..")) return next;
  return null;
}

export async function loginAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const o = formToObject(fd);
  const l = lang(o.lang);
  const res = await run(async () => {
    const ctx = await requestContext();
    const { token, expiresAt, principal } = await login({ email: o.email, password: o.password }, ctx);
    await setSessionCookie(token, expiresAt);
    return principal;
  });
  if (!res.ok) return res;
  const next = safeNext(o.next, l);
  redirect(next ?? (isStaff(res.data!) && !o.next ? "/admin" : `/${l}/account`));
}

export async function registerAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const o = formToObject(fd);
  const l = lang(o.lang);
  const res = await run(async () => {
    const ctx = await requestContext();
    return registerUser(
      { ...o, acceptTerms: o.acceptTerms === "on" ? true : false, language: l },
      ctx,
    );
  });
  if (!res.ok) return res;
  redirect(`/${l}/login?registered=1`);
}

export async function logoutAction(fd: FormData) {
  const l = lang(fd.get("lang"));
  await logout(await getSessionToken());
  await clearSessionCookie();
  redirect(`/${l}`);
}

export async function forgotAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const o = formToObject(fd);
  return run(async () => {
    const ctx = await requestContext();
    await requestPasswordReset(String(o.email ?? ""), ctx);
  });
}

export async function resetAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const o = formToObject(fd);
  const l = lang(o.lang);
  const res = await run(() => resetPassword(o));
  if (!res.ok) return res;
  redirect(`/${l}/login?reset=1`);
}

export async function resendVerificationAction(): Promise<ActionResult> {
  const u = await getCurrentUser();
  if (!u) return { ok: false, error: "Sign in first.", code: "err.unauthorized" };
  return run(() => resendVerification(u.email));
}
