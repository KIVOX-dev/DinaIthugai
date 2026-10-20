import Link from "next/link";
import type { Locale } from "@/lib/shared/i18n";
import { makeT } from "@/lib/i18n/dictionary";

/** Crawlable pagination (real links, rel=prev/next). */
export function Pagination({ lang, page, pages, href }: { lang: Locale; page: number; pages: number; href: (p: number) => string }) {
  if (pages <= 1) return null;
  const t = makeT(lang);
  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 2);
  return (
    <nav aria-label="Pagination" className="mt-8 flex flex-wrap items-center justify-center gap-1 text-sm">
      {page > 1 && (
        <Link href={href(page - 1)} rel="prev" className="rounded border border-rule px-3 py-2 no-underline hover:bg-paper2">
          ← {t("common.previous")}
        </Link>
      )}
      {nums.map((n, i) => (
        <span key={n} className="flex items-center gap-1">
          {i > 0 && n - nums[i - 1] > 1 && <span className="px-1 text-ink3">…</span>}
          <Link href={href(n)} aria-current={n === page ? "page" : undefined} className={`rounded border px-3 py-2 no-underline ${n === page ? "border-brand bg-brand text-brand-ink" : "border-rule hover:bg-paper2"}`}>
            {n}
          </Link>
        </span>
      ))}
      {page < pages && (
        <Link href={href(page + 1)} rel="next" className="rounded border border-rule px-3 py-2 no-underline hover:bg-paper2">
          {t("common.next")} →
        </Link>
      )}
    </nav>
  );
}
