import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/shared/i18n";
import { apiGet, requireUserPage } from "@/lib/api";
import type { SiteData } from "@/lib/types";
import { makeT } from "@/lib/i18n/dictionary";
import { ArticleEditor } from "@/components/editor/ArticleEditor";
import { FormAlert } from "@/components/forms/Field";
import { ResendVerification } from "@/components/account/AccountClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Submit an article", robots: { index: false } };

export default async function Submit({ params }: PageProps<"/[lang]/account/submit">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const user = await requireUserPage(lang, `/${lang}/account/submit`);
  const site = await apiGet<SiteData>("/public/site", { lang });
  const t = makeT(lang);
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="headline text-3xl">{t("submit.title")}</h1>
      <p className="mb-4 mt-1 text-ink2">{t("submit.sub")}</p>
      {site.settings.submissionRules?.[lang] && <p className="mb-4 rounded border border-rule bg-paper2 p-3 text-sm">{site.settings.submissionRules[lang]}</p>}
      {!site.settings.submissionsEnabled ? (
        <FormAlert>{t("submit.closed")}</FormAlert>
      ) : (
        <>
          {!user.emailVerified && (
            <div className="mb-4 space-y-2 rounded border border-warn bg-paper2 p-3">
              <p className="font-bold">{t("submit.verify_first")}</p>
              <ResendVerification lang={lang} />
            </div>
          )}
          <ArticleEditor lang={lang} initial={null} tree={site.tree} maxImages={site.settings.maxImages} minWords={site.settings.minWords} afterSubmitHref={`/${lang}/account/submissions/{id}?submitted=1`} basePath={`/${lang}/account/submissions/{id}/edit`} />
        </>
      )}
      <p className="mt-6 text-sm">
        <Link href={`/${lang}/account/submissions`} className="text-brand underline">
          {t("subs.title")}
        </Link>
      </p>
    </div>
  );
}
