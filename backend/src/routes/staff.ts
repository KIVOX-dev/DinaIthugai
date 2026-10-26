import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { env } from "../env";
import { connectDB } from "../db";
import { addInternalNote, assignEditor, deleteArticle, publishDueScheduled, restoreRevision, saveArticle, setFlags, transitionArticle } from "../articles/service";
import { dashboardStats, getArticleForEdit, listAdminArticles, listAuthors, listEditors, listMySubmissions, recentAudit } from "../articles/admin-queries";
import { STATUSES } from "../shared/article-states";
import { Category, User } from "../models";
import { cleanupUnusedMedia, deleteMedia, listMedia, replaceMedia, updateMediaMeta, uploadImage } from "../services/media";
import { deleteAd, deleteCategory, listAds, listTags, saveAd, saveCategory, saveSettings, saveTag } from "../services/admin";
import { addUserNote, adminRevokeSessions, adminTriggerReset, adminUpdateUser, adminVerifyEmail, exportUsersCsv, getUserDetail, listUsers, processDeletion, setAccountStatus, setPublicAuthor, setRoleAndPermissions } from "../services/users";
import { runAiAssist } from "../ai/rewrite";
import { importDinamalar, purgeImportedMedia } from "../import/dinamalar";
import { getSettings } from "../services/settings";
import { ServiceError } from "../services/common";
import { param, requirePerm, requireStaff, requireUser, user } from "../http";

/** Routes open to any signed-in user (contributors manage their own submissions); the services enforce object-level access. */
export const articlesRouter = Router();
articlesRouter.use(requireUser);

articlesRouter.get("/mine", async (req, res) => {
  const status = typeof req.query.status === "string" && (STATUSES as readonly string[]).includes(req.query.status) ? req.query.status : undefined;
  res.json(await listMySubmissions(user(req), status));
});
articlesRouter.post("/", async (req, res) => {
  res.status(201).json(await saveArticle(user(req), null, req.body));
});
articlesRouter.get("/:id", async (req, res) => {
  res.json({ article: await getArticleForEdit(user(req), param(req, "id")) });
});
articlesRouter.put("/:id", async (req, res) => {
  res.json(await saveArticle(user(req), param(req, "id"), req.body, { autosave: req.query.autosave === "1" }));
});
articlesRouter.delete("/:id", async (req, res) => {
  await deleteArticle(user(req), param(req, "id"));
  res.json({ ok: true });
});
articlesRouter.post("/:id/transition", async (req, res) => {
  const b = z.object({ to: z.enum(STATUSES), reason: z.string().max(2000).optional(), scheduledAt: z.string().optional() }).parse(req.body);
  res.json(await transitionArticle(user(req), param(req, "id"), b.to, { reason: b.reason, scheduledAt: b.scheduledAt }));
});
articlesRouter.post("/:id/revisions/:rev/restore", async (req, res) => {
  await restoreRevision(user(req), param(req, "id"), Number(param(req, "rev")));
  res.json({ ok: true });
});
articlesRouter.post("/:id/assign", async (req, res) => {
  await assignEditor(user(req), param(req, "id"), String(req.body?.editorId ?? ""));
  res.json({ ok: true });
});
articlesRouter.post("/:id/notes", async (req, res) => {
  await addInternalNote(user(req), param(req, "id"), String(req.body?.note ?? ""));
  res.json({ ok: true });
});
articlesRouter.patch("/:id/flags", async (req, res) => {
  const b = z.object({ featured: z.boolean().optional(), trending: z.boolean().optional(), breaking: z.boolean().optional(), priority: z.number().optional() }).parse(req.body);
  await setFlags(user(req), param(req, "id"), b);
  res.json({ ok: true });
});

/* -------------------------------- media upload -------------------------------- */

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: Math.min(env().UPLOAD_MAX_MB, 25) * 1048576, files: 1 } });
export const mediaRouter = Router();
mediaRouter.use(requireUser);
mediaRouter.post("/", upload.single("file"), async (req, res) => {
  if (!req.file) throw new ServiceError("invalid", "Choose an image to upload.", { file: "v.required" });
  const t = (k: string) => (typeof req.body?.[k] === "string" ? (req.body[k] as string) : undefined);
  const dto = await uploadImage(user(req), { buffer: req.file.buffer, name: req.file.originalname }, { credit: t("credit"), caption: { ta: t("captionTa"), en: t("captionEn") }, alt: { ta: t("altTa"), en: t("altEn") } });
  res.status(201).json({ media: dto });
});
mediaRouter.get("/", async (req, res) => {
  res.json(await listMedia(user(req), { page: Number(req.query.page) || 1, q: typeof req.query.q === "string" ? req.query.q : undefined, mine: req.query.mine === "1" }));
});
mediaRouter.patch("/:id", async (req, res) => {
  res.json({ media: await updateMediaMeta(user(req), param(req, "id"), req.body ?? {}) });
});
mediaRouter.put("/:id/file", upload.single("file"), async (req, res) => {
  if (!req.file) throw new ServiceError("invalid", "Choose an image.", { file: "v.required" });
  res.json({ media: await replaceMedia(user(req), param(req, "id"), req.file.buffer) });
});
mediaRouter.delete("/:id", async (req, res) => {
  await deleteMedia(user(req), param(req, "id"));
  res.json({ ok: true });
});

/* ------------------------------------ AI ------------------------------------- */

export const aiRouter = Router();
aiRouter.post("/assist", requireStaff, requirePerm("ai.rewrite"), async (req, res) => {
  res.json({ result: await runAiAssist(user(req), req.body) });
});

/* ---------------------------------- admin API -------------------------------- */

export const adminRouter = Router();
adminRouter.use(requireStaff);

adminRouter.get("/stats", async (req, res) => res.json(await dashboardStats(user(req))));
adminRouter.get("/articles", async (req, res) => {
  const q = req.query as Record<string, string | undefined>;
  res.json(await listAdminArticles(user(req), { q: q.q, status: q.status, source: q.source, category: q.category, lang: q.lang, assigned: q.assigned, page: Number(q.page) || 1, queue: q.queue === "1" }));
});
adminRouter.get("/editors", async (req, res) => res.json({ items: await listEditors(user(req)) }));
adminRouter.get("/authors", async (req, res) => res.json({ items: await listAuthors(user(req)) }));
adminRouter.get("/audit", requirePerm("audit.view"), async (req, res) => {
  res.json(await recentAudit(user(req), Number(req.query.page) || 1, typeof req.query.action === "string" ? req.query.action : undefined));
});

// taxonomy
adminRouter.get("/categories", async (_req, res) => {
  await connectDB();
  const rows = await Category.find().sort({ order: 1, slug: 1 }).lean();
  res.json({ items: rows.map((c) => ({ id: String(c._id), slug: c.slug, name: { ta: c.name?.ta ?? "", en: c.name?.en ?? "" }, parent: c.parent ? String(c.parent) : null, order: c.order, showInNav: c.showInNav, enabled: c.enabled, accent: c.accent ?? "" })) });
});
adminRouter.post("/categories", async (req, res) => res.status(201).json(await saveCategory(user(req), null, req.body)));
adminRouter.put("/categories/:id", async (req, res) => res.json(await saveCategory(user(req), param(req, "id"), req.body)));
adminRouter.delete("/categories/:id", async (req, res) => {
  await deleteCategory(user(req), param(req, "id"));
  res.json({ ok: true });
});
adminRouter.get("/tags", async (req, res) => res.json({ items: await listTags(typeof req.query.q === "string" ? req.query.q : undefined) }));
adminRouter.post("/tags", async (req, res) => res.status(201).json(await saveTag(user(req), req.body)));

// settings & ads
adminRouter.get("/settings", requirePerm("settings.manage"), async (_req, res) => {
  const s = await getSettings();
  res.json({ settings: s });
});
adminRouter.put("/settings", async (req, res) => {
  await saveSettings(user(req), req.body);
  res.json({ ok: true });
});
adminRouter.get("/ads", async (req, res) => res.json({ items: await listAds(user(req)) }));
adminRouter.post("/ads", async (req, res) => res.status(201).json(await saveAd(user(req), null, req.body)));
adminRouter.put("/ads/:id", async (req, res) => res.json(await saveAd(user(req), param(req, "id"), req.body)));
adminRouter.delete("/ads/:id", async (req, res) => {
  await deleteAd(user(req), param(req, "id"));
  res.json({ ok: true });
});

// users
adminRouter.get("/users", async (req, res) => {
  const q = req.query as Record<string, string | undefined>;
  res.json(await listUsers(user(req), { q: q.q, role: q.role, status: q.status, from: q.from, to: q.to, page: Number(q.page) || 1 }));
});
adminRouter.get("/users/export.csv", async (req, res) => {
  const csv = await exportUsersCsv(user(req));
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="users.csv"');
  res.send(csv);
});
adminRouter.get("/users/:id", async (req, res) => res.json(await getUserDetail(user(req), param(req, "id"))));
adminRouter.put("/users/:id", async (req, res) => {
  await adminUpdateUser(user(req), param(req, "id"), req.body);
  res.json({ ok: true });
});
adminRouter.post("/users/:id/role", async (req, res) => {
  const b = z.object({ role: z.string(), permissions: z.array(z.string()).default([]), confirm: z.boolean().optional(), reauthPassword: z.string().max(128).optional() }).parse(req.body);
  await setRoleAndPermissions(user(req), param(req, "id"), b);
  res.json({ ok: true });
});
adminRouter.post("/users/:id/status", async (req, res) => {
  const b = z.object({ status: z.enum(["active", "suspended", "disabled"]), reason: z.string().max(500).optional(), confirm: z.boolean().optional() }).parse(req.body);
  await setAccountStatus(user(req), param(req, "id"), b.status, b);
  res.json({ ok: true });
});
adminRouter.post("/users/:id/revoke-sessions", async (req, res) => {
  await adminRevokeSessions(user(req), param(req, "id"));
  res.json({ ok: true });
});
adminRouter.post("/users/:id/reset-password", async (req, res) => {
  await adminTriggerReset(user(req), param(req, "id"));
  res.json({ ok: true });
});
adminRouter.post("/users/:id/verify-email", async (req, res) => {
  await adminVerifyEmail(user(req), param(req, "id"));
  res.json({ ok: true });
});
adminRouter.post("/users/:id/notes", async (req, res) => {
  await addUserNote(user(req), param(req, "id"), String(req.body?.note ?? ""));
  res.json({ ok: true });
});
adminRouter.post("/users/:id/public-author", async (req, res) => {
  await setPublicAuthor(user(req), param(req, "id"), !!req.body?.on);
  res.json({ ok: true });
});
adminRouter.post("/users/:id/delete", async (req, res) => {
  await processDeletion(user(req), param(req, "id"), { confirm: !!req.body?.confirm });
  res.json({ ok: true });
});

/* ------------------------------------ cron ----------------------------------- */

export const cronRouter = Router();
cronRouter.all("/publish-scheduled", async (req, res) => {
  const secret = env().CRON_SECRET;
  const given = req.headers.authorization?.replace(/^Bearer /, "");
  if (!secret || given !== secret) throw new ServiceError("unauthorized", "Unauthorized");
  const r = await publishDueScheduled();
  const c = await cleanupUnusedMedia();
  const d = await purgeImportedMedia();
  res.json({ ...r, mediaRemoved: c.removed, importedMediaRemoved: d.removed });
});

cronRouter.all("/import-dinamalar", async (req, res) => {
  const secret = env().CRON_SECRET;
  const given = req.headers.authorization?.replace(/^Bearer /, "");
  if (!secret || given !== secret) throw new ServiceError("unauthorized", "Unauthorized");
  res.json(await importDinamalar({ limit: 8 }));
});

void User;
