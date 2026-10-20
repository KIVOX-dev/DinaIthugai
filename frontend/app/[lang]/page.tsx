import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/shared/i18n";
import { getHomepage } from "@/backend/articles/queries";
import { makeT } from "@/frontend/i18n/dictionary";
import { CompactItem, LeadCard, RowCard, StoryCard } from "@/frontend/components/site/Cards";
import { articleHref } from "@/backend/articles/dto";
import { AdSlot } from "@/frontend/components/site/AdSlot";

export const dynamic = "force-dynamic";

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = makeT(lang);
  const h = await getHomepage(lang);

  if (!h.lead) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <p className="headline text-2xl">{t("home.empty")}</p>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-7xl px-4">
      {h.settings.breakingBanner?.enabled !== false && h.breaking.length > 0 && (
        <section aria-label={t("home.breaking")} className="my-3 flex items-stretch overflow-hidden border border-accent">
          <span className="flex shrink-0 items-center bg-accent px-3 text-sm font-extrabold uppercase text-white">{h.settings.breakingBanner?.label?.[lang] || t("home.breaking")}</span>
          <div className="min-w-0 flex-1 overflow-hidden bg-paper2 py-2">
            <div className="ticker px-4">
              {[...h.breaking, ...h.breaking].map((b, i) => (
                <Link key={i} href={articleHref(b.lang, b.slug)} className="headline text-sm no-underline hover:underline" aria-hidden={i >= h.breaking.length ? true : undefined} tabIndex={i >= h.breaking.length ? -1 : undefined}>
                  {b.title}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <AdSlot ads={h.ads.header_leaderboard} lang={lang} className="my-3" />

      <div className="grid gap-6 py-4 lg:grid-cols-12">
        <div className="lg:col-span-5 lg:order-2">
          <LeadCard card={h.lead} lang={lang} />
        </div>
        <div className="lg:col-span-4 lg:order-3">
          <h2 className="section-title">{t("home.latest")}</h2>
          <ul>{h.latest.slice(0, 7).map((c) => <CompactItem key={c.id} card={c} />)}</ul>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:col-span-3 lg:order-1 lg:grid-cols-1 lg:border-r lg:border-rule lg:pr-4">
          {h.secondary.slice(0, 3).map((c) => (
            <StoryCard key={c.id} card={c} lang={lang} />
          ))}
        </div>
      </div>

      <div className="rule-top grid gap-8 pt-6 lg:grid-cols-12">
        <div className="space-y-10 lg:col-span-8">
          {h.sections.map((s, idx) => (
            <section key={s.key} aria-labelledby={`sec-${s.key}`}>
              <div className="section-title">
                <h2 id={`sec-${s.key}`} className="flex-1">
                  <Link href={`/${lang}/${s.key}`} className="no-underline hover:underline">
                    {s.category?.name[lang]}
                  </Link>
                </h2>
                <Link href={`/${lang}/${s.key}`} className="text-sm font-normal text-brand">
                  {t("common.view_all")} →
                </Link>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <StoryCard card={s.items[0]} lang={lang} ratio="16/10" />
                <div>
                  {s.items.slice(1).map((c) => (
                    <RowCard key={c.id} card={c} lang={lang} />
                  ))}
                </div>
              </div>
              {idx === 1 && <AdSlot ads={h.ads.home_inline} lang={lang} className="mt-6" />}
            </section>
          ))}
        </div>

        <aside className="space-y-8 lg:col-span-4" aria-label={t("home.trending")}>
          <AdSlot ads={h.ads.home_sidebar} lang={lang} />
          <section>
            <h2 className="section-title">{t("home.most_read")}</h2>
            <ol>{h.trending.map((c, i) => <CompactItem key={c.id} card={c} index={i} />)}</ol>
          </section>
          <section>
            <h2 className="section-title">{t("nav.submit")}</h2>
            <p className="text-sm text-ink2">{t("submit.sub")}</p>
            <Link href={`/${lang}/account/submit`} className="mt-3 inline-block rounded bg-brand px-4 py-2 font-bold text-brand-ink no-underline">
              {t("nav.submit")}
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
