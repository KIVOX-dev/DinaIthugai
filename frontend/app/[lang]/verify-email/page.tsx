import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/shared/i18n";
import { makeT } from "@/lib/i18n/dictionary";
import { AuthShell } from "@/components/forms/AuthShell";
import { VerifyEmail } from "@/components/forms/AuthForms";

export const metadata: Metadata = { title: "Verify email", robots: { index: false } };

export default async function Verify({ params, searchParams }: PageProps<"/[lang]/verify-email">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const { token } = (await searchParams) as { token?: string };
  const t = makeT(lang);
  return (
    <AuthShell title={t("auth.verify.title")}>
      <VerifyEmail lang={lang} token={token ?? ""} />
    </AuthShell>
  );
}
