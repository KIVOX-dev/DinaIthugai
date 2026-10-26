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
  emailEnabled: boolean;
  logo?: string;
};

export type SiteData = { tree: CategoryNode[]; ads: Record<string, Ad[]>; settings: SiteSettings };

export type HomeData = {
  breaking: ArticleCard[];
  lead?: ArticleCard;
  secondary: ArticleCard[];
  latest: ArticleCard[];
  trending: ArticleCard[];
  customHeadlines?: { text: string; href?: string }[];
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

export type MediaItem = { id: string; url: string; thumb: string; caption: { ta?: string; en?: string }; credit?: string; width?: number; height?: number };

/** Editor payload returned by GET /api/articles/:id */
export type EditArticle = {
  id: string;
  status: string;
  source: "staff" | "community";
  revision: number;
  lockedRevision?: number;
  preferredLanguage: "ta" | "en";
  title: { ta: string; en: string };
  subtitle: { ta: string; en: string };
  excerpt: { ta: string; en: string };
  body: { ta: string; en: string };
  seoTitle: { ta: string; en: string };
  seoDescription: { ta: string; en: string };
  slug: { ta: string; en: string };
  category: string;
  tags: { id: string; slug: string; name: string }[];
  location: string;
  authorNotes: string;
  declaration: boolean;
  reviewNote?: string;
  sources: { label: string; url: string }[];
  featuredImage: string;
  featuredCaption: { ta: string; en: string };
  featuredCredit: string;
  media: MediaItem[];
  authorName: string;
  authorId: string;
  authorLabel?: string;
  canonicalUrl: string;
  edition: string;
  featured: boolean;
  trending: boolean;
  breaking: boolean;
  priority: number;
  scheduledAt?: string;
  publishedAt?: string;
  availability: { ta: boolean; en: boolean };
  submitter?: { id: string; name: string; email?: string };
  assignedEditor?: { id: string; name: string };
  internalNotes: { note: string; at: string }[];
  history: { id: string; action: string; from?: string; to?: string; reason?: string; by: string; at: string; revision?: number }[];
  revisions: { revision: number; kind: string; status?: string; note?: string; by: string; at: string; snapshot: { title: { ta: string; en: string }; body: { ta: string; en: string } } }[];
  can: { edit: boolean; owner: boolean; review: boolean; approve: boolean; publish: boolean; schedule: boolean; unpublish: boolean; delete: boolean; feature: boolean; ai: boolean; media: boolean };
  previewUrls: { ta?: string; en?: string };
  featuredUrl?: string;
};
