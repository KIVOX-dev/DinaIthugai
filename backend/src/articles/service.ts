import { connectDB, oid } from "../db";
import { Article, ArticleRevision, Category, EditorialReview, MediaAsset, Tag, User, type ArticleDoc } from "../models";
import { can, isStaff } from "../shared/permissions";
import { ServiceError, forbidden, invalid, notFound, type Principal } from "../services/common";
import { audit, notify } from "../services/platform";
import { getSettings } from "../services/settings";
import { syncMediaVisibility } from "../services/media";
import { articleInputSchema, flattenIssues, reasonSchema, type ArticleInput } from "../validation/schemas";
import { htmlToText, mediaIdsInBody, plain, sanitizeBody, slugify, truncate, wordCount } from "../text";
import { AUTHOR_EDITABLE, REASON_REQUIRED, checkTransition, type ArticleStatus } from "../shared/article-states";
import { invalidatePublic } from "./cache";

type Lang = "ta" | "en";
const LANGS: Lang[] = ["ta", "en"];

export const isOwner = (actor: Principal | null, a: Pick<ArticleDoc, "submitter" | "createdBy">) =>
  !!actor && (String(a.submitter ?? "") === actor.id || String(a.createdBy) === actor.id);

/** Whether the actor may read this article in the dashboard (drafts of community authors stay private). */
export function canView(actor: Principal | null, a: Pick<ArticleDoc, "submitter" | "createdBy" | "source" | "status" | "submission">): boolean {
  if (!actor) return false;
  if (isOwner(actor, a)) return true;
  if (!isStaff(actor)) return false;
  if (a.source === "community" && (a.status === "draft" || (a.status === "archived" && !a.submission?.submittedAt))) return false;
  return can(actor, "articles.review") || can(actor, "articles.edit") || can(actor, "articles.approve") || can(actor, "articles.publish");
}

export function canEdit(actor: Principal | null, a: Pick<ArticleDoc, "submitter" | "createdBy" | "source" | "status" | "submission">): boolean {
  if (!actor || actor.status === "suspended") return false;
  if (a.status === "archived" || a.status === "rejected") return can(actor, "articles.edit") && canView(actor, a);
  if (isOwner(actor, a) && AUTHOR_EDITABLE.includes(a.status as ArticleStatus)) return true;
  if (!can(actor, "articles.edit")) return false;
  return canView(actor, a);
}

/* ----------------------------------- slugs ---------------------------------- */

async function uniqueSlug(lang: Lang, base: string, excludeId?: unknown) {
  const root = base || "article";
  let candidate = root;
  for (let n = 2; n < 200; n++) {
    const q: Record<string, unknown> = { [`slug.${lang}`]: candidate };
    if (excludeId) q._id = { $ne: excludeId };
    const clash = await Article.exists(q);
    if (!clash) return candidate;
    candidate = `${root}-${n}`;
  }
  return `${root}-${Date.now().toString(36)}`;
}

/* --------------------------------- snapshots -------------------------------- */

async function snapshot(a: ArticleDoc & { _id: unknown }, kind: "edit" | "submit" | "approve" | "publish" | "ai_accept" | "restore", by: string | undefined, note?: string) {
  await ArticleRevision.create({
    article: a._id,
    revision: a.revision,
    kind,
    snapshot: { title: a.title, subtitle: a.subtitle, excerpt: a.excerpt, body: a.body, seoTitle: a.seoTitle, seoDescription: a.seoDescription },
    featuredImage: a.featuredImage,
    status: a.status,
    by,
    note,
  });
}

/* ------------------------------------ save ----------------------------------- */

export type SaveOptions = { autosave?: boolean; revisionKind?: "edit" | "ai_accept"; note?: string };

async function resolveMedia(actor: Principal, bodyIds: string[], featured: string | null | undefined, existing: string[]) {
  const all = [...new Set([...bodyIds, ...(featured ? [featured] : [])])];
  if (!all.length) return { ids: [] as string[] };
  const ids = all.map((i) => oid(i)).filter(Boolean) as NonNullable<ReturnType<typeof oid>>[];
  const found = await MediaAsset.find({ _id: { $in: ids }, deletedAt: { $exists: false } }).select("owner").lean();
  const foundSet = new Set(found.map((f) => String(f._id)));
  for (const id of all) {
    if (!foundSet.has(id)) throw invalid("An image in this article no longer exists.", { body: "v.media_missing" });
  }
  // Contributors may only attach their own uploads (prevents referencing someone else's private images).
  if (!can(actor, "media.manage")) {
    for (const f of found) {
      if (String(f.owner) !== actor.id && !existing.includes(String(f._id))) throw forbidden("You can only use images that you uploaded.");
    }
  }
  return { ids: all };
}

function cleanLocalized(v: { ta?: string; en?: string } | undefined) {
  return { ta: plain(v?.ta), en: plain(v?.en) };
}

/** Turns {"a.b": 1, c: 2} into {a:{b:1}, c:2} for Model.create. */
function expandDotted(o: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    const parts = k.split(".");
    let cur = out;
    parts.forEach((p, i) => {
      if (i === parts.length - 1) cur[p] = v;
      else cur = (cur[p] ??= {}) as Record<string, unknown>;
    });
  }
  return out;
}

type LiveArticle = ArticleDoc & { _id: unknown; save(): Promise<unknown>; set(p: string, v: unknown): void };

export async function saveArticle(actor: Principal, id: string | null, raw: unknown, opts: SaveOptions = {}) {
  await connectDB();
  if (actor.status === "suspended") throw forbidden();
  const parsed = articleInputSchema.safeParse(raw);
  if (!parsed.success) throw invalid("Please correct the highlighted fields.", flattenIssues(parsed.error));
  const input: ArticleInput = parsed.data;
  const settings = await getSettings();
  const staff = isStaff(actor);

  let a: LiveArticle | null = null;
  if (id) {
    const _id = oid(id);
    if (!_id) throw notFound();
    a = (await Article.findOne({ _id, deletedAt: { $exists: false } })) as unknown as LiveArticle | null;
    if (!a) throw notFound();
    if (!canView(actor, a)) throw notFound(); // never reveal that another user's draft exists
    if (!canEdit(actor, a)) throw forbidden("This article can no longer be edited.");
  } else {
    if (!can(actor, "articles.create") && !(actor.role === "contributor" || actor.role === "reader")) throw forbidden();
    if (!staff && !settings.submissions?.enabled) throw new ServiceError("unavailable", "Article submissions are currently closed.");
  }

  const title = cleanLocalized(input.title);
  const body = { ta: sanitizeBody(input.body.ta), en: sanitizeBody(input.body.en) };
  const excerpt = cleanLocalized(input.excerpt);
  for (const l of LANGS) if (!excerpt[l] && body[l]) excerpt[l] = truncate(htmlToText(body[l]), 200);

  const availability = { ta: !!title.ta && wordCount(body.ta) > 0, en: !!title.en && wordCount(body.en) > 0 };

  const existingMedia = a ? (a.media ?? []).map(String) : [];
  const bodyIds = [...mediaIdsInBody(body.ta), ...mediaIdsInBody(body.en)];
  const { ids: mediaIds } = await resolveMedia(actor, bodyIds, input.featuredImage ?? null, existingMedia);
  const maxImages = settings.submissions?.maxImagesPerArticle ?? 8;
  if (!staff && mediaIds.length > maxImages) throw invalid(`A submission may include at most ${maxImages} photographs.`, { body: "v.too_many_images" });

  let category: unknown = null;
  if (input.category) {
    const c = await Category.findOne({ _id: input.category, enabled: true }).select("_id").lean();
    if (!c) throw invalid("Choose a valid category.", { category: "v.invalid" });
    category = c._id;
  }
  let tags: unknown[] = [];
  if (input.tags.length) tags = (await Tag.find({ _id: { $in: input.tags } }).select("_id").lean()).map((t) => t._id);

  const searchText = { ta: htmlToText([title.ta, excerpt.ta, body.ta].join(" ")), en: htmlToText([title.en, excerpt.en, body.en].join(" ")) };

  const fields: Record<string, unknown> = {
    title,
    subtitle: cleanLocalized(input.subtitle),
    excerpt,
    body,
    searchText,
    languageAvailability: availability,
    preferredLanguage: input.preferredLanguage,
    category,
    tags,
    location: input.location ? plain(input.location) : undefined,
    sources: input.sources.map((s) => ({ label: plain(s.label), url: s.url })),
    featuredImage: input.featuredImage ?? null,
    featuredCaption: cleanLocalized(input.featuredCaption),
    featuredCredit: input.featuredCredit ? plain(input.featuredCredit) : undefined,
    media: mediaIds,
    seoTitle: cleanLocalized(input.seoTitle),
    seoDescription: cleanLocalized(input.seoDescription),
  };
  const asOwner = !a || isOwner(actor, a);
  if (asOwner) {
    fields["submission.authorNotes"] = input.authorNotes ? plain(input.authorNotes) : undefined;
    if (input.declaration !== undefined) fields["submission.declaration"] = input.declaration;
  }
  if (staff && can(actor, "articles.edit")) {
    fields.authorName = input.authorName ? plain(input.authorName) : undefined;
    fields.canonicalUrl = input.canonicalUrl || undefined;
    fields.edition = input.edition ? plain(input.edition) : undefined;
    if (input.authorId) {
      const au = await User.findById(input.authorId).select("_id").lean();
      if (au) fields.author = au._id;
    }
  }
  if (can(actor, "articles.feature")) {
    if (input.featured !== undefined) fields.featured = input.featured;
    if (input.trending !== undefined) fields.trending = input.trending;
    if (input.breaking !== undefined) fields.breaking = input.breaking;
    if (input.priority !== undefined) fields.priority = input.priority;
  }

  // slugs are stable once assigned; staff may edit them explicitly
  const slugs: Record<Lang, string | undefined> = { ta: a?.slug?.ta ?? undefined, en: a?.slug?.en ?? undefined };
  for (const l of LANGS) {
    const requested = staff && can(actor, "articles.edit") && input.slug?.[l] ? slugify(input.slug[l]!) : "";
    if (requested && requested !== slugs[l]) slugs[l] = await uniqueSlug(l, requested, a?._id);
    else if (!slugs[l] && title[l]) slugs[l] = await uniqueSlug(l, slugify(title[l]), a?._id);
  }
  fields.slug = { ta: slugs.ta, en: slugs.en };

  const contentChanged = !a || JSON.stringify([a.title, a.body, a.subtitle, a.excerpt]) !== JSON.stringify([fields.title, fields.body, fields.subtitle, fields.excerpt]);

  const slugClash = () => new ServiceError("conflict", "That URL slug is already taken. Choose another.", { slug: "v.slug_taken" });
  if (!a) {
    const source = staff && can(actor, "articles.create") ? "staff" : "community";
    try {
      a = (await Article.create({
        ...expandDotted(fields),
        source,
        status: "draft",
        createdBy: actor.id,
        submitter: source === "community" ? actor.id : undefined,
        author: source === "staff" ? actor.id : undefined,
        revision: 1,
      })) as unknown as LiveArticle;
    } catch (e) {
      if ((e as { code?: number }).code === 11000) throw slugClash();
      throw e;
    }
    await snapshot(a, "edit", actor.id);
    await audit(actor, "article.create", { type: "article", id: String(a._id) }, { source });
  } else {
    if (contentChanged && !opts.autosave) a.revision = (a.revision ?? 1) + 1;
    for (const [k, v] of Object.entries(fields)) a.set(k, v);
    try {
      await a.save();
    } catch (e) {
      if ((e as { code?: number }).code === 11000) throw slugClash();
      throw e;
    }
    if (contentChanged && !opts.autosave) await snapshot(a, opts.revisionKind ?? "edit", actor.id, opts.note);
    if (a.status === "published" || a.status === "scheduled") {
      await syncMediaVisibility(String(a._id), true);
      await invalidatePublic();
    }
    await audit(actor, opts.autosave ? "article.autosave" : "article.update", { type: "article", id: String(a._id) });
  }
  return { id: String(a._id), revision: a.revision, slug: { ta: slugs.ta, en: slugs.en } };
}

/* ---------------------------------- transitions ------------------------------- */

export type TransitionOpts = { reason?: string; scheduledAt?: Date | string | null; system?: boolean };

type ReviewAction = "assigned" | "start_review" | "approved" | "rejected" | "changes_requested" | "reopened" | "resubmitted" | "published" | "scheduled" | "unpublished" | "archived" | "restored";

function reviewActionFor(from: ArticleStatus, to: ArticleStatus): ReviewAction | undefined {
  if (to === "in_review") return from === "rejected" ? "reopened" : "start_review";
  if (to === "submitted") return from === "changes_requested" ? "resubmitted" : undefined;
  if (to === "draft" && from === "archived") return "restored";
  if (["approved", "rejected", "changes_requested", "published", "scheduled", "unpublished", "archived"].includes(to)) return to as ReviewAction;
  return undefined;
}

const NOTICE: Partial<Record<ArticleStatus, { type: string; title: { ta: string; en: string } }>> = {
  submitted: { type: "submission.received", title: { en: "Your article was submitted for review", ta: "உங்கள் கட்டுரை பரிசீலனைக்கு சமர்ப்பிக்கப்பட்டது" } },
  in_review: { type: "submission.in_review", title: { en: "Your article is now under review", ta: "உங்கள் கட்டுரை பரிசீலனையில் உள்ளது" } },
  changes_requested: { type: "submission.changes_requested", title: { en: "Changes requested on your article", ta: "உங்கள் கட்டுரையில் திருத்தங்கள் கோரப்பட்டுள்ளன" } },
  approved: { type: "submission.approved", title: { en: "Your article was approved", ta: "உங்கள் கட்டுரை ஒப்புதல் பெற்றது" } },
  rejected: { type: "submission.rejected", title: { en: "Your article was not accepted", ta: "உங்கள் கட்டுரை ஏற்கப்படவில்லை" } },
  scheduled: { type: "submission.scheduled", title: { en: "Your article is scheduled for publication", ta: "உங்கள் கட்டுரை வெளியிட திட்டமிடப்பட்டுள்ளது" } },
  published: { type: "submission.published", title: { en: "Your article is now published", ta: "உங்கள் கட்டுரை வெளியிடப்பட்டது" } },
};

export async function transitionArticle(actor: Principal | null, id: string, to: ArticleStatus, opts: TransitionOpts = {}) {
  await connectDB();
  const _id = oid(id);
  if (!_id) throw notFound();
  const a = await Article.findOne({ _id, deletedAt: { $exists: false } });
  if (!a) throw notFound();
  if (!opts.system) {
    if (!actor || actor.status === "suspended") throw forbidden();
    if (!canView(actor, a)) throw notFound();
  }
  const from = a.status as ArticleStatus;

  // Idempotent: repeating a transition that already happened is a no-op, not an error or a duplicate publish.
  if (from === to && ["published", "scheduled", "approved", "archived", "unpublished"].includes(to)) {
    return { id, status: to, changed: false };
  }

  const verdict = checkTransition({ from, to, source: a.source as "staff" | "community", actor, isOwner: isOwner(actor, a), system: opts.system });
  if (!verdict.ok) throw new ServiceError(verdict.code === "forbidden" ? "forbidden" : "conflict", verdict.message);

  let reason: string | undefined;
  if (REASON_REQUIRED.includes(to)) {
    const r = reasonSchema.safeParse(opts.reason);
    if (!r.success) throw invalid("A reason is required.", { reason: "v.reason_short" });
    reason = plain(r.data);
  } else if (opts.reason) reason = plain(opts.reason).slice(0, 2000);

  const settings = await getSettings();
  const set: Record<string, unknown> = { status: to };
  const unset: Record<string, 1> = {};
  const now = new Date();

  if (to === "submitted") {
    if (!isStaff(actor) && settings.submissions?.requireVerifiedEmail && !actor?.emailVerified) throw forbidden("Verify your email address before submitting.");
    if (a.source === "community" && !settings.submissions?.enabled) throw new ServiceError("unavailable", "Article submissions are currently closed.");
    const pref = (a.preferredLanguage as Lang) ?? "ta";
    if (!a.title?.[pref] || !a.languageAvailability?.[pref]) throw invalid("Add a title and the article text in your preferred language.", { body: "v.required" });
    if (a.source === "community") {
      if (!a.submission?.declaration) throw invalid("You must confirm that you own or may submit this content.", { declaration: "v.declaration" });
      const min = settings.submissions?.minWords ?? 80;
      if (wordCount(a.body?.[pref]) < min) throw invalid(`The article must contain at least ${min} words.`, { body: "v.min_words" });
      if (!a.category) throw invalid("Choose a category.", { category: "v.required" });
    }
    set.lockedRevision = a.revision;
    set["submission.submittedAt"] = now;
    unset["submission.reviewNote"] = 1;
  }
  if (to === "published" || to === "scheduled") {
    if (!a.category) throw invalid("Choose a category before publishing.", { category: "v.required" });
    if (!a.languageAvailability?.ta && !a.languageAvailability?.en) throw invalid("The article needs a title and text in at least one language.", { body: "v.required" });
  }
  if (to === "scheduled") {
    const when = opts.scheduledAt ? new Date(opts.scheduledAt) : null;
    if (!when || isNaN(+when)) throw invalid("Choose a publication date and time.", { scheduledAt: "v.required" });
    if (when.getTime() < Date.now() - 60_000) throw invalid("The scheduled time must be in the future.", { scheduledAt: "v.future" });
    set.scheduledAt = when;
    set.publishedAt = when; // sort key only; visibility is gated on status + scheduledAt <= now
    set.publishedBy = actor?.id;
  }
  if (to === "published") {
    if (from === "scheduled") set.publishedAt = a.scheduledAt ?? now;
    else if (from === "unpublished" && a.publishedAt) set.publishedAt = a.publishedAt;
    else set.publishedAt = now;
    set.publishedBy = opts.system ? (a.publishedBy ?? undefined) : actor?.id;
    unset.unpublishedAt = 1;
    unset.archivedAt = 1;
  }
  if (from === "scheduled" && to === "approved") {
    unset.scheduledAt = 1;
    unset.publishedAt = 1;
  }
  if (to === "unpublished") set.unpublishedAt = now;
  if (to === "archived") set.archivedAt = now;
  if (from === "archived" && to === "draft") unset.archivedAt = 1;
  if (to === "rejected" || to === "changes_requested") set["submission.reviewNote"] = reason;
  if (to === "in_review" && actor && !a.assignedEditor) set.assignedEditor = actor.id;

  // Compare-and-set on the previous status so concurrent/duplicate requests cannot double-apply.
  const updated = await Article.findOneAndUpdate({ _id, status: from }, { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) }, { returnDocument: "after" });
  if (!updated) {
    const current = await Article.findById(_id).select("status").lean();
    if (current?.status === to) return { id, status: to, changed: false };
    throw new ServiceError("conflict", "The article changed while you were working. Reload and try again.");
  }

  const action = reviewActionFor(from, to);
  if (actor && action) {
    await EditorialReview.create({ article: _id, reviewer: actor.id, action, fromStatus: from, toStatus: to, reason, revision: a.revision });
  }
  if (to === "submitted" || to === "approved" || to === "published") {
    await snapshot(updated as unknown as ArticleDoc & { _id: unknown }, to === "submitted" ? "submit" : to === "approved" ? "approve" : "publish", actor?.id, reason);
  }

  if (to === "published" || to === "scheduled") await syncMediaVisibility(id, true);
  if (to === "unpublished" || to === "archived" || (from === "scheduled" && to === "approved")) await syncMediaVisibility(id, false);
  if (["published", "scheduled", "unpublished", "archived"].includes(to) || ["published", "scheduled"].includes(from)) await invalidatePublic();

  await audit(actor ?? { id: "system", role: "system" }, `article.${to}`, { type: "article", id }, { from, system: !!opts.system });

  const notice = NOTICE[to];
  if (notice && a.submitter && a.source === "community") {
    await notify(String(a.submitter), {
      type: notice.type,
      title: notice.title,
      body: reason ? { en: reason, ta: reason } : undefined,
      link: `/${(a.preferredLanguage as Lang) ?? "ta"}/account/submissions/${id}`,
      // 'published' is keyed only by article+revision so a retry can never notify twice; other events may legitimately repeat.
      dedupeKey: to === "published" ? `${notice.type}:${id}` : `${notice.type}:${id}:${a.revision}:${+now}`,
    });
  }
  if (to === "submitted") await notifyReviewers(id, a, actor);
  return { id, status: to, changed: true };
}

async function notifyReviewers(id: string, a: ArticleDoc, actor: Principal | null) {
  const lang = (a.preferredLanguage as Lang) ?? "ta";
  const reviewers = await User.find({ accountStatus: "active", role: { $in: ["editor", "admin", "super_admin"] } }).select("_id").limit(50).lean();
  const title = a.title?.[lang] ?? "Untitled";
  await Promise.all(
    reviewers
      .filter((r) => String(r._id) !== actor?.id)
      .map((r) =>
        notify(String(r._id), {
          type: "review.new_submission",
          title: { en: "New article awaiting review", ta: "பரிசீலனைக்கு புதிய கட்டுரை" },
          body: { en: title, ta: title },
          link: `/admin/articles/${id}`,
          dedupeKey: `review.new:${id}:${a.revision}`,
          email: false,
        }),
      ),
  );
}

/* ----------------------------- assignment & notes ----------------------------- */

export async function assignEditor(actor: Principal, id: string, editorId: string) {
  await connectDB();
  if (!can(actor, "articles.review")) throw forbidden();
  const _id = oid(id);
  const eid = oid(editorId);
  if (!_id || !eid) throw notFound();
  const [a, editor] = await Promise.all([Article.findOne({ _id, deletedAt: { $exists: false } }), User.findOne({ _id: eid, accountStatus: "active" })]);
  if (!a || !editor) throw notFound();
  if (!canView(actor, a)) throw notFound();
  const isEditor = ["editor", "admin", "super_admin"].includes(editor.role) || (editor.permissions ?? []).includes("articles.review");
  if (!isEditor) throw invalid("That user cannot review articles.");
  a.assignedEditor = editor._id;
  await a.save();
  await EditorialReview.create({ article: _id, reviewer: actor.id, action: "assigned", reason: `Assigned to ${editor.name}`, fromStatus: a.status, toStatus: a.status, revision: a.revision });
  await notify(String(editor._id), {
    type: "review.assigned",
    title: { en: "An article was assigned to you", ta: "ஒரு கட்டுரை உங்களுக்கு ஒதுக்கப்பட்டது" },
    body: { en: a.title?.en || a.title?.ta || "", ta: a.title?.ta || a.title?.en || "" },
    link: `/admin/articles/${id}`,
    dedupeKey: `review.assigned:${id}:${editorId}`,
    email: false,
  });
  await audit(actor, "article.assign", { type: "article", id }, { editor: editorId });
}

export async function addInternalNote(actor: Principal, id: string, note: string) {
  await connectDB();
  if (!can(actor, "articles.review")) throw forbidden();
  const text = plain(note).slice(0, 2000);
  if (!text) throw invalid("Write a note.");
  const _id = oid(id);
  const a = _id && (await Article.findOne({ _id }));
  if (!a || !canView(actor, a)) throw notFound();
  await Article.updateOne({ _id }, { $push: { "submission.internalNotes": { by: actor.id, note: text, at: new Date() } } });
  await audit(actor, "article.note", { type: "article", id });
}

export async function setFlags(actor: Principal, id: string, flags: { featured?: boolean; trending?: boolean; breaking?: boolean; priority?: number }) {
  await connectDB();
  if (!can(actor, "articles.feature")) throw forbidden();
  const _id = oid(id);
  if (!_id) throw notFound();
  const set: Record<string, unknown> = {};
  if (flags.featured !== undefined) set.featured = flags.featured;
  if (flags.trending !== undefined) set.trending = flags.trending;
  if (flags.breaking !== undefined) set.breaking = flags.breaking;
  if (flags.priority !== undefined) set.priority = Math.max(0, Math.min(100, Math.round(flags.priority)));
  const r = await Article.updateOne({ _id, deletedAt: { $exists: false } }, { $set: set });
  if (!r.matchedCount) throw notFound();
  await audit(actor, "article.flags", { type: "article", id }, set);
  await invalidatePublic();
}

export async function deleteArticle(actor: Principal, id: string) {
  await connectDB();
  const _id = oid(id);
  const a = _id && (await Article.findOne({ _id, deletedAt: { $exists: false } }));
  if (!a) throw notFound();
  const ownDraft = isOwner(actor, a) && (a.status === "draft" || a.status === "changes_requested") && !a.submission?.submittedAt;
  if (!ownDraft && !(can(actor, "articles.delete") && canView(actor, a))) throw forbidden();
  if (a.status === "published" || a.status === "scheduled") throw new ServiceError("conflict", "Unpublish the article before deleting it.");
  a.deletedAt = new Date();
  await a.save();
  await audit(actor, "article.delete", { type: "article", id });
}

export async function restoreRevision(actor: Principal, id: string, revision: number) {
  await connectDB();
  const _id = oid(id);
  const a = _id && (await Article.findOne({ _id }));
  if (!a) throw notFound();
  if (!canView(actor, a)) throw notFound();
  if (!canEdit(actor, a)) throw forbidden();
  const rev = await ArticleRevision.findOne({ article: _id, revision }).sort({ createdAt: -1 }).lean();
  if (!rev) throw notFound();
  const snap = rev.snapshot!;
  for (const f of ["title", "subtitle", "excerpt", "seoTitle", "seoDescription"] as const) a.set(f, snap[f]);
  const body = { ta: sanitizeBody(snap.body?.ta), en: sanitizeBody(snap.body?.en) };
  a.set("body", body);
  a.set("languageAvailability", { ta: !!a.title?.ta && wordCount(body.ta) > 0, en: !!a.title?.en && wordCount(body.en) > 0 });
  a.set("searchText", { ta: htmlToText([a.title?.ta, a.excerpt?.ta, body.ta].join(" ")), en: htmlToText([a.title?.en, a.excerpt?.en, body.en].join(" ")) });
  a.revision = (a.revision ?? 1) + 1;
  await a.save();
  await snapshot(a as unknown as ArticleDoc & { _id: unknown }, "restore", actor.id, `Restored from revision ${revision}`);
  await audit(actor, "article.restore_revision", { type: "article", id }, { revision });
  if (a.status === "published") await invalidatePublic();
}

/* ------------------------------ scheduled publishing --------------------------- */

/**
 * Finalises scheduled articles whose time has come. Safe to call repeatedly and concurrently:
 * the compare-and-set in `transitionArticle` guarantees a single publish and a single notification.
 * (Public visibility does not depend on this job running: queries also accept `scheduled && scheduledAt <= now`.)
 */
export async function publishDueScheduled(now = new Date()) {
  await connectDB();
  const due = await Article.find({ status: "scheduled", scheduledAt: { $lte: now }, deletedAt: { $exists: false } }).select("_id").limit(200).lean();
  let published = 0;
  for (const d of due) {
    try {
      const r = await transitionArticle(null, String(d._id), "published", { system: true, reason: "Scheduled publication" });
      if (r.changed) published++;
    } catch (e) {
      console.error("[scheduler] failed to publish", String(d._id), e);
    }
  }
  return { due: due.length, published };
}
