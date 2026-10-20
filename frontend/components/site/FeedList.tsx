import type { Locale } from "@/lib/shared/i18n";
import type { ArticleCard } from "@/lib/types";
import { makeT } from "@/lib/i18n/dictionary";
import { RowCard, StoryCard } from "./Cards";

/** Lead row of three image cards followed by dense rows; used by category, latest, trending, search and author pages. */
export function FeedList({ items, lang, empty }: { items: ArticleCard[]; lang: Locale; empty?: string }) {
  const t = makeT(lang);
  if (!items.length) return <p className="rounded border border-rule bg-paper2 p-6 text-center text-ink2">{empty ?? t("category.empty")}</p>;
  const top = items.slice(0, 3);
  const rest = items.slice(3);
  return (
    <div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {top.map((c) => (
          <StoryCard key={c.id} card={c} lang={lang} />
        ))}
      </div>
      {rest.length > 0 && (
        <div className="mt-6 border-t border-rule pt-4 lg:grid lg:grid-cols-2 lg:gap-x-10">
          {rest.map((c) => (
            <RowCard key={c.id} card={c} lang={lang} />
          ))}
        </div>
      )}
    </div>
  );
}

export function PageShell({ children, title, sub }: { children: React.ReactNode; title: string; sub?: string }) {
  return (
    <div className="mx-auto max-w-[1500px] px-4 py-6 2xl:max-w-[1800px]">
      <header className="mb-6 border-b-2 border-ink pb-3">
        <h1 className="headline text-3xl sm:text-4xl">{title}</h1>
        {sub && <p className="mt-1 text-ink2">{sub}</p>}
      </header>
      {children}
    </div>
  );
}
