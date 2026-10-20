import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/shared/i18n";
import { apiGetOrNull } from "@/lib/api";
import type { ArticleCard } from "@/lib/types";
import { makeT } from "@/lib/i18n/dictionary";
import { FeedList } from "@/components/site/FeedList";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Pagination } from "@/components/ui/Pagination";

type Data = {
  category: { slug: string; name: string; description?: string };
  parent?: { slug: string; name: string };
  children: { slug: string; name: string }[];
  items: ArticleCard[];
  total: number;
  page: number;
  pages: number;
};
export const dynamic = "force-dynamic";

const load = (lang: string, slug: string, q: { page?: string; sort?: string }) =>
  isLocale(lang) ? apiGetOrNull<Data>(`/public/category/${encodeURIComponent(slug)}`, { lang, page: q.page, sort: q.sort }) : Promise.resolve(null);

export async function generateMetadata({ params, searchParams }: PageProps<"/[lang]/[category]">): Promise<Metadata> {
  const { lang, category } = await params;
  const d = await load(lang, category, await searchParams as { page?: string });
  if (!d) return {};
  return { title: d.category.name, description: d.category.description, alternates: { canonical: `/${lang}/${category}`, languages: { ta: `/ta/${category}`, en: `/en/${category}` } } };
}

export default async function CategoryPage({ params, searchParams }: PageProps<"/[lang]/[category]">) {
  const { lang, category } = await params;
  if (!isLocale(lang)) notFound();
  const sp = (await searchParams) as { page?: string; sort?: string };
  const d = await load(lang, category, sp);
  if (!d) notFound();
  const t = makeT(lang);
  const sort = sp.sort === "popular" ? "popular" : "latest";
  const href = (p: number) => `/${lang}/${category}?${new URLSearchParams({ ...(sort === "popular" ? { sort } : {}), page: String(p) })}`;
  return (
    <div className="mx-auto max-w-[1500px] px-4 py-6 2xl:max-w-[1800px]">
      <Breadcrumbs items={[{ href: `/${lang}`, label: t("nav.home") }, ...(d.parent ? [{ href: `/${lang}/${d.parent.slug}`, label: d.parent.name }] : []), { label: d.category.name }]} />
      <header className="mb-5 border-b-2 border-ink pb-3">
        <h1 className="headline text-3xl sm:text-4xl">{d.category.name}</h1>
        {d.category.description && <p className="mt-1 text-ink2">{d.category.description}</p>}
        {d.children.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {d.children.map((c) => (
              <li key={c.slug}>
                <Link href={`/${lang}/${c.slug}`} className="block rounded-full border border-rule px-4 py-1 text-sm no-underline hover:border-brand hover:text-brand">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </header>
      <div className="mb-4 flex items-center justify-between text-sm">
        <span className="text-ink3">{t("common.results", { n: d.total })}</span>
        <nav aria-label={t("common.sort")} className="flex gap-1">
          {(["latest", "popular"] as const).map((s) => (
            <Link key={s} href={`/${lang}/${category}${s === "popular" ? "?sort=popular" : ""}`} aria-current={sort === s ? "true" : undefined} className={`rounded border px-3 py-1 no-underline ${sort === s ? "border-brand bg-brand text-brand-ink" : "border-rule hover:bg-paper2"}`}>
              {t(s === "latest" ? "common.sort_latest" : "common.sort_popular")}
            </Link>
          ))}
        </nav>
      </div>
      <FeedList items={d.items} lang={lang} />
      <Pagination lang={lang} page={d.page} pages={d.pages} href={href} />
    </div>
  );
}
