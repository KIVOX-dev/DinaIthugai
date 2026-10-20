"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { Locale } from "@/lib/shared/i18n";
import { makeT, type DictKey } from "@/lib/i18n/dictionary";
import { api } from "@/lib/client-api";
import { buttonPrimary, FormAlert, SelectField, TextArea, TextField } from "@/components/forms/Field";

export function ResendVerification({ lang }: { lang: Locale }) {
  const t = makeT(lang);
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  return state === "sent" ? (
    <FormAlert kind="ok">{t("auth.verify.sent")}</FormAlert>
  ) : (
    <button
      type="button"
      disabled={state === "busy"}
      className="rounded border border-brand px-3 py-1.5 text-sm font-bold text-brand hover:bg-paper"
      onClick={async () => {
        setState("busy");
        await api("/auth/resend-verification", { method: "POST", body: {} });
        setState("sent");
      }}
    >
      {t("auth.verify.resend")}
    </button>
  );
}

export function DeleteDraft({ lang, id }: { lang: Locale; id: string }) {
  const t = makeT(lang);
  const router = useRouter();
  return (
    <button
      type="button"
      className="rounded border border-accent px-4 py-2 font-bold text-accent hover:bg-accent/10"
      onClick={async () => {
        if (!window.confirm(`${t("common.delete")}?`)) return;
        const r = await api(`/articles/${id}`, { method: "DELETE" });
        if (r.ok) {
          router.push(`/${lang}/account/submissions`);
          router.refresh();
        }
      }}
    >
      {t("common.delete")}
    </button>
  );
}

export function MarkAllRead({ lang }: { lang: Locale }) {
  const t = makeT(lang);
  const router = useRouter();
  return (
    <button
      type="button"
      className="text-sm font-bold text-brand underline"
      onClick={async () => {
        await api("/auth/notifications/read", { method: "POST", body: {} });
        router.refresh();
      }}
    >
      {t("account.notifications.mark")}
    </button>
  );
}

/* ------------------------------- profile -------------------------------- */
type Profile = {
  name: string;
  email: string;
  phone: string;
  gender: string;
  address: { line1: string; line2?: string; city: string; district?: string; state: string; postalCode: string; country: string };
  bio: string;
  preferredLanguage: "ta" | "en";
  notifyInApp: boolean;
  notifyEmail: boolean;
  emailVerified: boolean;
  deletionRequested: boolean;
};

const CODES = ["+91", "+1", "+44", "+65", "+60", "+94", "+971", "+61"];
const splitPhone = (p: string) => {
  const code = [...CODES].sort((a, b) => b.length - a.length).find((c) => p.startsWith(c)) ?? "+91";
  return { code, number: p.slice(code.length) };
};
const val = (fd: FormData, k: string) => String(fd.get(k) ?? "");

export function ProfileForm({ lang, profile }: { lang: Locale; profile: Profile }) {
  const t = makeT(lang);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msgState, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const ph = splitPhone(profile.phone);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setErrors({});
    const fd = new FormData(e.currentTarget);
    const r = await api("/auth/profile", {
      method: "PUT",
      body: {
        name: val(fd, "name"),
        phone: { countryCode: val(fd, "countryCode"), number: val(fd, "phoneNumber") },
        gender: val(fd, "gender"),
        address: { line1: val(fd, "line1"), line2: val(fd, "line2"), city: val(fd, "city"), district: val(fd, "district"), state: val(fd, "state"), postalCode: val(fd, "postalCode"), country: val(fd, "country") },
        bio: val(fd, "bio"),
        preferredLanguage: val(fd, "preferredLanguage"),
        notifyInApp: fd.get("notifyInApp") === "on",
        notifyEmail: fd.get("notifyEmail") === "on",
      },
    });
    setBusy(false);
    if (!r.ok) {
      const fe = { ...(r.fieldErrors ?? {}) };
      if (fe.phone) fe.phoneNumber = fe.phone;
      setErrors(fe);
      return setMsg({ kind: "error", text: r.error });
    }
    setMsg({ kind: "ok", text: t("account.profile.saved") });
    router.refresh();
  }
  const e = errors;
  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {msgState && <FormAlert kind={msgState.kind}>{msgState.text}</FormAlert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="name" lang={lang} label={t("form.name")} defaultValue={profile.name} required error={e.name} />
        <TextField id="emailRO" lang={lang} label={t("form.email")} defaultValue={profile.email} readOnly disabled hint={profile.emailVerified ? "✓" : t("auth.verify.banner")} />
      </div>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,12rem)_1fr]">
        <SelectField id="countryCode" lang={lang} label={t("form.country_code")} defaultValue={ph.code}>
          {CODES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </SelectField>
        <TextField id="phoneNumber" lang={lang} label={t("form.phone")} type="tel" defaultValue={ph.number} required error={e.phoneNumber} />
      </div>
      <SelectField id="gender" lang={lang} label={t("form.gender")} defaultValue={profile.gender}>
        {(["prefer_not_to_say", "female", "male", "non_binary"] as const).map((g) => (
          <option key={g} value={g}>
            {t(`form.gender.${g}` as DictKey)}
          </option>
        ))}
      </SelectField>
      <fieldset className="space-y-4 rounded border border-rule p-4">
        <legend className="px-2 font-bold">{t("form.address")}</legend>
        <TextField id="line1" lang={lang} label={t("form.address1")} defaultValue={profile.address.line1} required error={e["address.line1"]} />
        <TextField id="line2" lang={lang} label={t("form.address2")} defaultValue={profile.address.line2 ?? ""} optional={t("common.optional")} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id="city" lang={lang} label={t("form.city")} defaultValue={profile.address.city} required error={e["address.city"]} />
          <TextField id="district" lang={lang} label={t("form.district")} defaultValue={profile.address.district ?? ""} optional={t("common.optional")} />
          <TextField id="state" lang={lang} label={t("form.state")} defaultValue={profile.address.state} required error={e["address.state"]} />
          <TextField id="postalCode" lang={lang} label={t("form.postal")} defaultValue={profile.address.postalCode} required error={e["address.postalCode"]} />
        </div>
        <TextField id="country" lang={lang} label={t("form.country")} defaultValue={profile.address.country} required error={e["address.country"]} />
        <p className="text-xs text-ink3">{t("form.privacy_note")}</p>
      </fieldset>
      <TextArea id="bio" lang={lang} label={t("form.bio")} optional={t("common.optional")} rows={3} maxLength={600} defaultValue={profile.bio} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField id="preferredLanguage" lang={lang} label={t("form.language")} defaultValue={profile.preferredLanguage}>
          <option value="ta">தமிழ்</option>
          <option value="en">English</option>
        </SelectField>
        <div className="space-y-2 pt-6 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="notifyInApp" defaultChecked={profile.notifyInApp} className="h-4 w-4" /> {t("form.notify_inapp")}
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="notifyEmail" defaultChecked={profile.notifyEmail} className="h-4 w-4" /> {t("form.notify_email")}
          </label>
        </div>
      </div>
      <button className={buttonPrimary} disabled={busy}>
        {busy ? t("common.loading") : t("common.save")}
      </button>
    </form>
  );
}

export function SecurityPanel({ lang, deletionRequested }: { lang: Locale; deletionRequested: boolean }) {
  const t = makeT(lang);
  const router = useRouter();
  const [state, setState] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function change(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setState(null);
    const fd = new FormData(e.currentTarget);
    const r = await api("/auth/change-password", { body: { current: val(fd, "current"), next: val(fd, "next") } });
    setBusy(false);
    if (!r.ok) return setState({ kind: "error", text: r.fieldErrors?.current ? t("v.password_wrong") : r.fieldErrors?.password ? t("v.password_weak") : r.error });
    router.push(`/${lang}/login?reset=1`); // all sessions were revoked
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <form onSubmit={change} className="space-y-4" noValidate>
        <h2 className="headline text-xl">{t("account.change_password")}</h2>
        {state && <FormAlert kind={state.kind}>{state.text}</FormAlert>}
        <TextField id="current" lang={lang} label={t("form.current_password")} type="password" autoComplete="current-password" required />
        <TextField id="next" lang={lang} label={t("form.password")} type="password" autoComplete="new-password" required hint={t("auth.password_hint")} />
        <button className={buttonPrimary} disabled={busy}>
          {t("account.change_password")}
        </button>
      </form>
      <section className="space-y-3 rounded border border-accent/40 p-4">
        <h2 className="headline text-xl text-accent">{t("account.delete")}</h2>
        {deletionRequested ? (
          <>
            <FormAlert kind="ok">{t("account.delete.requested")}</FormAlert>
            <button
              type="button"
              className="rounded border border-brand px-4 py-2 font-bold text-brand"
              onClick={async () => {
                await api("/auth/delete-request", { body: { cancel: true } });
                router.refresh();
              }}
            >
              {t("account.delete.cancel")}
            </button>
          </>
        ) : (
          <button
            type="button"
            className="rounded border border-accent px-4 py-2 font-bold text-accent hover:bg-accent/10"
            onClick={async () => {
              if (!window.confirm(t("account.delete.confirm"))) return;
              await api("/auth/delete-request", { body: {} });
              router.refresh();
            }}
          >
            {t("account.delete")}
          </button>
        )}
      </section>
    </div>
  );
}
