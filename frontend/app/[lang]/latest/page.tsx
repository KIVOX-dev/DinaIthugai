import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/shared/i18n";
import { apiGet } from "@/lib/api";
import type { ArticleCard, Paged } from "@/lib/types";
import { makeT } from "@/lib/i18n/dictionary";
import { FeedList, PageShell } from "@/components/site/FeedList";
import { Pagination } from "@/components/ui/Pagination";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[lang]/latest">): Promise<Metadata> {
  const { lang } = await params;
  return { title: isLocale(lang) ? makeT(lang)("nav.latest") : undefined };
}

export default async function Latest({ params, searchParams }: PageProps<"/[lang]/latest">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const { page } = (await searchParams) as { page?: string };
  const d = await apiGet<Paged<ArticleCard>>("/public/latest", { lang, page });
  const t = makeT(lang);
  return (
    <PageShell title={t("home.latest")} sub={t("common.results", { n: d.total })}>
      <FeedList items={d.items} lang={lang} />
      <Pagination lang={lang} page={d.page} pages={d.pages} href={(p) => `/${lang}/latest?page=${p}`} />
    </PageShell>
  );
}
