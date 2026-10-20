import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { isLocale, otherLocale } from "@/lib/shared/i18n";
import { apiGetOrNull } from "@/lib/api";
import { articleHref, type ArticleCard, type ArticleView } from "@/lib/types";
import { formatDate, makeT } from "@/lib/i18n/dictionary";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { CompactItem, StoryCard } from "@/components/site/Cards";
import { ShareButtons, ViewCounter } from "@/components/site/ArticleClient";

type Data = { view: ArticleView; related: ArticleCard[]; prev?: ArticleCard; next?: ArticleCard };
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
export const dynamic = "force-dynamic";

async function load(lang: string, slug: string) {
  if (!isLocale(lang)) return null;
  return apiGetOrNull<Data>(`/public/article/${encodeURIComponent(slug)}`, { lang });
}

export async function generateMetadata({ params }: PageProps<"/[lang]/news/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  const d = await load(lang, decodeURIComponent(slug));
  if (!d) return {};
  const { view } = d;
  const c = view.card;
  const languages: Record<string, string> = {};
  if (c.slugs.ta) languages.ta = articleHref("ta", c.slugs.ta);
  if (c.slugs.en) languages.en = articleHref("en", c.slugs.en);
  return {
    title: view.seo.title,
    description: view.seo.description,
    alternates: { canonical: view.seo.canonical ?? articleHref(view.language, c.slug), languages },
    openGraph: { type: "article", title: view.seo.title, description: view.seo.description, publishedTime: view.publishedAt, modifiedTime: view.updatedAt, images: c.image ? [`${SITE}${c.image.src}`] : undefined },
    twitter: { card: "summary_large_image" },
  };
}

export default async function ArticlePage({ params }: PageProps<"/[lang]/news/[slug]">) {
  const { lang, slug: raw } = await params;
  if (!isLocale(lang)) notFound();
  const slug = decodeURIComponent(raw);
  const d = await load(lang, slug);
  if (!d) notFound();
  const { view, related, prev, next } = d;
  const c = view.card;
  // Canonicalise: /en/news/<ta-slug> -> the English slug when it exists, so the language toggle always lands on the right URL.
  const canon = c.slugs[lang];
  if (canon && canon !== slug) permanentRedirect(articleHref(lang, canon));
  const t = makeT(lang);
  const other = otherLocale(lang);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: c.title,
    description: view.seo.description,
    inLanguage: view.language,
    datePublished: view.publishedAt,
    dateModified: view.updatedAt,
    image: c.image ? [`${SITE}${c.image.src}`] : undefined,
    author: c.author ? { "@type": "Person", name: c.author } : undefined,
    mainEntityOfPage: `${SITE}${articleHref(view.language, c.slug)}`,
  };
  const crumbsLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [{ name: t("nav.home"), item: `${SITE}/${lang}` }, ...view.breadcrumb.map((b) => ({ name: b.name, item: `${SITE}/${lang}/${b.slug}` }))].map((x, i) => ({ "@type": "ListItem", position: i + 1, ...x })),
  };
  const ld = (o: object) => JSON.stringify(o).replace(/</g, "\\u003c");

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-5 2xl:max-w-[1800px]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld(crumbsLd) }} />
      <ViewCounter id={c.id} />
      <Breadcrumbs items={[{ href: `/${lang}`, label: t("nav.home") }, ...view.breadcrumb.map((b) => ({ href: `/${lang}/${b.slug}`, label: b.name })), { label: c.title }]} />

      <div className="grid gap-8 lg:grid-cols-12">
        <article className="lg:col-span-8" lang={view.language}>
          {view.languageNotice && (
            <p role="note" className="mb-4 rounded border border-warn bg-paper2 px-3 py-2 text-sm">
              {t("lang.notice", { requested: t(`lang.${lang}` as "lang.ta"), shown: t(`lang.${view.language}` as "lang.ta") })}
            </p>
          )}
          <header>
            {c.category && (
              <Link href={`/${lang}/${c.category.slug}`} className="text-sm font-bold uppercase tracking-wide text-accent no-underline">
                {c.category.name}
              </Link>
            )}
            <h1 className="headline mt-1 text-3xl sm:text-4xl">{c.title}</h1>
            {c.subtitle && <p className="mt-3 text-xl text-ink2">{c.subtitle}</p>}
            <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-y border-rule py-2 text-sm text-ink3">
              {c.author && (
                <span>
                  {t("common.by")} <strong className="text-ink">{c.author}</strong>
                </span>
              )}
              {view.publishedAt && (
                <span>
                  {t("common.published")}: <time dateTime={view.publishedAt}>{formatDate(view.publishedAt, lang, true)}</time>
                </span>
              )}
              {view.publishedAt && view.updatedAt.slice(0, 10) !== view.publishedAt.slice(0, 10) && (
                <span>
                  {t("common.updated")}: <time dateTime={view.updatedAt}>{formatDate(view.updatedAt, lang, true)}</time>
                </span>
              )}
              <span>{t("common.min_read", { n: c.minutes })}</span>
              {view.location && <span>📍 {view.location}</span>}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <ShareButtons title={c.title} url={`${SITE}${articleHref(view.language, c.slug)}`} labels={{ share: t("common.share"), copy: t("common.copy_link"), copied: t("common.copied") }} />
              {c.available[other] && c.slugs[other] && (
                <Link href={articleHref(other, c.slugs[other]!)} hrefLang={other} lang={other} className="rounded border border-brand px-2.5 py-1 text-sm font-bold text-brand no-underline">
                  {t("lang.available")}: {t(`lang.${other}` as "lang.ta")}
                </Link>
              )}
            </div>
          </header>

          {c.image && (
            <figure className="mt-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.image.src.replace(/\/md$/, "/lg")} alt={c.image.caption ?? ""} className="w-full bg-paper2 object-cover" style={{ aspectRatio: "16/9" }} fetchPriority="high" />
              {(c.image.caption || c.image.credit) && (
                <figcaption className="mt-1 text-sm text-ink3">
                  {c.image.caption} {c.image.credit && <span>({t("article.photo_credit")}: {c.image.credit})</span>}
                </figcaption>
              )}
            </figure>
          )}

          <div className="prose-news mt-6" dangerouslySetInnerHTML={{ __html: view.html }} />

          {view.sources.length > 0 && (
            <section className="mt-8 border-t border-rule pt-4">
              <h2 className="font-bold">{t("article.sources")}</h2>
              <ul className="mt-1 list-disc pl-5 text-sm">
                {view.sources.map((s, i) => (
                  <li key={i}>
                    {s.url ? (
                      <a href={s.url} rel="noopener noreferrer nofollow" target="_blank" className="text-brand underline">
                        {s.label || s.url}
                      </a>
                    ) : (
                      s.label
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {view.tags.length > 0 && (
            <p className="mt-6 flex flex-wrap gap-2 text-sm">
              {view.tags.map((tg) => (
                <Link key={tg.slug} href={`/${lang}/search?tag=${encodeURIComponent(tg.slug)}`} className="rounded-full border border-rule px-3 py-0.5 no-underline hover:bg-paper2">
                  #{tg.name}
                </Link>
              ))}
            </p>
          )}

          <nav aria-label="Story navigation" className="mt-8 grid gap-4 border-t border-rule pt-4 sm:grid-cols-2">
            {prev && (
              <Link href={articleHref(prev.lang, prev.slug)} rel="prev" className="no-underline">
                <span className="text-xs uppercase text-ink3">← {t("article.previous")}</span>
                <span className="headline mt-1 block text-base">{prev.title}</span>
              </Link>
            )}
            {next && (
              <Link href={articleHref(next.lang, next.slug)} rel="next" className="text-right no-underline sm:col-start-2">
                <span className="text-xs uppercase text-ink3">{t("article.next")} →</span>
                <span className="headline mt-1 block text-base">{next.title}</span>
              </Link>
            )}
          </nav>
        </article>

        <aside className="space-y-8 lg:col-span-4" aria-label={t("home.related")}>
          {related.length > 0 && (
            <section>
              <h2 className="section-title">{t("home.related")}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                {related.slice(0, 3).map((r) => (
                  <StoryCard key={r.id} card={r} lang={lang} />
                ))}
              </div>
              <ul className="mt-3">
                {related.slice(3).map((r) => (
                  <CompactItem key={r.id} card={r} />
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
