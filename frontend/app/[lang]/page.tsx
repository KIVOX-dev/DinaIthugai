import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/shared/i18n";
import { apiGet } from "@/lib/api";
import { articleHref, type HomeData, type SiteData } from "@/lib/types";
import { makeT } from "@/lib/i18n/dictionary";
import { CompactItem, LeadCard, StoryCard } from "@/components/site/Cards";
import { AdSlot } from "@/components/site/AdSlot";

export const dynamic = "force-dynamic";

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = makeT(lang);
  const [h, site] = await Promise.all([apiGet<HomeData>("/public/home", { lang }), apiGet<SiteData>("/public/site", { lang })]);
  const { settings, tree } = site;

  if (!h.lead) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <p className="headline text-2xl">{t("home.empty")}</p>
      </div>
    );
  }

  const pills = tree.filter((n) => n.showInNav).slice(0, 8);

  return (
    <div className="mx-auto max-w-[1500px] 2xl:max-w-[1800px] px-4">
      <AdSlot ads={h.ads.header_leaderboard ?? site.ads.header_leaderboard} lang={lang} className="my-5" />

      {/* Trending pill bar */}
      <section aria-label={t("home.trending")} className="mx-auto my-5 flex max-w-5xl items-center gap-3 rounded-xl border border-rule bg-paper2 px-3 py-2.5 shadow-sm">
        <Link href={`/${lang}/trending`} className="headline flex shrink-0 items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-1.5 text-lg text-accent no-underline">
          <span className="h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
          {t("home.trending")}
        </Link>
        <span className="hidden h-6 w-px bg-rule sm:block" aria-hidden="true" />
        <ul className="no-scrollbar flex flex-1 items-center gap-2 overflow-x-auto [&>li:first-child]:ml-auto [&>li:last-child]:mr-auto">
          {pills.map((c) => (
            <li key={c.slug} className="shrink-0">
              <Link href={`/${lang}/${c.slug}`} className="block rounded-full border border-rule bg-paper px-4 py-1.5 text-[15px] no-underline hover:border-brand hover:text-brand">
                {c.name[lang]}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Breaking ticker (only when there is breaking news) */}
      {settings.breakingBanner?.enabled !== false && h.breaking.length > 0 && (
        <section aria-label={t("home.breaking")} className="my-4 flex items-stretch overflow-hidden border border-accent">
          <span className="flex shrink-0 items-center bg-accent px-3 text-sm font-extrabold uppercase text-white">{settings.breakingBanner?.label?.[lang] || t("home.breaking")}</span>
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

      {/* Headlines: centred title between rules, then three columns */}
      <section aria-labelledby="headlines-title" className="mt-8">
        <div className="flex items-center gap-3 sm:gap-6">
          <span className="h-px flex-1 bg-ink/50" aria-hidden="true" />
          <h1 id="headlines-title" className="headline whitespace-nowrap text-xl min-[380px]:text-2xl sm:text-4xl md:text-5xl">
            {lang === "ta" ? "தலைப்புச் செய்திகள்" : "Headlines"}
          </h1>
          <span className="h-px flex-1 bg-ink/50" aria-hidden="true" />
        </div>

        <div className="mt-6 grid gap-8 md:grid-cols-2 lg:grid-cols-[1fr_1.7fr_1fr]">
          <div className="order-2 space-y-6 md:order-2 lg:order-none lg:border-r lg:border-rule lg:pr-6">
            {h.secondary.slice(0, 2).map((c) => (
              <StoryCard key={c.id} card={c} lang={lang} ratio="4/3" />
            ))}
          </div>
          <div className="order-1 md:col-span-2 lg:order-none lg:col-span-1">
            <LeadCard card={h.lead} lang={lang} />
            <ul className="mt-5 grid gap-x-6 sm:grid-cols-2">
              {/* Admin-typed headlines come first, then the newest stories, all in one list. */}
              {(h.customHeadlines ?? []).map((c, i) => (
                <li key={`custom-${i}`} className="flex gap-3 border-b border-rule py-2 last:border-0">
                  {c.href ? (
                    <Link href={c.href} className="headline text-[15px] no-underline hover:underline" {...(/^https?:/.test(c.href) ? { target: "_blank", rel: "noopener" } : {})}>
                      {c.text}
                    </Link>
                  ) : (
                    <span className="headline text-[15px]">{c.text}</span>
                  )}
                </li>
              ))}
              {h.latest.slice(0, 4).map((c) => (
                <CompactItem key={c.id} card={c} />
              ))}
            </ul>
          </div>
          <aside className="order-3 space-y-6 lg:order-none lg:border-l lg:border-rule lg:pl-6" aria-label={t("home.latest")}>
            <AdSlot ads={h.ads.home_sidebar} lang={lang} />
            {h.secondary.slice(2, 4).map((c) => (
              <StoryCard key={c.id} card={c} lang={lang} ratio="4/3" />
            ))}
            <section>
              <h2 className="section-title">{t("home.most_read")}</h2>
              <ol>
                {h.trending.slice(0, 6).map((c, i) => (
                  <CompactItem key={c.id} card={c} index={i} />
                ))}
              </ol>
            </section>
          </aside>
        </div>
      </section>

      {/* Category sections */}
      <div className="rule-top mt-10 grid gap-8 pt-6 lg:grid-cols-12">
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
              {/* One large lead beside up to four equal cards: always a tidy block, whatever the story count. */}
              <div className="grid gap-x-5 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
                <div className="sm:col-span-2 lg:row-span-2">
                  <StoryCard card={s.items[0]} lang={lang} ratio="16/10" big />
                </div>
                {s.items.slice(1, 5).map((c) => (
                  <StoryCard key={c.id} card={c} lang={lang} ratio="4/3" />
                ))}
              </div>
              {idx === 1 && <AdSlot ads={h.ads.home_inline} lang={lang} className="mt-6" />}
            </section>
          ))}
        </div>
        <aside className="space-y-8 lg:col-span-4 lg:border-l lg:border-rule lg:pl-6">
          <section>
            <h2 className="section-title">{t("home.latest")}</h2>
            <ul>
              {h.latest.slice(4, 10).map((c) => (
                <CompactItem key={c.id} card={c} />
              ))}
            </ul>
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
