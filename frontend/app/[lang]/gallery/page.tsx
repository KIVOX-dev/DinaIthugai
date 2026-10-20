import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/shared/i18n";
import { apiGet } from "@/lib/api";
import { articleHref, type Paged } from "@/lib/types";
import { makeT } from "@/lib/i18n/dictionary";
import { PageShell } from "@/components/site/FeedList";
import { Pagination } from "@/components/ui/Pagination";

type Item = { id: string; src: string; thumb: string; caption: string; credit?: string; slug: string; lang: Locale };
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[lang]/gallery">): Promise<Metadata> {
  const { lang } = await params;
  return { title: isLocale(lang) ? makeT(lang)("gallery.title") : undefined };
}

export default async function Gallery({ params, searchParams }: PageProps<"/[lang]/gallery">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const { page } = (await searchParams) as { page?: string };
  const d = await apiGet<Paged<Item>>("/public/gallery", { lang, page });
  const t = makeT(lang);
  return (
    <PageShell title={t("gallery.title")}>
      {d.items.length === 0 ? (
        <p className="rounded border border-rule bg-paper2 p-6 text-center text-ink2">{t("category.empty")}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {d.items.map((i) => (
            <li key={i.id}>
              <Link href={articleHref(i.lang, i.slug)} className="block no-underline">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={i.thumb} alt={i.caption} loading="lazy" className="w-full bg-paper2 object-cover" style={{ aspectRatio: "4/3" }} />
                <span className="mt-1 block text-sm">{i.caption}</span>
                {i.credit && <span className="block text-xs text-ink3">{t("article.photo_credit")}: {i.credit}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pagination lang={lang} page={d.page} pages={d.pages} href={(p) => `/${lang}/gallery?page=${p}`} />
    </PageShell>
  );
}
