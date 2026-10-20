import { Router } from "express";
import { z } from "zod";
import { connectDB, oid } from "../db";
import { Article, MediaAsset } from "../models";
import { isLocale, type Locale } from "../shared/i18n";
import { getSettings } from "../services/settings";
import { getMediaForDelivery, mediaUrl } from "../services/media";
import { getActiveAds, getByAuthor, getCategoryBySlug, getCategoryFeed, getCategoryTree, getFeedArticles, getGallery, getHomepage, getLatest, getPublicArticle, getRelatedAndAdjacent, getSitemapArticles, getTrending, searchArticles, visibleFilter } from "../articles/queries";
import { searchParamsSchema } from "../validation/schemas";
import { param, user } from "../http";
import { principalFromToken } from "../services/auth";
import { env, isProd } from "../env";
import { emailConfigured } from "../services/platform";

export const publicRouter = Router();

const langOf = (v: unknown): Locale => (typeof v === "string" && isLocale(v) ? v : "ta");

publicRouter.get("/site", async (req, res) => {
  const lang = langOf(req.query.lang);
  const [s, tree, ads] = await Promise.all([getSettings(), getCategoryTree(), getActiveAds(lang)]);
  res.json({
    tree,
    ads,
    settings: {
      siteName: s.siteName,
      tagline: s.tagline,
      edition: s.edition,
      defaultLocale: s.defaultLocale,
      social: s.social,
      contact: s.contact,
      footerLinks: s.footerLinks,
      seo: s.seo,
      breakingBanner: s.breakingBanner,
      maintenanceMode: s.maintenanceMode,
      maintenanceMessage: s.maintenanceMessage,
      registrationOpen: s.registrationOpen,
      submissionsEnabled: s.submissions?.enabled !== false,
      submissionRules: s.submissions?.rules,
      maxImages: s.submissions?.maxImagesPerArticle ?? 8,
      minWords: s.submissions?.minWords ?? 80,
      aiEnabled: s.ai?.enabled !== false,
      // false in production until SMTP is configured: the UI must not claim an email was sent.
      emailEnabled: emailConfigured() || !isProd(),
      logo: s.logoMediaId ? mediaUrl(s.logoMediaId, "md") : undefined,
    },
  });
});

publicRouter.get("/home", async (req, res) => {
  const h = await getHomepage(langOf(req.query.lang));
  const { settings: _s, ...rest } = h;
  void _s;
  res.json(rest);
});

publicRouter.get("/latest", async (req, res) => {
  const p = z.coerce.number().int().min(1).max(500).catch(1).parse(req.query.page);
  res.json(await getLatest(langOf(req.query.lang), { page: p }));
});

publicRouter.get("/trending", async (req, res) => {
  res.json({ items: await getTrending(langOf(req.query.lang), 20) });
});

publicRouter.get("/category/:slug", async (req, res) => {
  const lang = langOf(req.query.lang);
  const found = await getCategoryBySlug(param(req, "slug"));
  if (!found) return void res.status(404).json({ error: "Not found" });
  const q = searchParamsSchema.parse(req.query);
  const { category, children, parent } = found;
  const ids = [String(category._id), ...children.map((c) => String(c._id))];
  const feed = await getCategoryFeed(lang, ids, { page: q.page, sort: q.sort === "popular" ? "popular" : "latest", tag: q.tag });
  const nm = (c: { slug: string; name?: { ta?: string | null; en?: string | null } | null }) => ({ slug: c.slug, name: c.name?.[lang] || c.name?.[lang === "ta" ? "en" : "ta"] || c.slug });
  res.json({
    category: { ...nm(category), description: category.description?.[lang] ?? undefined, accent: category.accent ?? undefined },
    parent: parent ? nm(parent) : undefined,
    children: children.map(nm),
    ...feed,
  });
});

publicRouter.get("/article/:slug", async (req, res) => {
  const lang = langOf(req.query.lang);
  const found = await getPublicArticle(lang, param(req, "slug"));
  if (!found) return void res.status(404).json({ error: "Not found" });
  const { view, doc } = found;
  const adj = await getRelatedAndAdjacent(lang, { id: String(doc._id), category: doc.category ? String((doc.category as unknown as { _id: unknown })._id ?? doc.category) : undefined, tags: ((doc.tags ?? []) as unknown as { _id: unknown }[]).map((t) => String(t._id)), publishedAt: doc.publishedAt ?? undefined });
  res.json({ view, ...adj });
});

publicRouter.get("/search", async (req, res) => {
  const q = searchParamsSchema.parse(req.query);
  res.json(await searchArticles(langOf(req.query.lang), q));
});

publicRouter.get("/gallery", async (req, res) => {
  const p = z.coerce.number().int().min(1).max(500).catch(1).parse(req.query.page);
  res.json(await getGallery(langOf(req.query.lang), p));
});

publicRouter.get("/authors/:id", async (req, res) => {
  const p = z.coerce.number().int().min(1).max(500).catch(1).parse(req.query.page);
  const r = oid(param(req, "id")) ? await getByAuthor(langOf(req.query.lang), param(req, "id"), p) : null;
  if (!r) return void res.status(404).json({ error: "Not found" });
  res.json(r);
});

publicRouter.get("/page/:slug", async (req, res) => {
  const s = await getSettings();
  const page = (s.staticPages as Record<string, { ta?: string; en?: string }> | undefined)?.[param(req, "slug")];
  res.json({ page: page ?? null });
});

publicRouter.get("/sitemap", async (_req, res) => {
  const [articles, tree] = await Promise.all([getSitemapArticles(), getCategoryTree()]);
  res.json({
    categories: tree.flatMap((n) => [n, ...n.children]).map((c) => c.slug),
    articles: articles.map((a) => ({ id: String(a._id), slug: a.slug, title: a.title, languages: a.languageAvailability, updatedAt: a.updatedAt, publishedAt: a.publishedAt })),
  });
});

publicRouter.get("/feed", async (req, res) => {
  const lang = langOf(req.query.lang);
  const rows = await getFeedArticles(lang, typeof req.query.category === "string" ? req.query.category : undefined);
  res.json({
    items: rows.map((a) => ({
      slug: a.slug?.[lang],
      title: a.title?.[lang],
      excerpt: a.excerpt?.[lang],
      publishedAt: a.publishedAt,
      category: (a.category as unknown as { name?: Record<string, string> } | null)?.name?.[lang],
      author: a.authorName || (a.author as unknown as { name?: string } | null)?.name || (a.submitter as unknown as { name?: string } | null)?.name,
    })),
  });
});

publicRouter.post("/articles/:id/view", async (req, res) => {
  await connectDB();
  const _id = oid(param(req, "id"));
  if (_id) await Article.updateOne({ _id, ...visibleFilter() }, { $inc: { views: 1 } });
  res.json({ ok: true });
});

/** Media delivery: public only when attached to a publicly visible article; otherwise owner/staff. */
export const mediaDeliveryRouter = Router();
mediaDeliveryRouter.get("/:id/:variant", async (req, res) => {
  const token = req.cookies?.[env().SESSION_COOKIE];
  const viewer = typeof token === "string" ? await principalFromToken(token) : null;
  const r = await getMediaForDelivery(param(req, "id"), param(req, "variant"), viewer);
  if (r === "forbidden") return void res.status(viewer ? 403 : 404).end(); // do not confirm existence to anonymous probes
  if (!r) return void res.status(404).end();
  res.setHeader("Content-Type", r.contentType);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
  res.setHeader("Cache-Control", r.public ? "public, max-age=86400, stale-while-revalidate=604800" : "private, no-store");
  res.send(r.body);
});

void user;
void MediaAsset;
