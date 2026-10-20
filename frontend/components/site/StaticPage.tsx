import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/shared/i18n";
import { apiGet } from "@/lib/api";
import { STATIC_PAGES, type StaticSlug } from "@/lib/i18n/pages";
import { makeT } from "@/lib/i18n/dictionary";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";

export function staticMetadata(slug: StaticSlug) {
  return async ({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> => {
    const { lang } = await params;
    return { title: isLocale(lang) ? STATIC_PAGES[slug].title[lang] : undefined, alternates: { canonical: `/${lang}/${slug}`, languages: { ta: `/ta/${slug}`, en: `/en/${slug}` } } };
  };
}

/** Policy/info page: admin-edited content from settings if present, otherwise the built-in default copy. */
export function staticPage(slug: StaticSlug) {
  return async function Page({ params }: { params: Promise<{ lang: string }> }) {
    const { lang } = await params;
    if (!isLocale(lang)) notFound();
    const l: Locale = lang;
    const t = makeT(l);
    let html = STATIC_PAGES[slug].body[l];
    try {
      const { page } = await apiGet<{ page: { ta?: string; en?: string } | null }>(`/public/page/${slug}`);
      if (page?.[l]) html = page[l]!;
    } catch {
      /* fall back to default copy when the API is unreachable */
    }
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Breadcrumbs items={[{ href: `/${l}`, label: t("nav.home") }, { label: STATIC_PAGES[slug].title[l] }]} />
        <h1 className="headline mb-4 border-b-2 border-ink pb-3 text-3xl sm:text-4xl">{STATIC_PAGES[slug].title[l]}</h1>
        <div className="prose-news" dangerouslySetInnerHTML={{ __html: html }} />
        <p className="mt-8 text-sm text-ink3">{t("static.updated")}</p>
      </div>
    );
  };
}
