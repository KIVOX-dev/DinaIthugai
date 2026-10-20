import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/shared/i18n";
import { makeT } from "@/lib/i18n/dictionary";
import { AuthShell } from "@/components/forms/AuthShell";
import { ResetForm } from "@/components/forms/AuthForms";

export const metadata: Metadata = { title: "New password", robots: { index: false } };

export default async function Reset({ params, searchParams }: PageProps<"/[lang]/reset-password">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const { token } = (await searchParams) as { token?: string };
  const t = makeT(lang);
  return (
    <AuthShell title={t("auth.reset.title")}>
      <ResetForm lang={lang} token={token ?? ""} />
    </AuthShell>
  );
}
