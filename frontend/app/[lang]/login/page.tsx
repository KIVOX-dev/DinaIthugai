import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/shared/i18n";
import { apiGet, getCurrentUser } from "@/lib/api";
import type { SiteData } from "@/lib/types";
import { makeT } from "@/lib/i18n/dictionary";
import { AuthShell } from "@/components/forms/AuthShell";
import { LoginForm } from "@/components/forms/AuthForms";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function Login({ params, searchParams }: PageProps<"/[lang]/login">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const sp = (await searchParams) as { next?: string; registered?: string; reset?: string };
  if (await getCurrentUser()) redirect(`/${lang}/account`);
  const t = makeT(lang);
  const { settings } = await apiGet<SiteData>("/public/site", { lang });
  return (
    <AuthShell title={t("auth.login.title")} sub={t("auth.login.sub")}>
      <LoginForm lang={lang} next={sp.next} emailEnabled={settings.emailEnabled} notice={sp.registered ? "registered" : sp.reset ? "reset" : undefined} />
    </AuthShell>
  );
}
