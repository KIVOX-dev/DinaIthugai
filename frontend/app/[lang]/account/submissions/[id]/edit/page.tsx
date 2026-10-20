import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/shared/i18n";
import { ApiError, apiGet, requireUserPage } from "@/lib/api";
import type { EditArticle, SiteData } from "@/lib/types";
import { makeT } from "@/lib/i18n/dictionary";
import { ArticleEditor } from "@/components/editor/ArticleEditor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit submission", robots: { index: false } };

export default async function EditSubmission({ params }: PageProps<"/[lang]/account/submissions/[id]/edit">) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound();
  await requireUserPage(lang, `/${lang}/account/submissions/${id}/edit`);
  let a: EditArticle;
  try {
    a = (await apiGet<{ article: EditArticle }>(`/articles/${id}`)).article;
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) notFound();
    throw e;
  }
  const site = await apiGet<SiteData>("/public/site", { lang });
  const t = makeT(lang);
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="headline mb-4 text-3xl">{t("subs.edit")}</h1>
      <ArticleEditor lang={lang} initial={a} tree={site.tree} maxImages={site.settings.maxImages} minWords={site.settings.minWords} afterSubmitHref={`/${lang}/account/submissions/{id}?submitted=1`} basePath={`/${lang}/account/submissions/{id}/edit`} />
    </div>
  );
}
