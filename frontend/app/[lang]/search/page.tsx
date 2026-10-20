import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/shared/i18n";
import { apiGet } from "@/lib/api";
import type { ArticleCard, Paged, SiteData } from "@/lib/types";
import { makeT } from "@/lib/i18n/dictionary";
import { FeedList, PageShell } from "@/components/site/FeedList";
import { Pagination } from "@/components/ui/Pagination";
import { SearchBox } from "@/components/site/SearchBox";

export const dynamic = "force-dynamic";
type Sp = { q?: string; category?: string; tag?: string; sort?: string; page?: string };

export async function generateMetadata({ params }: PageProps<"/[lang]/search">): Promise<Metadata> {
  const { lang } = await params;
  // Search result pages are not indexed (avoids thin/duplicate content).
  return { title: isLocale(lang) ? makeT(lang)("search.title") : undefined, robots: { index: false, follow: true } };
}

export default async function Search({ params, searchParams }: PageProps<"/[lang]/search">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const sp = (await searchParams) as Sp;
  const [res, site] = await Promise.all([
    apiGet<Paged<ArticleCard> & { mode?: string }>("/public/search", { lang, q: sp.q, category: sp.category, tag: sp.tag, sort: sp.sort, page: sp.page }),
    apiGet<SiteData>("/public/site", { lang }),
  ]);
  const t = makeT(lang);
  const q = sp.q?.trim();
  const qs = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ q: sp.q, category: sp.category, tag: sp.tag, sort: sp.sort, ...over })) if (v) p.set(k, v);
    return `/${lang}/search?${p}`;
  };
  return (
    <PageShell title={t("search.title")} sub={q ? t("common.results", { n: res.total }) : undefined}>
      <div className="mb-5 max-w-2xl">
        <SearchBox lang={lang} placeholder={t("search.placeholder")} label={t("nav.search")} initial={q ?? ""} live />
      </div>
      <div className="mb-5 flex flex-wrap items-center gap-2 text-sm">
        <span className="font-bold">{t("search.all_categories")}:</span>
        <Link href={qs({ category: undefined, page: undefined })} aria-current={!sp.category ? "true" : undefined} className={`rounded-full border px-3 py-1 no-underline ${!sp.category ? "border-brand bg-brand text-brand-ink" : "border-rule hover:bg-paper2"}`}>
          {t("subs.all")}
        </Link>
        {site.tree.map((c) => (
          <Link key={c.slug} href={qs({ category: c.slug, page: undefined })} aria-current={sp.category === c.slug ? "true" : undefined} className={`rounded-full border px-3 py-1 no-underline ${sp.category === c.slug ? "border-brand bg-brand text-brand-ink" : "border-rule hover:bg-paper2"}`}>
            {c.name[lang]}
          </Link>
        ))}
        <span className="mx-2 hidden h-5 w-px bg-rule sm:block" aria-hidden="true" />
        {(["relevance", "latest", "popular"] as const).map((s) => (
          <Link key={s} href={qs({ sort: s, page: undefined })} aria-current={(sp.sort ?? "relevance") === s ? "true" : undefined} className={`rounded border px-3 py-1 no-underline ${(sp.sort ?? "relevance") === s ? "border-ink bg-ink text-paper" : "border-rule hover:bg-paper2"}`}>
            {t(s === "relevance" ? "common.sort_relevance" : s === "latest" ? "common.sort_latest" : "common.sort_popular")}
          </Link>
        ))}
      </div>
      {q && res.mode === "substring" && res.total > 0 && <p className="mb-3 text-sm text-ink3">{t("search.mode_substring")}</p>}
      {q && res.total === 0 ? (
        <div className="rounded border border-rule bg-paper2 p-8 text-center">
          <p className="headline text-xl">{t("search.no_results", { q })}</p>
          <p className="mt-1 text-ink2">{t("search.try")}</p>
        </div>
      ) : (
        <FeedList items={res.items} lang={lang} />
      )}
      <Pagination lang={lang} page={res.page} pages={res.pages} href={(p) => qs({ page: String(p) })} />
    </PageShell>
  );
}
