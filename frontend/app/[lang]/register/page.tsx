import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/shared/i18n";
import { apiGet, getCurrentUser } from "@/lib/api";
import type { SiteData } from "@/lib/types";
import { makeT } from "@/lib/i18n/dictionary";
import { AuthShell } from "@/components/forms/AuthShell";
import { RegisterForm } from "@/components/forms/AuthForms";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Register", robots: { index: false } };

export default async function Register({ params }: PageProps<"/[lang]/register">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  if (await getCurrentUser()) redirect(`/${lang}/account`);
  const site = await apiGet<SiteData>("/public/site", { lang });
  const t = makeT(lang);
  return (
    <AuthShell title={t("auth.register.title")} sub={t("auth.register.sub")} wide>
      <RegisterForm lang={lang} open={site.settings.registrationOpen} />
    </AuthShell>
  );
}
