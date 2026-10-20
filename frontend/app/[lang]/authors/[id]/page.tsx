import { notFound } from "next/navigation";
import { isLocale } from "@/lib/shared/i18n";
import { apiGetOrNull } from "@/lib/api";
import type { ArticleCard, Paged } from "@/lib/types";
import { makeT } from "@/lib/i18n/dictionary";
import { FeedList, PageShell } from "@/components/site/FeedList";
import { Pagination } from "@/components/ui/Pagination";

export const dynamic = "force-dynamic";

export default async function Author({ params, searchParams }: PageProps<"/[lang]/authors/[id]">) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound();
  const { page } = (await searchParams) as { page?: string };
  const d = await apiGetOrNull<Paged<ArticleCard> & { author: { name: string; bio?: string } }>(`/public/authors/${encodeURIComponent(id)}`, { lang, page });
  if (!d) notFound();
  const t = makeT(lang);
  return (
    <PageShell title={d.author.name} sub={d.author.bio ?? t("authors.title")}>
      <FeedList items={d.items} lang={lang} />
      <Pagination lang={lang} page={d.page} pages={d.pages} href={(p) => `/${lang}/authors/${id}?page=${p}`} />
    </PageShell>
  );
}
