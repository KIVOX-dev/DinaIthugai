import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/shared/i18n";
import { makeT } from "@/lib/i18n/dictionary";
import { AuthShell } from "@/components/forms/AuthShell";
import { ForgotForm } from "@/components/forms/AuthForms";

export const metadata: Metadata = { title: "Reset password", robots: { index: false } };

export default async function Forgot({ params }: PageProps<"/[lang]/forgot-password">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = makeT(lang);
  return (
    <AuthShell title={t("auth.forgot.title")} sub={t("auth.forgot.sub")}>
      <ForgotForm lang={lang} />
    </AuthShell>
  );
}
