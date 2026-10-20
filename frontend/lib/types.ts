import type { Locale } from "@/lib/shared/i18n";
import type { Role } from "@/lib/shared/permissions";

/** Shapes returned by the backend API (kept in sync by hand; they are plain JSON). */
export type Principal = {
  id: string;
  name: string;
  email: string;
  role: Role;
  permissions: string[];
  status: string;
  emailVerified: boolean;
  preferredLanguage: Locale;
};

type L = { ta?: string | null; en?: string | null };

export type ArticleCard = {
  id: string;
  lang: Locale;
  fallback: boolean;
  slug: string;
  slugs: { ta?: string; en?: string };
  title: string;
  subtitle?: string;
  excerpt?: string;
  image?: { id: string; src: string; thumb: string; sm: string; caption?: string; credit?: string };
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

export type CategoryNode = {
  id: string;
  slug: string;
  name: { ta: string; en: string };
  accent?: string;
  showInNav: boolean;
  order: number;
  children: CategoryNode[];
};

export type Ad = { id: string; src: string; href: string; alt: string };

export type SiteSettings = {
  siteName: L;
  tagline: L;
  edition: L;
  defaultLocale: Locale;
  social?: Record<string, string | null | undefined>;
  contact?: { email?: string | null; phone?: string | null; address?: L };
  footerLinks?: { label?: L; href?: string | null }[];
  breakingBanner?: { enabled: boolean; label: L };
  maintenanceMode: boolean;
  maintenanceMessage?: L;
  registrationOpen: boolean;
  submissionsEnabled: boolean;
  submissionRules?: L;
  maxImages: number;
  minWords: number;
  aiEnabled: boolean;
  logo?: string;
};

export type SiteData = { tree: CategoryNode[]; ads: Record<string, Ad[]>; settings: SiteSettings };

export type HomeData = {
  breaking: ArticleCard[];
  lead?: ArticleCard;
  secondary: ArticleCard[];
  latest: ArticleCard[];
  trending: ArticleCard[];
  sections: { key: string; category?: { slug: string; name: { ta: string; en: string }; accent?: string }; items: ArticleCard[] }[];
  ads: Record<string, Ad[]>;
};

export type Paged<T> = { items: T[]; total: number; page: number; pages: number };

export type ArticleView = {
  card: ArticleCard;
  html: string;
  requestedLang: Locale;
  language: Locale;
  languageNotice: boolean;
  seo: { title: string; description: string; canonical?: string };
  sources: { label?: string; url?: string }[];
  credits?: string;
  location?: string;
  tags: { slug: string; name: string }[];
  breadcrumb: { slug: string; name: string }[];
  updatedAt: string;
  publishedAt?: string;
  authorBio?: string;
};

export const articleHref = (lang: Locale, slug: string) => `/${lang}/news/${encodeURIComponent(slug)}`;
