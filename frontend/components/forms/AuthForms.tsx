"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import type { Locale } from "@/lib/shared/i18n";
import { makeT, msg, type DictKey } from "@/lib/i18n/dictionary";
import { api, type ApiResult } from "@/lib/client-api";
import { buttonPrimary, FormAlert, SelectField, TextField } from "./Field";

type Errors = Record<string, string>;

function useForm(lang: Locale) {
  const t = makeT(lang);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [top, setTop] = useState<string | null>(null);
  const fail = (r: Extract<ApiResult, { ok: false }>) => {
    setErrors(r.fieldErrors ?? {});
    const key: Record<string, DictKey> = { rate_limited: "err.rate_limited", locked: "err.locked", network: "common.something_wrong" };
    setTop(r.code && key[r.code] ? t(key[r.code]) : r.error || t("err.generic"));
  };
  return { t, busy, setBusy, errors, setErrors, top, setTop, fail };
}

const val = (fd: FormData, k: string) => String(fd.get(k) ?? "");

/* -------------------------------- login -------------------------------- */
export function LoginForm({ lang, next, notice }: { lang: Locale; next?: string; notice?: "registered" | "reset" }) {
  const f = useForm(lang);
  const router = useRouter();
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    f.setBusy(true);
    f.setTop(null);
    f.setErrors({});
    const fd = new FormData(e.currentTarget);
    const r = await api<{ user: { role: string } }>("/auth/login", { body: { email: val(fd, "email"), password: val(fd, "password") } });
    f.setBusy(false);
    if (!r.ok) return f.fail(r);
    const staff = ["reporter", "editor", "admin", "super_admin"].includes(r.data.user.role);
    const safe = next && /^\/(?!\/)[\w\-./%?=&]*$/.test(next) ? next : null;
    router.push(safe ?? (staff ? "/admin" : `/${lang}/account`));
    router.refresh();
  }
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {notice === "registered" && <FormAlert kind="ok">{f.t("auth.register.done")}</FormAlert>}
      {notice === "reset" && <FormAlert kind="ok">{f.t("auth.reset.done")}</FormAlert>}
      {f.top && <FormAlert>{f.top}</FormAlert>}
      <TextField id="email" lang={lang} label={f.t("form.email")} type="email" autoComplete="email" required error={f.errors.email} />
      <TextField id="password" lang={lang} label={f.t("form.password")} type="password" autoComplete="current-password" required error={f.errors.password} />
      <div className="flex items-center justify-between">
        <button className={buttonPrimary} disabled={f.busy}>
          {f.busy ? f.t("common.loading") : f.t("auth.login.submit")}
        </button>
        <Link href={`/${lang}/forgot-password`} className="text-sm text-brand">
          {f.t("auth.login.forgot")}
        </Link>
      </div>
      <p className="text-sm text-ink2">
        {f.t("auth.login.no_account")}{" "}
        <Link href={`/${lang}/register`} className="font-bold text-brand">
          {f.t("nav.register")}
        </Link>
      </p>
    </form>
  );
}

/* ------------------------------- register ------------------------------ */
const CODES = [
  ["+91", "India (+91)"],
  ["+1", "USA / Canada (+1)"],
  ["+44", "United Kingdom (+44)"],
  ["+65", "Singapore (+65)"],
  ["+60", "Malaysia (+60)"],
  ["+94", "Sri Lanka (+94)"],
  ["+971", "UAE (+971)"],
  ["+61", "Australia (+61)"],
] as const;

export function RegisterForm({ lang, open }: { lang: Locale; open: boolean }) {
  const f = useForm(lang);
  const router = useRouter();
  if (!open) return <FormAlert>{f.t("auth.register.closed")}</FormAlert>;
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    f.setBusy(true);
    f.setTop(null);
    f.setErrors({});
    const fd = new FormData(e.currentTarget);
    const body = {
      name: val(fd, "name"),
      email: val(fd, "email"),
      phone: { countryCode: val(fd, "countryCode"), number: val(fd, "phoneNumber") },
      gender: val(fd, "gender"),
      address: { line1: val(fd, "line1"), line2: val(fd, "line2"), city: val(fd, "city"), district: val(fd, "district"), state: val(fd, "state"), postalCode: val(fd, "postalCode"), country: val(fd, "country") },
      password: val(fd, "password"),
      passwordConfirm: val(fd, "passwordConfirm"),
      acceptTerms: fd.get("acceptTerms") === "on",
      language: lang,
    };
    const r = await api("/auth/register", { body });
    f.setBusy(false);
    if (!r.ok) {
      const fe = { ...(r.fieldErrors ?? {}) };
      // The API reports the combined phone value; show it on the number field.
      if (fe.phone || fe["phone.number"] || fe["phone.countryCode"]) fe.phoneNumber = fe.phone ?? fe["phone.number"] ?? fe["phone.countryCode"];
      return f.fail({ ...r, fieldErrors: fe });
    }
    router.push(`/${lang}/login?registered=1`);
  }
  const e = f.errors;
  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {f.top && <FormAlert>{f.top}</FormAlert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="name" lang={lang} label={f.t("form.name")} autoComplete="name" required error={e.name} />
        <TextField id="email" lang={lang} label={f.t("form.email")} type="email" autoComplete="email" required error={e.email} />
      </div>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,12rem)_1fr]">
        <SelectField id="countryCode" lang={lang} label={f.t("form.country_code")} defaultValue="+91">
          {CODES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </SelectField>
        <TextField id="phoneNumber" lang={lang} label={f.t("form.phone")} type="tel" inputMode="tel" autoComplete="tel-national" required error={e.phoneNumber} />
      </div>
      <SelectField id="gender" lang={lang} label={f.t("form.gender")} defaultValue="prefer_not_to_say" optional={f.t("common.optional")}>
        {(["prefer_not_to_say", "female", "male", "non_binary"] as const).map((g) => (
          <option key={g} value={g}>
            {f.t(`form.gender.${g}` as DictKey)}
          </option>
        ))}
      </SelectField>

      <fieldset className="space-y-4 rounded border border-rule p-4">
        <legend className="px-2 font-bold">{f.t("form.address")}</legend>
        <TextField id="line1" lang={lang} label={f.t("form.address1")} autoComplete="address-line1" required error={e["address.line1"]} />
        <TextField id="line2" lang={lang} label={f.t("form.address2")} autoComplete="address-line2" optional={f.t("common.optional")} error={e["address.line2"]} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id="city" lang={lang} label={f.t("form.city")} autoComplete="address-level2" required error={e["address.city"]} />
          <TextField id="district" lang={lang} label={f.t("form.district")} optional={f.t("common.optional")} error={e["address.district"]} />
          <TextField id="state" lang={lang} label={f.t("form.state")} autoComplete="address-level1" defaultValue="Tamil Nadu" required error={e["address.state"]} />
          <TextField id="postalCode" lang={lang} label={f.t("form.postal")} autoComplete="postal-code" inputMode="numeric" required error={e["address.postalCode"]} />
        </div>
        <TextField id="country" lang={lang} label={f.t("form.country")} autoComplete="country-name" defaultValue="India" required error={e["address.country"]} />
        <p className="text-xs text-ink3">{f.t("form.privacy_note")}</p>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="password" lang={lang} label={f.t("form.password")} type="password" autoComplete="new-password" required hint={f.t("auth.password_hint")} error={e.password} />
        <TextField id="passwordConfirm" lang={lang} label={f.t("form.password_confirm")} type="password" autoComplete="new-password" required error={e.passwordConfirm} />
      </div>

      <div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="acceptTerms" className="mt-1 h-4 w-4" aria-invalid={e.acceptTerms ? true : undefined} />
          <span>
            {f.t("form.accept", { privacy: "§P", terms: "§T" })
              .split(/(§P|§T)/)
              .map((part, i) =>
                part === "§P" ? (
                  <Link key={i} href={`/${lang}/privacy`} target="_blank" className="text-brand underline">
                    {f.t("footer.privacy")}
                  </Link>
                ) : part === "§T" ? (
                  <Link key={i} href={`/${lang}/terms`} target="_blank" className="text-brand underline">
                    {f.t("footer.terms")}
                  </Link>
                ) : (
                  <span key={i}>{part}</span>
                ),
              )}
          </span>
        </label>
        {e.acceptTerms && <p role="alert" className="mt-1 text-sm font-medium text-accent">{msg(lang, e.acceptTerms)}</p>}
      </div>

      <div className="flex items-center gap-4">
        <button className={buttonPrimary} disabled={f.busy}>
          {f.busy ? f.t("common.loading") : f.t("auth.register.submit")}
        </button>
        <span className="text-sm text-ink2">
          {f.t("auth.register.have_account")}{" "}
          <Link href={`/${lang}/login`} className="font-bold text-brand">
            {f.t("nav.login")}
          </Link>
        </span>
      </div>
    </form>
  );
}

/* ---------------------------- forgot / reset ---------------------------- */
export function ForgotForm({ lang }: { lang: Locale }) {
  const f = useForm(lang);
  const [sent, setSent] = useState(false);
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    f.setBusy(true);
    f.setTop(null);
    const r = await api("/auth/forgot-password", { body: { email: val(new FormData(e.currentTarget), "email") } });
    f.setBusy(false);
    if (!r.ok) return f.fail(r);
    setSent(true);
  }
  if (sent) return <FormAlert kind="ok">{f.t("auth.forgot.sent")}</FormAlert>;
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {f.top && <FormAlert>{f.top}</FormAlert>}
      <TextField id="email" lang={lang} label={f.t("form.email")} type="email" autoComplete="email" required />
      <button className={buttonPrimary} disabled={f.busy}>
        {f.busy ? f.t("common.loading") : f.t("auth.forgot.submit")}
      </button>
    </form>
  );
}

export function ResetForm({ lang, token }: { lang: Locale; token: string }) {
  const f = useForm(lang);
  const router = useRouter();
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    f.setBusy(true);
    f.setTop(null);
    f.setErrors({});
    const fd = new FormData(e.currentTarget);
    const r = await api("/auth/reset-password", { body: { token, password: val(fd, "password"), passwordConfirm: val(fd, "passwordConfirm") } });
    f.setBusy(false);
    if (!r.ok) return f.fail(r);
    router.push(`/${lang}/login?reset=1`);
  }
  if (!token) return <FormAlert>{f.t("auth.verify.fail")}</FormAlert>;
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {f.top && <FormAlert>{f.top}</FormAlert>}
      <TextField id="password" lang={lang} label={f.t("form.password")} type="password" autoComplete="new-password" required hint={f.t("auth.password_hint")} error={f.errors.password} />
      <TextField id="passwordConfirm" lang={lang} label={f.t("form.password_confirm")} type="password" autoComplete="new-password" required error={f.errors.passwordConfirm} />
      <button className={buttonPrimary} disabled={f.busy}>
        {f.busy ? f.t("common.loading") : f.t("auth.reset.submit")}
      </button>
    </form>
  );
}

/* ------------------------------ verify email ----------------------------- */
// One request per token even if React runs the effect twice (dev strict mode): verification tokens are single-use.
const verifying = new Map<string, Promise<boolean>>();

export function VerifyEmail({ lang, token }: { lang: Locale; token: string }) {
  const t = makeT(lang);
  const [state, setState] = useState<"working" | "ok" | "fail">(token ? "working" : "fail");
  useEffect(() => {
    if (!token) return;
    let alive = true;
    let p = verifying.get(token);
    if (!p) {
      p = api("/auth/verify-email", { body: { token } }).then((r) => r.ok);
      verifying.set(token, p);
    }
    p.then((ok) => alive && setState(ok ? "ok" : "fail"));
    return () => {
      alive = false;
    };
  }, [token]);
  if (state === "working") return <p>{t("common.loading")}</p>;
  return (
    <div className="space-y-4">
      <FormAlert kind={state === "ok" ? "ok" : "error"}>{state === "ok" ? t("auth.verify.ok") : t("auth.verify.fail")}</FormAlert>
      <Link href={`/${lang}/${state === "ok" ? "account/submit" : "login"}`} className={`${buttonPrimary} inline-block no-underline`}>
        {state === "ok" ? t("nav.submit") : t("nav.login")}
      </Link>
    </div>
  );
}
