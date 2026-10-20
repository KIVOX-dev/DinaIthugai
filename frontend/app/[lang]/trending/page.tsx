import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/shared/i18n";
import { apiGet } from "@/lib/api";
import type { ArticleCard } from "@/lib/types";
import { makeT } from "@/lib/i18n/dictionary";
import { FeedList, PageShell } from "@/components/site/FeedList";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[lang]/trending">): Promise<Metadata> {
  const { lang } = await params;
  return { title: isLocale(lang) ? makeT(lang)("nav.trending") : undefined };
}

export default async function Trending({ params }: PageProps<"/[lang]/trending">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const { items } = await apiGet<{ items: ArticleCard[] }>("/public/trending", { lang });
  const t = makeT(lang);
  return (
    <PageShell title={t("home.trending")} sub={t("home.most_read")}>
      <FeedList items={items} lang={lang} />
    </PageShell>
  );
}
