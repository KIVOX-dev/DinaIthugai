import type { Filter } from "../filter";
import { connectDB, oid } from "../db";
import { Article, ArticleRevision, AuditLog, Category, EditorialReview, MediaAsset, Tag, User, type ArticleDoc } from "../models";
import { can, isStaff } from "../shared/permissions";
import { forbidden, notFound, type Principal } from "../services/common";
import { escapeRegex } from "../text";
import { mediaUrl, toMediaDTO } from "../services/media";
import { canEdit, canView, isOwner } from "./service";
import { IN_REVIEW_QUEUE, type ArticleStatus } from "../shared/article-states";

const PAGE = 20;

export type AdminRow = {
  id: string;
  title: string;
  titleTa?: string;
  titleEn?: string;
  status: ArticleStatus;
  source: string;
  category?: string;
  submitter?: string;
  assignedEditor?: string;
  languages: { ta: boolean; en: boolean };
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  publishedAt?: string;
  scheduledAt?: string;
  featured: boolean;
  breaking: boolean;
  images: number;
};

const toRow = (a: ArticleDoc & { category?: { name?: { ta?: string; en?: string } } | null; submitter?: { name?: string } | null; assignedEditor?: { name?: string } | null }): AdminRow => ({
  id: String(a._id),
  title: a.title?.en || a.title?.ta || "(untitled)",
  titleTa: a.title?.ta || undefined,
  titleEn: a.title?.en || undefined,
  status: a.status as ArticleStatus,
  source: a.source,
  category: a.category?.name?.en || a.category?.name?.ta || undefined,
  submitter: a.submitter?.name,
  assignedEditor: a.assignedEditor?.name,
  languages: { ta: !!a.languageAvailability?.ta, en: !!a.languageAvailability?.en },
  createdAt: a.createdAt.toISOString(),
  updatedAt: a.updatedAt.toISOString(),
  submittedAt: a.submission?.submittedAt?.toISOString(),
  publishedAt: a.publishedAt?.toISOString(),
  scheduledAt: a.scheduledAt?.toISOString(),
  featured: !!a.featured,
  breaking: !!a.breaking,
  images: (a.media?.length ?? 0) + (a.featuredImage && !(a.media ?? []).map(String).includes(String(a.featuredImage)) ? 1 : 0),
});

export type AdminFilters = { q?: string; status?: string; source?: string; category?: string; lang?: string; assigned?: string; page?: number; queue?: boolean };

export async function listAdminArticles(actor: Principal, f: AdminFilters) {
  await connectDB();
  if (!isStaff(actor)) throw forbidden();
  const filter: Filter = { deletedAt: { $exists: false } };
  const seeAll = can(actor, "articles.review") || can(actor, "articles.edit") || can(actor, "articles.publish");
  if (!seeAll) filter.$or = [{ createdBy: actor.id }, { submitter: actor.id }]; // reporters see their own work only
  else filter.$nor = [{ source: "community", status: "draft" }, { source: "community", status: "archived", "submission.submittedAt": { $exists: false } }]; // authors' private drafts stay private
  if (f.queue) filter.status = { $in: IN_REVIEW_QUEUE };
  if (f.status) filter.status = f.status as ArticleStatus;
  if (f.queue && f.source === undefined) filter.source = "community";
  if (f.source === "community" || f.source === "staff") filter.source = f.source;
  if (f.category) {
    const c = await Category.findOne({ slug: f.category }).select("_id").lean();
    filter.category = c ? c._id : null;
  }
  if (f.lang === "ta" || f.lang === "en") filter[`languageAvailability.${f.lang}`] = true;
  if (f.assigned === "me") filter.assignedEditor = actor.id;
  if (f.assigned === "none") filter.assignedEditor = { $exists: false };
  if (f.q) {
    const rx = new RegExp(escapeRegex(f.q.slice(0, 100)), "i");
    filter.$and = [{ $or: [{ "title.ta": rx }, { "title.en": rx }] }];
  }
  const page = Math.max(1, f.page ?? 1);
  const [rows, total] = await Promise.all([
    Article.find(filter)
      .sort(f.queue ? { "submission.submittedAt": 1, createdAt: 1 } : { updatedAt: -1 })
      .skip((page - 1) * PAGE)
      .limit(PAGE)
      .populate("category", "name")
      .populate("submitter", "name")
      .populate("assignedEditor", "name")
      .lean(),
    Article.countDocuments(filter),
  ]);
  return { items: rows.map((r) => toRow(r as never)), total, page, pages: Math.max(1, Math.ceil(total / PAGE)) };
}

export async function dashboardStats(actor: Principal) {
  await connectDB();
  if (!isStaff(actor)) throw forbidden();
  const now = new Date();
  const base = { deletedAt: { $exists: false } };
  const count = (extra: Filter) => Article.countDocuments({ ...base, ...extra });
  const [total, published, drafts, pending, changes, rejected, scheduled, users, active, suspended, activity] = await Promise.all([
    count({ $nor: [{ source: "community", status: "draft" }] }),
    count({ status: "published" }),
    count({ status: "draft", source: "staff" }),
    count({ status: { $in: ["submitted", "in_review"] } }),
    count({ status: "changes_requested" }),
    count({ status: "rejected" }),
    count({ status: "scheduled", scheduledAt: { $gt: now } }),
    can(actor, "users.view") ? User.countDocuments({ accountStatus: { $ne: "deleted" } }) : Promise.resolve(null),
    can(actor, "users.view") ? User.countDocuments({ accountStatus: "active" }) : Promise.resolve(null),
    can(actor, "users.view") ? User.countDocuments({ accountStatus: { $in: ["suspended", "disabled"] } }) : Promise.resolve(null),
    EditorialReview.find().sort({ createdAt: -1 }).limit(12).populate("reviewer", "name").populate("article", "title").lean(),
  ]);
  return {
    articles: { total, published, drafts, pending, changes, rejected, scheduled },
    users: users === null ? null : { total: users, active, suspended },
    activity: activity.map((a) => ({
      id: String(a._id),
      action: a.action,
      reason: a.reason ?? undefined,
      at: (a as unknown as { createdAt: Date }).createdAt.toISOString(),
      by: (a.reviewer as unknown as { name?: string } | null)?.name ?? "—",
      articleId: a.article ? String((a.article as unknown as { _id: unknown })._id) : undefined,
      articleTitle: (a.article as unknown as { title?: { en?: string; ta?: string } } | null)?.title?.en || (a.article as unknown as { title?: { ta?: string } } | null)?.title?.ta || "—",
    })),
  };
}

export type EditArticleDTO = Awaited<ReturnType<typeof getArticleForEdit>>;

/** Loads an article for the editor, enforcing object-level authorisation (no IDOR). */
export async function getArticleForEdit(actor: Principal, id: string) {
  await connectDB();
  const _id = oid(id);
  if (!_id) throw notFound();
  const a = await Article.findOne({ _id, deletedAt: { $exists: false } }).lean();
  if (!a || !canView(actor, a as never)) throw notFound();
  const mediaIds = [...new Set([...(a.media ?? []).map(String), ...(a.featuredImage ? [String(a.featuredImage)] : [])])];
  const [media, tags, history, revisions, submitter, assigned, authorUser] = await Promise.all([
    MediaAsset.find({ _id: { $in: mediaIds } }).lean(),
    Tag.find({ _id: { $in: a.tags ?? [] } }).lean(),
    EditorialReview.find({ article: _id }).sort({ createdAt: 1 }).populate("reviewer", "name").lean(),
    ArticleRevision.find({ article: _id }).sort({ createdAt: -1 }).limit(40).populate("by", "name").lean(),
    a.submitter ? User.findById(a.submitter).select("name email").lean() : null,
    a.assignedEditor ? User.findById(a.assignedEditor).select("name").lean() : null,
    a.author ? User.findById(a.author).select("name").lean() : null,
  ]);
  const reviewer = can(actor, "articles.review");
  return {
    id: String(a._id),
    status: a.status as ArticleStatus,
    source: a.source,
    revision: a.revision,
    lockedRevision: a.lockedRevision ?? undefined,
    preferredLanguage: (a.preferredLanguage ?? "ta") as "ta" | "en",
    title: { ta: a.title?.ta ?? "", en: a.title?.en ?? "" },
    subtitle: { ta: a.subtitle?.ta ?? "", en: a.subtitle?.en ?? "" },
    excerpt: { ta: a.excerpt?.ta ?? "", en: a.excerpt?.en ?? "" },
    body: { ta: a.body?.ta ?? "", en: a.body?.en ?? "" },
    seoTitle: { ta: a.seoTitle?.ta ?? "", en: a.seoTitle?.en ?? "" },
    seoDescription: { ta: a.seoDescription?.ta ?? "", en: a.seoDescription?.en ?? "" },
    slug: { ta: a.slug?.ta ?? "", en: a.slug?.en ?? "" },
    category: a.category ? String(a.category) : "",
    tags: tags.map((t) => ({ id: String(t._id), slug: t.slug, name: t.name?.en || t.name?.ta || t.slug })),
    location: a.location ?? "",
    authorNotes: a.submission?.authorNotes ?? "",
    declaration: !!a.submission?.declaration,
    reviewNote: a.submission?.reviewNote ?? undefined,
    sources: (a.sources ?? []).map((s) => ({ label: s.label ?? "", url: s.url ?? "" })),
    featuredImage: a.featuredImage ? String(a.featuredImage) : "",
    featuredCaption: { ta: a.featuredCaption?.ta ?? "", en: a.featuredCaption?.en ?? "" },
    featuredCredit: a.featuredCredit ?? "",
    media: media.map((m) => toMediaDTO(m as never)),
    authorName: a.authorName ?? "",
    authorId: a.author ? String(a.author) : "",
    authorLabel: authorUser?.name,
    canonicalUrl: a.canonicalUrl ?? "",
    edition: a.edition ?? "",
    featured: !!a.featured,
    trending: !!a.trending,
    breaking: !!a.breaking,
    priority: a.priority ?? 0,
    scheduledAt: a.scheduledAt?.toISOString(),
    publishedAt: a.publishedAt?.toISOString(),
    availability: { ta: !!a.languageAvailability?.ta, en: !!a.languageAvailability?.en },
    submitter: submitter ? { id: String(submitter._id), name: submitter.name, email: reviewer ? submitter.email : undefined } : undefined,
    assignedEditor: assigned ? { id: String(assigned._id), name: assigned.name } : undefined,
    internalNotes: reviewer ? (a.submission?.internalNotes ?? []).map((n) => ({ note: n.note ?? "", at: (n.at ?? new Date()).toISOString() })) : [],
    history: history.map((h) => ({ id: String(h._id), action: h.action, from: h.fromStatus ?? undefined, to: h.toStatus ?? undefined, reason: h.reason ?? undefined, by: (h.reviewer as unknown as { name?: string } | null)?.name ?? "—", at: (h as unknown as { createdAt: Date }).createdAt.toISOString(), revision: h.revision ?? undefined })),
    revisions: revisions.map((r) => ({
      revision: r.revision,
      kind: r.kind,
      status: r.status ?? undefined,
      note: r.note ?? undefined,
      by: (r.by as unknown as { name?: string } | null)?.name ?? "—",
      at: (r as unknown as { createdAt: Date }).createdAt.toISOString(),
      snapshot: { title: { ta: r.snapshot?.title?.ta ?? "", en: r.snapshot?.title?.en ?? "" }, body: { ta: r.snapshot?.body?.ta ?? "", en: r.snapshot?.body?.en ?? "" } },
    })),
    can: {
      edit: canEdit(actor, a as never),
      owner: isOwner(actor, a as never),
      review: reviewer,
      approve: can(actor, "articles.approve"),
      publish: can(actor, "articles.publish"),
      schedule: can(actor, "articles.schedule"),
      unpublish: can(actor, "articles.unpublish"),
      delete: can(actor, "articles.delete"),
      feature: can(actor, "articles.feature"),
      ai: can(actor, "ai.rewrite"),
      media: can(actor, "media.manage"),
    },
    previewUrls: {
      ta: a.slug?.ta ? `/ta/news/${encodeURIComponent(a.slug.ta)}` : undefined,
      en: a.slug?.en ? `/en/news/${encodeURIComponent(a.slug.en)}` : undefined,
    },
    featuredUrl: a.featuredImage ? mediaUrl(a.featuredImage, "lg") : undefined,
  };
}

/** A contributor's own submissions (never anyone else's). */
export async function listMySubmissions(actor: Principal, status?: string) {
  await connectDB();
  const filter: Filter = { deletedAt: { $exists: false }, $or: [{ submitter: actor.id }, { createdBy: actor.id }] };
  if (status) filter.status = status as ArticleStatus;
  const rows = await Article.find(filter).sort({ updatedAt: -1 }).limit(200).populate("category", "name").lean();
  const counts = await Article.aggregate([{ $match: { deletedAt: { $exists: false }, $or: [{ submitter: oid(actor.id) }, { createdBy: oid(actor.id) }] } }, { $group: { _id: "$status", n: { $sum: 1 } } }]);
  return { items: rows.map((r) => toRow(r as never)), counts: Object.fromEntries(counts.map((c) => [c._id as string, c.n as number])) as Record<string, number> };
}

export async function recentAudit(actor: Principal, page = 1, action?: string) {
  await connectDB();
  if (!can(actor, "audit.view")) throw forbidden();
  const filter: Record<string, unknown> = action ? { action: new RegExp("^" + escapeRegex(action)) } : {};
  const [rows, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * 50).limit(50).populate("actor", "name").lean(),
    AuditLog.countDocuments(filter),
  ]);
  return {
    items: rows.map((r) => ({ id: String(r._id), action: r.action, actor: (r.actor as unknown as { name?: string } | null)?.name ?? r.actorRole ?? "system", target: r.targetType ? `${r.targetType}:${r.targetId}` : "", at: r.createdAt.toISOString(), meta: r.meta ? JSON.stringify(r.meta).slice(0, 300) : "" })),
    total,
    pages: Math.max(1, Math.ceil(total / 50)),
  };
}

export async function listEditors(actor: Principal) {
  await connectDB();
  if (!can(actor, "articles.review")) throw forbidden();
  const users = await User.find({ accountStatus: "active", $or: [{ role: { $in: ["editor", "admin", "super_admin"] } }, { permissions: "articles.review" }] }).select("name role").sort({ name: 1 }).lean();
  return users.map((u) => ({ id: String(u._id), name: u.name, role: u.role }));
}

export async function listAuthors(actor: Principal) {
  await connectDB();
  if (!isStaff(actor)) throw forbidden();
  const users = await User.find({ accountStatus: "active", role: { $in: ["reporter", "editor", "admin", "super_admin"] } }).select("name role").sort({ name: 1 }).lean();
  return users.map((u) => ({ id: String(u._id), name: u.name, role: u.role }));
}
