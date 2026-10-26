import type { SortOrder } from "mongoose";
import type { Filter } from "../filter";
import { connectDB } from "../db";
import { Advertisement, Article, Category, MediaAsset, Tag, User, type ArticleDoc, type CategoryDoc } from "../models";
import type { Locale } from "../shared/i18n";
import { otherLocale } from "../shared/i18n";
import { escapeRegex } from "../text";
import { getSettings } from "../services/settings";
import { toCard, type ArticleCard } from "./dto";
import { mediaUrl } from "../services/media";

export const PAGE_SIZE = 12;

/** The single definition of "publicly visible": published, or scheduled and its time has arrived. */
export function visibleFilter(now = new Date()): Filter {
  return {
    deletedAt: { $exists: false },
    visibility: "public",
    $or: [{ status: "published" }, { status: "scheduled", scheduledAt: { $lte: now } }],
  };
}

const withLang = (lang: Locale): Filter => ({ [`languageAvailability.${lang}`]: true });

const CARD_PROJECTION = "-body -searchText -submission -seoTitle -seoDescription -sources";

async function findCards(filter: Filter, opts: { lang: Locale; sort?: Record<string, SortOrder>; limit?: number; skip?: number; extra?: Record<string, unknown> }) {
  const rows = await Article.find(filter, { ...(opts.extra ?? {}) })
    .select(CARD_PROJECTION)
    .sort(opts.sort ?? { publishedAt: -1 })
    .skip(opts.skip ?? 0)
    .limit(opts.limit ?? PAGE_SIZE)
    .populate("category", "slug name accent")
    .populate("author", "name")
    .populate("submitter", "name")
    .lean();
  return rows.map((r) => toCard(r as never, opts.lang));
}

/* -------------------------------- categories -------------------------------- */

export type CategoryNode = {
  id: string;
  slug: string;
  name: { ta: string; en: string };
  description?: { ta?: string; en?: string };
  accent?: string;
  showInNav: boolean;
  order: number;
  parent?: string;
  children: CategoryNode[];
};

export async function getCategoryTree(includeDisabled = false): Promise<CategoryNode[]> {
  await connectDB();
  const rows = await Category.find(includeDisabled ? {} : { enabled: true }).sort({ order: 1, slug: 1 }).lean();
  const nodes = new Map<string, CategoryNode>();
  for (const r of rows as (CategoryDoc & { _id: unknown })[]) {
    nodes.set(String(r._id), {
      id: String(r._id),
      slug: r.slug,
      name: { ta: r.name?.ta ?? r.name?.en ?? r.slug, en: r.name?.en ?? r.name?.ta ?? r.slug },
      description: { ta: r.description?.ta ?? undefined, en: r.description?.en ?? undefined },
      accent: r.accent ?? undefined,
      showInNav: r.showInNav,
      order: r.order,
      parent: r.parent ? String(r.parent) : undefined,
      children: [],
    });
  }
  const roots: CategoryNode[] = [];
  for (const n of nodes.values()) {
    if (n.parent && nodes.has(n.parent)) nodes.get(n.parent)!.children.push(n);
    else roots.push(n);
  }
  return roots;
}

export async function getCategoryBySlug(slug: string) {
  await connectDB();
  const c = await Category.findOne({ slug: slug.toLowerCase(), enabled: true }).lean();
  if (!c) return null;
  const children = await Category.find({ parent: c._id, enabled: true }).sort({ order: 1 }).lean();
  const parent = c.parent ? await Category.findById(c.parent).lean() : null;
  return { category: c, children, parent };
}

/* ---------------------------------- homepage --------------------------------- */

export type HomeSection = { key: string; category?: { slug: string; name: { ta: string; en: string }; accent?: string }; items: ArticleCard[] };

export async function getTrending(lang: Locale, limit = 8): Promise<ArticleCard[]> {
  const vis = { ...visibleFilter(), ...withLang(lang) };
  const week = new Date(Date.now() - 7 * 86400_000);
  let items = await findCards({ ...vis, publishedAt: { $gte: week } }, { lang, sort: { trending: -1, views: -1, publishedAt: -1 }, limit });
  if (items.length < limit) items = await findCards(vis, { lang, sort: { trending: -1, views: -1, publishedAt: -1 }, limit });
  return items;
}

export async function getLatest(lang: Locale, opts: { page?: number; limit?: number; category?: string } = {}) {
  await connectDB();
  const filter: Filter = { ...visibleFilter(), ...withLang(lang) };
  const page = Math.max(1, opts.page ?? 1);
  const limit = opts.limit ?? PAGE_SIZE;
  const [items, total] = await Promise.all([findCards(filter, { lang, limit, skip: (page - 1) * limit }), Article.countDocuments(filter)]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function getBreaking(lang: Locale, limit = 8) {
  await connectDB();
  return findCards({ ...visibleFilter(), ...withLang(lang), breaking: true }, { lang, limit, sort: { priority: -1, publishedAt: -1 } });
}

export async function getActiveAds(lang: Locale) {
  await connectDB();
  const now = new Date();
  const ads = await Advertisement.find({
    enabled: true,
    locales: lang,
    $and: [{ $or: [{ startsAt: { $exists: false } }, { startsAt: null }, { startsAt: { $lte: now } }] }, { $or: [{ endsAt: { $exists: false } }, { endsAt: null }, { endsAt: { $gte: now } }] }],
  }).lean();
  const bySlot: Record<string, { id: string; src: string; href: string; alt: string }[]> = {};
  for (const ad of ads) {
    (bySlot[ad.slot] ??= []).push({ id: String(ad._id), src: mediaUrl(ad.imageMedia, "lg"), href: ad.href, alt: ad.alt || ad.name });
  }
  return bySlot;
}

export async function getHomepage(lang: Locale) {
  await connectDB();
  const settings = await getSettings();
  const tree = await getCategoryTree();
  const vis = { ...visibleFilter(), ...withLang(lang) };

  const featured = await findCards({ ...vis, featured: true }, { lang, sort: { priority: -1, publishedAt: -1 }, limit: 12 });
  const latestPool = await findCards(vis, { lang, limit: 48 });
  // Headline order: admin-featured stories first, and within each group stories from the priority regions
  // (Coimbatore, Nilgiris, Tiruppur, Erode, Chennai by default) ahead of the rest. Recency is kept inside each group.
  const regions = new Set(settings.priorityRegions?.length ? settings.priorityRegions : ["coimbatore", "nilgiris", "tiruppur", "erode", "chennai"]);
  const inRegion = (c: ArticleCard) => !!c.category && regions.has(c.category.slug);
  const tier = (c: ArticleCard) => (c.featured ? 0 : 2) + (inRegion(c) ? 0 : 1);
  const ranked = [...new Map([...featured, ...latestPool].map((c) => [c.id, c])).values()];
  ranked.sort((a, b) => tier(a) - tier(b)); // stable: keeps priority / recency order within a tier
  const used = new Set<string>();
  const lead = ranked[0];
  if (lead) used.add(lead.id);
  const secondary: ArticleCard[] = [];
  for (const c of ranked.slice(1)) {
    if (used.has(c.id) || secondary.length >= 4) continue; // a story appears once on the page
    used.add(c.id);
    secondary.push(c);
  }
  const latest = latestPool.filter((c) => !used.has(c.id)).slice(0, 10);
  // Use today's AI-refreshed headline wording on the homepage headline area, when there is one.
  const headlineCards = [lead, ...secondary, ...latest].filter((c): c is ArticleCard => !!c && c.lang === "ta");
  if (headlineCards.length) {
    const rows = await Article.find({ _id: { $in: headlineCards.map((c) => c.id) }, "headline.ta": { $exists: true, $ne: "" } }).select("headline").lean();
    const fresh = new Map(rows.map((r) => [String(r._id), (r as { headline?: { ta?: string } }).headline?.ta]));
    for (const c of headlineCards) {
      const hl = fresh.get(c.id);
      if (hl) c.title = hl;
    }
  }

  const configured = (settings.homepageSections ?? []).filter((s) => s.enabled !== false && s.key && !["latest", "trending", "gallery"].includes(s.key)).sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
  const flat = tree.flatMap((n) => [n, ...n.children]);
  const sectionDefs = configured.length
    ? configured.map((s) => ({ node: flat.find((n) => n.slug === s.key), limit: s.limit ?? 5 })).filter((s): s is { node: CategoryNode; limit: number } => !!s.node)
    : tree.filter((n) => n.showInNav).map((n) => ({ node: n, limit: 5 }));

  const sections: HomeSection[] = await Promise.all(
    sectionDefs.map(async ({ node, limit }) => {
      const ids = [node.id, ...node.children.map((c) => c.id)];
      const items = await findCards({ ...vis, category: { $in: ids } }, { lang, limit });
      return { key: node.slug, category: { slug: node.slug, name: node.name, accent: node.accent }, items };
    }),
  );

  const [breaking, trending, ads] = await Promise.all([getBreaking(lang), getTrending(lang), getActiveAds(lang)]);
  const customHeadlines = (settings.customHeadlines ?? [])
    .filter((h) => h.enabled !== false && h.text)
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
    .map((h) => ({ text: h.text as string, href: h.href || undefined }));
  return { breaking, lead, secondary, latest, trending, sections: sections.filter((s) => s.items.length), customHeadlines, ads, settings };
}

/* ---------------------------------- categories ------------------------------- */

export async function getCategoryFeed(lang: Locale, categoryIds: string[], opts: { page?: number; sort?: "latest" | "popular"; tag?: string }) {
  await connectDB();
  const filter: Filter = { ...visibleFilter(), ...withLang(lang), category: { $in: categoryIds } };
  if (opts.tag) {
    const t = await Tag.findOne({ slug: opts.tag.toLowerCase() }).select("_id").lean();
    if (t) filter.tags = t._id;
    else return { items: [], total: 0, page: 1, pages: 1 };
  }
  const page = Math.max(1, opts.page ?? 1);
  const sort: Record<string, SortOrder> = opts.sort === "popular" ? { views: -1, publishedAt: -1 } : { publishedAt: -1 };
  const [items, total] = await Promise.all([findCards(filter, { lang, sort, limit: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE }), Article.countDocuments(filter)]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

/* ------------------------------------ search --------------------------------- */

export async function searchArticles(lang: Locale, p: { q?: string; category?: string; tag?: string; sort?: "latest" | "relevance" | "popular"; page?: number }) {
  await connectDB();
  const page = Math.max(1, p.page ?? 1);
  const base: Filter = { ...visibleFilter(), ...withLang(lang) };
  if (p.category) {
    const c = await Category.findOne({ slug: p.category.toLowerCase() }).lean();
    if (!c) return { items: [], total: 0, page, pages: 1, mode: "none" as const };
    const kids = await Category.find({ parent: c._id }).select("_id").lean();
    base.category = { $in: [c._id, ...kids.map((k) => k._id)] };
  }
  if (p.tag) {
    const t = await Tag.findOne({ slug: p.tag.toLowerCase() }).select("_id").lean();
    if (!t) return { items: [], total: 0, page, pages: 1, mode: "none" as const };
    base.tags = t._id;
  }
  const q = p.q?.trim();
  const skip = (page - 1) * PAGE_SIZE;
  if (!q) {
    const sort: Record<string, SortOrder> = p.sort === "popular" ? { views: -1, publishedAt: -1 } : { publishedAt: -1 };
    const [items, total] = await Promise.all([findCards(base, { lang, sort, skip }), Article.countDocuments(base)]);
    return { items, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), mode: "browse" as const };
  }
  // 1) MongoDB text index (whitespace tokenisation, no stemming — works for Tamil and English words).
  const textFilter = { ...base, $text: { $search: q } };
  const byRelevance = p.sort === "relevance" || !p.sort;
  const [textItems, textTotal] = await Promise.all([
    findCards(textFilter, {
      lang,
      skip,
      extra: { score: { $meta: "textScore" } },
      sort: byRelevance ? ({ score: { $meta: "textScore" }, publishedAt: -1 } as never) : p.sort === "popular" ? { views: -1 } : { publishedAt: -1 },
    }),
    Article.countDocuments(textFilter),
  ]);
  if (textTotal > 0) return { items: textItems, total: textTotal, page, pages: Math.max(1, Math.ceil(textTotal / PAGE_SIZE)), mode: "text" as const };
  // 2) Fallback: case-insensitive substring match, which catches Tamil inflected forms the text index cannot.
  const rx = new RegExp(escapeRegex(q), "i");
  // $and, not a spread: base already carries the visibility $or, which a second $or key would silently replace.
  const rxFilter: Filter = { $and: [base, { $or: [{ [`title.${lang}`]: rx }, { [`excerpt.${lang}`]: rx }, { [`searchText.${lang}`]: rx }] }] };
  const [items, total] = await Promise.all([findCards(rxFilter, { lang, skip }), Article.countDocuments(rxFilter)]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), mode: "substring" as const };
}

/* ------------------------------------ detail --------------------------------- */

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

export async function getPublicArticle(lang: Locale, slug: string) {
  await connectDB();
  const filter: Filter = { ...visibleFilter(), $and: [{ $or: [{ "slug.ta": slug }, { "slug.en": slug }] }] };
  const row = await Article.findOne(filter)
    .populate("category", "slug name accent parent")
    .populate("author", "name bio")
    .populate("submitter", "name")
    .populate("tags", "slug name")
    .lean();
  if (!row) return null;
  const card = toCard(row as never, lang);
  // Which language do we actually show? Prefer the requested one if it exists, otherwise be honest about the fallback.
  const language: Locale = row.languageAvailability?.[lang] ? lang : row.languageAvailability?.[otherLocale(lang)] ? otherLocale(lang) : lang;
  const l = language;
  const category = row.category as unknown as (CategoryDoc & { _id: unknown }) | null;
  const crumbs: { slug: string; name: string }[] = [];
  if (category) {
    if (category.parent) {
      const p = await Category.findById(category.parent).lean();
      if (p) crumbs.push({ slug: p.slug, name: p.name?.[l] || p.name?.[otherLocale(l)] || p.slug });
    }
    crumbs.push({ slug: category.slug, name: category.name?.[l] || category.name?.[otherLocale(l)] || category.slug });
  }
  const view: ArticleView = {
    card: { ...toCard(row as never, l), lang: l, fallback: language !== lang },
    html: row.body?.[l] ?? "",
    requestedLang: lang,
    language,
    languageNotice: language !== lang,
    seo: {
      title: row.seoTitle?.[l] || row.title?.[l] || "",
      description: row.seoDescription?.[l] || row.excerpt?.[l] || "",
      canonical: row.canonicalUrl ?? undefined,
    },
    sources: (row.sources ?? []).map((s) => ({ label: s.label ?? undefined, url: s.url ?? undefined })),
    credits: row.credits ?? undefined,
    location: row.location ?? undefined,
    tags: ((row.tags ?? []) as unknown as { slug: string; name: { ta?: string; en?: string } }[]).map((t) => ({ slug: t.slug, name: t.name?.[l] || t.name?.[otherLocale(l)] || t.slug })),
    breadcrumb: crumbs,
    updatedAt: row.updatedAt.toISOString(),
    publishedAt: (row.publishedAt ?? undefined)?.toISOString(),
    authorBio: (row.author as unknown as { bio?: string } | null)?.bio ?? undefined,
  };
  void card;
  return { view, doc: row };
}

export async function getRelatedAndAdjacent(lang: Locale, a: { id: string; category?: string; tags: string[]; publishedAt?: Date }) {
  const vis = { ...visibleFilter(), ...withLang(lang), _id: { $ne: a.id } };
  const related = await findCards(
    { $and: [vis, { $or: [...(a.category ? [{ category: a.category }] : []), ...(a.tags.length ? [{ tags: { $in: a.tags } }] : [])] }] },
    { lang, limit: 4 },
  );
  const at = a.publishedAt ?? new Date();
  const [prev, next] = await Promise.all([
    findCards({ ...vis, publishedAt: { $lt: at } }, { lang, limit: 1 }),
    findCards({ ...vis, publishedAt: { $gt: at } }, { lang, limit: 1, sort: { publishedAt: 1 } }),
  ]);
  return { related, prev: prev[0], next: next[0] };
}

export async function getByAuthor(lang: Locale, authorId: string, page = 1) {
  await connectDB();
  const author = await User.findOne({ _id: authorId, publicAuthor: true, accountStatus: "active" }).select("name bio").lean();
  if (!author) return null;
  const filter: Filter = { ...visibleFilter(), ...withLang(lang), author: author._id };
  const [items, total] = await Promise.all([findCards(filter, { lang, skip: (page - 1) * PAGE_SIZE }), Article.countDocuments(filter)]);
  return { author: { id: String(author._id), name: author.name, bio: author.bio ?? undefined }, items, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getGallery(lang: Locale, page = 1) {
  await connectDB();
  const pageSize = 24;
  const filter: Filter = { visibility: "public", article: { $exists: true }, deletedAt: { $exists: false } };
  const [assets, total] = await Promise.all([
    MediaAsset.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    MediaAsset.countDocuments(filter),
  ]);
  const articleIds = [...new Set(assets.map((a) => String(a.article)))];
  const arts = await Article.find({ _id: { $in: articleIds }, ...visibleFilter() }).select("slug title languageAvailability").lean();
  const byId = new Map(arts.map((a) => [String(a._id), a]));
  const items = assets
    .map((m) => {
      const a = byId.get(String(m.article));
      if (!a) return null;
      const use = a.languageAvailability?.[lang] ? lang : otherLocale(lang);
      return { id: String(m._id), src: mediaUrl(m._id, "md"), thumb: mediaUrl(m._id, "sm"), caption: m.caption?.[lang] || m.caption?.[otherLocale(lang)] || a.title?.[use] || "", credit: m.credit ?? undefined, slug: a.slug?.[use] ?? "", lang: use as Locale };
    })
    .filter((x): x is NonNullable<typeof x> => !!x && !!x.slug);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

/** Sitemap source: only publicly visible articles. */
export async function getSitemapArticles(limit = 5000) {
  await connectDB();
  return Article.find(visibleFilter()).select("slug updatedAt publishedAt title languageAvailability").sort({ publishedAt: -1 }).limit(limit).lean();
}

export async function getFeedArticles(lang: Locale, categorySlug?: string, limit = 30) {
  await connectDB();
  const filter: Filter = { ...visibleFilter(), ...withLang(lang) };
  if (categorySlug) {
    const c = await Category.findOne({ slug: categorySlug }).lean();
    if (!c) return [];
    const kids = await Category.find({ parent: c._id }).select("_id").lean();
    filter.category = { $in: [c._id, ...kids.map((k) => k._id)] };
  }
  return Article.find(filter).sort({ publishedAt: -1 }).limit(limit).populate("category", "slug name").populate("author", "name").populate("submitter", "name").lean();
}
