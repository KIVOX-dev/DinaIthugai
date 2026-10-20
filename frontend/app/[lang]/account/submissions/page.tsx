import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/shared/i18n";
import { STATUSES } from "@/lib/shared/article-states";
import { apiGet, requireUserPage } from "@/lib/api";
import { formatDate, makeT } from "@/lib/i18n/dictionary";
import { StatusBadge } from "@/components/ui/StatusBadge";

type Row = { id: string; title: string; titleTa?: string; titleEn?: string; status: string; category?: string; updatedAt: string };
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My submissions", robots: { index: false } };

export default async function Submissions({ params, searchParams }: PageProps<"/[lang]/account/submissions">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  await requireUserPage(lang, `/${lang}/account/submissions`);
  const { status } = (await searchParams) as { status?: string };
  const d = await apiGet<{ items: Row[]; counts: Record<string, number> }>("/articles/mine", { status });
  const t = makeT(lang);
  const total = Object.values(d.counts).reduce((a, b) => a + b, 0);
  const chip = (active: boolean) => `inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm no-underline ${active ? "border-brand bg-brand/10" : "border-rule hover:bg-paper2"}`;
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="headline text-3xl">{t("subs.title")}</h1>
        <Link href={`/${lang}/account/submit`} className="rounded bg-brand px-4 py-2 font-bold text-brand-ink no-underline">
          + {t("subs.new")}
        </Link>
      </div>
      <nav aria-label={t("subs.status")} className="my-5 flex flex-wrap gap-2">
        <Link href={`/${lang}/account/submissions`} className={chip(!status)}>
          {t("subs.all")} ({total})
        </Link>
        {STATUSES.filter((s) => d.counts[s]).map((s) => (
          <Link key={s} href={`/${lang}/account/submissions?status=${s}`} className={chip(status === s)}>
            <StatusBadge status={s} lang={lang} /> {d.counts[s]}
          </Link>
        ))}
      </nav>
      {d.items.length === 0 ? (
        <p className="rounded border border-rule bg-paper2 p-8 text-center text-ink2">{t("subs.none")}</p>
      ) : (
        <ul className="divide-y divide-rule border-y border-rule">
          {d.items.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <Link href={`/${lang}/account/submissions/${r.id}`} className="headline block truncate text-lg no-underline hover:underline">
                  {(lang === "ta" ? r.titleTa || r.titleEn : r.titleEn || r.titleTa) || "—"}
                </Link>
                <p className="text-xs text-ink3">
                  {r.category && <span>{r.category} · </span>}
                  {t("subs.updated")}: {formatDate(r.updatedAt, lang, true)}
                </p>
              </div>
              <StatusBadge status={r.status} lang={lang} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
