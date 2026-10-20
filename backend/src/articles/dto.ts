import type { ArticleDoc, CategoryDoc, UserDoc } from "../models";
import type { Locale } from "../shared/i18n";
import { otherLocale } from "../shared/i18n";
import { mediaUrl } from "../services/media";
import { readingMinutes } from "../text";

type Populated = Omit<ArticleDoc, "category" | "author" | "submitter"> & {
  category?: (Pick<CategoryDoc, "slug" | "name" | "accent"> & { _id: unknown }) | null;
  author?: (Pick<UserDoc, "name" | "bio"> & { _id: unknown }) | null;
  submitter?: (Pick<UserDoc, "name"> & { _id: unknown }) | null;
};

export type ArticleCard = {
  id: string;
  lang: Locale; // language the card text is actually in (may differ from requested when falling back)
  fallback: boolean;
  slug: string;
  slugs: { ta?: string; en?: string };
  title: string;
  subtitle?: string;
  excerpt?: string;
  image?: { id: string; src: string; thumb: string; sm: string; width?: number; height?: number; caption?: string; credit?: string };
  category?: { slug: string; name: string; accent?: string };
  author?: string;
  authorId?: string;
  publishedAt?: string;
  updatedAt: string;
  breaking: boolean;
  featured: boolean;
  views: number;
  available: { ta: boolean; en: boolean };
  minutes: number;
};

export function bylineOf(a: Populated): string | undefined {
  return a.authorName || a.author?.name || a.submitter?.name || undefined;
}

export function toCard(a: Populated, lang: Locale, imageMeta?: Map<string, { width?: number; height?: number }>): ArticleCard {
  const has = (l: Locale) => !!a.title?.[l] && !!a.slug?.[l];
  const use: Locale = has(lang) ? lang : has(otherLocale(lang)) ? otherLocale(lang) : lang;
  const img = a.featuredImage ? String(a.featuredImage) : undefined;
  return {
    id: String(a._id),
    lang: use,
    fallback: use !== lang,
    slug: a.slug?.[use] ?? "",
    slugs: { ta: a.slug?.ta ?? undefined, en: a.slug?.en ?? undefined },
    title: a.title?.[use] ?? "",
    subtitle: a.subtitle?.[use] || undefined,
    excerpt: a.excerpt?.[use] || undefined,
    image: img
      ? {
          id: img,
          src: mediaUrl(img, "md"),
          thumb: mediaUrl(img, "thumb"),
          sm: mediaUrl(img, "sm"),
          width: imageMeta?.get(img)?.width,
          height: imageMeta?.get(img)?.height,
          caption: a.featuredCaption?.[use] || undefined,
          credit: a.featuredCredit || undefined,
        }
      : undefined,
    category: a.category ? { slug: a.category.slug, name: a.category.name?.[use] || a.category.name?.[otherLocale(use)] || a.category.slug, accent: a.category.accent ?? undefined } : undefined,
    author: bylineOf(a),
    authorId: a.author ? String(a.author._id) : undefined,
    publishedAt: (a.publishedAt ?? undefined)?.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    breaking: !!a.breaking,
    featured: !!a.featured,
    views: a.views ?? 0,
    available: { ta: !!a.languageAvailability?.ta, en: !!a.languageAvailability?.en },
    minutes: readingMinutes(a.body?.[use]),
  };
}

export const articleHref = (lang: Locale, slug: string) => `/${lang}/news/${encodeURIComponent(slug)}`;
