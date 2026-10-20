import Link from "next/link";
import { articleHref, type ArticleCard } from "@/lib/types";
import type { Locale } from "@/lib/shared/i18n";
import { formatDate } from "@/lib/i18n/dictionary";

function Thumb({ card, ratio = "16/9", sizes, priority = false }: { card: ArticleCard; ratio?: string; sizes: string; priority?: boolean }) {
  if (!card.image) {
    return (
      <div className="flex w-full items-center justify-center bg-paper2 text-ink3" style={{ aspectRatio: ratio }} aria-hidden="true">
        <span className="headline text-2xl">{card.title.slice(0, 1)}</span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={card.image.src}
      srcSet={`${card.image.sm} 600w, ${card.image.src} 1000w`}
      sizes={sizes}
      alt={card.image.caption ?? ""}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      className="w-full bg-paper2 object-cover"
      style={{ aspectRatio: ratio }}
    />
  );
}

const Kicker = ({ card }: { card: ArticleCard }) =>
  card.category ? <span className="text-xs font-bold uppercase tracking-wide text-accent">{card.category.name}</span> : null;

function Meta({ card, lang }: { card: ArticleCard; lang: Locale }) {
  return (
    <p className="mt-1 text-xs text-ink3">
      {card.author && <span>{card.author} · </span>}
      {card.publishedAt && <time dateTime={card.publishedAt}>{formatDate(card.publishedAt, lang)}</time>}
      {card.fallback && <span className="ml-2 rounded border border-rule px-1">{card.lang === "ta" ? "தமிழ்" : "EN"}</span>}
    </p>
  );
}

export function LeadCard({ card, lang }: { card: ArticleCard; lang: Locale }) {
  return (
    <article>
      <Link href={articleHref(card.lang, card.slug)} className="block no-underline">
        <Thumb card={card} ratio="16/9" sizes="(min-width:1024px) 640px, 100vw" priority />
        <div className="mt-3">
          <Kicker card={card} />
          <h2 className="headline mt-1 text-2xl sm:text-3xl lg:text-[2.1rem]">{card.title}</h2>
          {card.excerpt && <p className="mt-2 text-ink2">{card.excerpt}</p>}
        </div>
      </Link>
      <Meta card={card} lang={lang} />
    </article>
  );
}

export function StoryCard({ card, lang, ratio = "3/2" }: { card: ArticleCard; lang: Locale; ratio?: string }) {
  return (
    <article>
      <Link href={articleHref(card.lang, card.slug)} className="block no-underline">
        <Thumb card={card} ratio={ratio} sizes="(min-width:1024px) 300px, 50vw" />
        <div className="mt-2">
          <Kicker card={card} />
          <h3 className="headline mt-0.5 text-lg">{card.title}</h3>
        </div>
      </Link>
      <Meta card={card} lang={lang} />
    </article>
  );
}

/** Image left, text right: dense list rows like a newspaper column. */
export function RowCard({ card, lang }: { card: ArticleCard; lang: Locale }) {
  return (
    <article className="flex gap-3 border-b border-rule py-3 first:pt-0 last:border-0">
      <Link href={articleHref(card.lang, card.slug)} className="block w-28 shrink-0 sm:w-36" tabIndex={-1} aria-hidden="true">
        <Thumb card={card} ratio="4/3" sizes="150px" />
      </Link>
      <div className="min-w-0">
        <Kicker card={card} />
        <h3 className="headline text-base sm:text-lg">
          <Link href={articleHref(card.lang, card.slug)} className="no-underline hover:underline">
            {card.title}
          </Link>
        </h3>
        {card.excerpt && <p className="mt-1 hidden text-sm text-ink2 sm:line-clamp-2 sm:block">{card.excerpt}</p>}
        <Meta card={card} lang={lang} />
      </div>
    </article>
  );
}

export function CompactItem({ card, index }: { card: ArticleCard; index?: number }) {
  return (
    <li className="flex gap-3 border-b border-rule py-2 last:border-0">
      {index !== undefined && <span className="headline w-7 shrink-0 text-2xl text-accent">{index + 1}</span>}
      <Link href={articleHref(card.lang, card.slug)} className="headline text-[15px] no-underline hover:underline">
        {card.title}
      </Link>
    </li>
  );
}
