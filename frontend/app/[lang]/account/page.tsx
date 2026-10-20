import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/shared/i18n";
import { apiGet, requireUserPage } from "@/lib/api";
import { makeT } from "@/lib/i18n/dictionary";
import { ProfileForm, ResendVerification, SecurityPanel } from "@/components/account/AccountClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My account", robots: { index: false } };

type Profile = Parameters<typeof ProfileForm>[0]["profile"];

export default async function Account({ params }: PageProps<"/[lang]/account">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  await requireUserPage(lang, `/${lang}/account`);
  const { profile } = await apiGet<{ profile: Profile }>("/auth/profile");
  const t = makeT(lang);
  const card = "rounded border border-rule bg-paper p-4 no-underline hover:border-brand hover:bg-paper2";
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="headline text-3xl">{t("nav.account")}</h1>
      <nav aria-label={t("nav.account")} className="my-5 grid gap-3 sm:grid-cols-3">
        <Link href={`/${lang}/account/submit`} className={card}>
          <span className="headline block text-lg">{t("nav.submit")}</span>
          <span className="text-sm text-ink2">{t("submit.sub")}</span>
        </Link>
        <Link href={`/${lang}/account/submissions`} className={card}>
          <span className="headline block text-lg">{t("nav.submissions")}</span>
        </Link>
        <Link href={`/${lang}/account/notifications`} className={card}>
          <span className="headline block text-lg">{t("nav.notifications")}</span>
        </Link>
      </nav>
      {!profile.emailVerified && (
        <div className="mb-6 space-y-2 rounded border border-warn bg-paper2 p-3">
          <p className="font-bold">{t("auth.verify.banner")}</p>
          <ResendVerification lang={lang} />
        </div>
      )}
      <h2 className="headline mb-3 text-2xl">{t("account.profile")}</h2>
      <ProfileForm lang={lang} profile={profile} />
      <h2 className="headline mb-3 mt-10 text-2xl">{t("account.security")}</h2>
      <SecurityPanel lang={lang} deletionRequested={profile.deletionRequested} />
    </div>
  );
}
