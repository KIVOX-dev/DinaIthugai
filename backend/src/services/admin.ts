import { z } from "zod";
import { connectDB, oid } from "../db";
import { Advertisement, AD_SLOTS, Article, Category, MediaAsset, Notification, SiteSettings, Tag } from "../models";
import { can } from "../shared/permissions";
import { plain } from "../text";
import { ServiceError, forbidden, invalid, notFound, type Principal } from "./common";
import { audit } from "./platform";
import { getSettings } from "./settings";
import { flattenIssues } from "../validation/schemas";

/* ------------------------------ categories & tags ----------------------------- */

const loc = z.object({ ta: z.string().trim().max(200).default(""), en: z.string().trim().max(200).default("") });
const categorySchema = z.object({
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "v.invalid"),
  name: loc,
  description: z.object({ ta: z.string().max(500).default(""), en: z.string().max(500).default("") }).optional(),
  parent: z.string().regex(/^[a-f0-9]{24}$/).nullish(),
  order: z.number().int().min(0).max(10000).default(100),
  showInNav: z.boolean().default(true),
  enabled: z.boolean().default(true),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().or(z.literal("")),
});

/** Slugs that would collide with fixed routes under /{lang}/. */
const RESERVED = new Set(["news", "search", "latest", "trending", "gallery", "authors", "login", "register", "forgot-password", "reset-password", "verify-email", "account", "about", "contact", "editorial-policy", "corrections-policy", "privacy", "terms", "admin", "api"]);

export async function saveCategory(actor: Principal, id: string | null, raw: unknown) {
  await connectDB();
  if (!can(actor, "categories.manage")) throw forbidden();
  const p = categorySchema.safeParse(raw);
  if (!p.success) throw invalid("Please correct the highlighted fields.", flattenIssues(p.error));
  const v = p.data;
  if (RESERVED.has(v.slug)) throw invalid("That slug is reserved.", { slug: "v.invalid" });
  if (!v.name.ta && !v.name.en) throw invalid("Enter a name in at least one language.", { name: "v.required" });
  const doc = {
    slug: v.slug,
    name: { ta: plain(v.name.ta), en: plain(v.name.en) },
    description: v.description,
    parent: v.parent || null,
    order: v.order,
    showInNav: v.showInNav,
    enabled: v.enabled,
    accent: v.accent || undefined,
  };
  try {
    if (id) {
      const _id = oid(id);
      if (!_id || String(v.parent) === id) throw notFound();
      const r = await Category.findByIdAndUpdate(_id, doc, { returnDocument: "after" });
      if (!r) throw notFound();
      await audit(actor, "category.update", { type: "category", id });
      return { id };
    }
    const c = await Category.create(doc);
    await audit(actor, "category.create", { type: "category", id: String(c._id) });
    return { id: String(c._id) };
  } catch (e) {
    if ((e as { code?: number }).code === 11000) throw new ServiceError("conflict", "A category with that slug exists.", { slug: "v.slug_taken" });
    throw e;
  }
}

export async function deleteCategory(actor: Principal, id: string) {
  await connectDB();
  if (!can(actor, "categories.manage")) throw forbidden();
  const _id = oid(id);
  if (!_id) throw notFound();
  if (await Article.exists({ category: _id, deletedAt: { $exists: false } })) throw new ServiceError("conflict", "Move or delete this category's articles first.");
  if (await Category.exists({ parent: _id })) throw new ServiceError("conflict", "Delete or move the sub-categories first.");
  await Category.deleteOne({ _id });
  await audit(actor, "category.delete", { type: "category", id });
}

export async function listTags(q?: string) {
  await connectDB();
  const f = q ? { slug: new RegExp("^" + q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").toLowerCase()) } : {};
  const tags = await Tag.find(f).sort({ slug: 1 }).limit(100).lean();
  return tags.map((t) => ({ id: String(t._id), slug: t.slug, name: { ta: t.name?.ta ?? "", en: t.name?.en ?? "" } }));
}

export async function saveTag(actor: Principal, raw: unknown) {
  await connectDB();
  if (!can(actor, "categories.manage") && !can(actor, "articles.edit")) throw forbidden();
  const p = z.object({ slug: z.string().trim().toLowerCase().min(1).max(60).regex(/^[\p{L}\p{M}\p{N}-]+$/u), name: loc }).safeParse(raw);
  if (!p.success) throw invalid("Invalid tag.", flattenIssues(p.error));
  const t = await Tag.findOneAndUpdate({ slug: p.data.slug }, { $set: { name: { ta: plain(p.data.name.ta), en: plain(p.data.name.en) } } }, { upsert: true, returnDocument: "after" });
  return { id: String(t._id), slug: t.slug };
}

/* --------------------------------- settings ---------------------------------- */

const settingsSchema = z.object({
  siteName: loc.optional(),
  tagline: loc.optional(),
  defaultLocale: z.enum(["ta", "en"]).optional(),
  edition: loc.optional(),
  homepageSections: z.array(z.object({ key: z.string().max(80), enabled: z.boolean().default(true), order: z.number().int().default(100), limit: z.number().int().min(1).max(12).default(5) })).max(30).optional(),
  seo: z.object({ title: loc.optional(), description: loc.optional(), ogImage: z.string().max(300).optional() }).optional(),
  social: z.object({ facebook: z.string().max(300).optional(), x: z.string().max(300).optional(), instagram: z.string().max(300).optional(), youtube: z.string().max(300).optional(), whatsapp: z.string().max(300).optional() }).optional(),
  contact: z.object({ email: z.string().max(200).optional(), phone: z.string().max(40).optional(), address: loc.optional() }).optional(),
  footerLinks: z.array(z.object({ label: loc, href: z.string().max(300).regex(/^(https?:\/\/|\/)/) })).max(12).optional(),
  staticPages: z.record(z.string().regex(/^[a-z-]+$/), loc.extend({ ta: z.string().max(60000).default(""), en: z.string().max(60000).default("") })).optional(),
  submissions: z.object({ enabled: z.boolean(), requireVerifiedEmail: z.boolean(), maxImagesPerArticle: z.number().int().min(0).max(30), minWords: z.number().int().min(0).max(5000), rules: loc.optional() }).optional(),
  uploads: z.object({ maxMb: z.number().min(1).max(25), allowedTypes: z.array(z.enum(["image/jpeg", "image/png", "image/webp"])).min(1) }).optional(),
  ai: z.object({ enabled: z.boolean(), hourlyLimitPerUser: z.number().int().min(1).max(500) }).optional(),
  registrationOpen: z.boolean().optional(),
  maintenanceMode: z.boolean().optional(),
  maintenanceMessage: loc.optional(),
  breakingBanner: z.object({ enabled: z.boolean(), label: loc }).optional(),
});

export async function saveSettings(actor: Principal, raw: unknown) {
  await connectDB();
  if (!can(actor, "settings.manage")) throw forbidden();
  const p = settingsSchema.safeParse(raw);
  if (!p.success) throw invalid("Please correct the highlighted fields.", flattenIssues(p.error));
  await getSettings();
  const $set: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p.data)) if (v !== undefined) $set[k] = k === "staticPages" ? sanitizePages(v as Record<string, { ta: string; en: string }>) : v;
  await SiteSettings.updateOne({ key: "site" }, { $set });
  await audit(actor, "settings.update", { type: "settings", id: "site" }, { keys: Object.keys($set) });
}

import { sanitizeBody } from "../text";
function sanitizePages(p: Record<string, { ta: string; en: string }>) {
  return Object.fromEntries(Object.entries(p).map(([k, v]) => [k, { ta: sanitizeBody(v.ta), en: sanitizeBody(v.en) }]));
}

/* ------------------------------------ ads ------------------------------------ */

const adSchema = z.object({
  slot: z.enum(AD_SLOTS),
  name: z.string().trim().min(1).max(120),
  imageMedia: z.string().regex(/^[a-f0-9]{24}$/),
  href: z.string().trim().max(500).regex(/^https?:\/\//, "v.url"),
  alt: z.string().max(200).optional(),
  enabled: z.boolean().default(true),
  startsAt: z.string().datetime().optional().or(z.literal("")),
  endsAt: z.string().datetime().optional().or(z.literal("")),
  locales: z.array(z.enum(["ta", "en"])).default(["ta", "en"]),
});

export async function listAds(actor: Principal) {
  await connectDB();
  if (!can(actor, "settings.manage")) throw forbidden();
  const ads = await Advertisement.find().sort({ createdAt: -1 }).lean();
  return ads.map((a) => ({ id: String(a._id), slot: a.slot, name: a.name, imageMedia: String(a.imageMedia), href: a.href, alt: a.alt ?? "", enabled: a.enabled, startsAt: a.startsAt?.toISOString(), endsAt: a.endsAt?.toISOString(), locales: a.locales }));
}

export async function saveAd(actor: Principal, id: string | null, raw: unknown) {
  await connectDB();
  if (!can(actor, "settings.manage")) throw forbidden();
  const p = adSchema.safeParse(raw);
  if (!p.success) throw invalid("Please correct the highlighted fields.", flattenIssues(p.error));
  const m = await MediaAsset.findById(p.data.imageMedia).select("_id").lean();
  if (!m) throw invalid("Choose an uploaded image.", { imageMedia: "v.invalid" });
  const doc = { ...p.data, name: plain(p.data.name), alt: p.data.alt ? plain(p.data.alt) : undefined, startsAt: p.data.startsAt || undefined, endsAt: p.data.endsAt || undefined };
  let adId = id;
  if (id) {
    const _id = oid(id);
    if (!_id || !(await Advertisement.findByIdAndUpdate(_id, doc))) throw notFound();
  } else adId = String((await Advertisement.create(doc))._id);
  // Ad creatives are public by design: mark the image deliverable.
  await MediaAsset.updateOne({ _id: p.data.imageMedia }, { $set: { visibility: "public" } });
  await audit(actor, id ? "ad.update" : "ad.create", { type: "ad", id: adId! });
  return { id: adId! };
}

export async function deleteAd(actor: Principal, id: string) {
  await connectDB();
  if (!can(actor, "settings.manage")) throw forbidden();
  const _id = oid(id);
  if (!_id) throw notFound();
  await Advertisement.deleteOne({ _id });
  await audit(actor, "ad.delete", { type: "ad", id });
}

/* ------------------------------- notifications ------------------------------- */

export async function listNotifications(actor: Principal, limit = 50) {
  await connectDB();
  const rows = await Notification.find({ user: actor.id }).sort({ createdAt: -1 }).limit(limit).lean();
  const unread = await Notification.countDocuments({ user: actor.id, readAt: { $exists: false } });
  return { unread, items: rows.map((n) => ({ id: String(n._id), type: n.type, title: n.title, body: n.body, link: n.link, read: !!n.readAt, at: n.createdAt.toISOString() })) };
}

export async function markNotificationsRead(actor: Principal) {
  await connectDB();
  await Notification.updateMany({ user: actor.id, readAt: { $exists: false } }, { $set: { readAt: new Date() } });
}
