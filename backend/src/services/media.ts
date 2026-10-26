import crypto from "node:crypto";
import { connectDB, oid } from "../db";
import { env } from "../env";
import { Article, MediaAsset, type MediaDoc } from "../models";
import { can, isStaff } from "../shared/permissions";
import { getStorage, getStorageFor } from "../storage";
import { ImageRejected, processImage } from "../storage/image";
import { plain } from "../text";
import { ServiceError, forbidden, invalid, notFound, type Principal } from "./common";
import { audit, enforceRateLimit } from "./platform";
import { getSettings } from "./settings";

export const mediaUrl = (id: unknown, variant: "thumb" | "sm" | "md" | "lg" | "orig" = "lg") => `/api/media/${String(id)}/${variant}`;

export type MediaDTO = {
  id: string;
  url: string;
  thumb: string;
  width?: number;
  height?: number;
  caption: { ta?: string; en?: string };
  alt: { ta?: string; en?: string };
  credit?: string;
  visibility: string;
  size: number;
  originalName?: string;
  createdAt: string;
};

export const toMediaDTO = (m: MediaDoc): MediaDTO => ({
  id: String(m._id),
  url: mediaUrl(m._id, "lg"),
  thumb: mediaUrl(m._id, "thumb"),
  width: m.width ?? undefined,
  height: m.height ?? undefined,
  caption: { ta: m.caption?.ta ?? undefined, en: m.caption?.en ?? undefined },
  alt: { ta: m.alt?.ta ?? undefined, en: m.alt?.en ?? undefined },
  credit: m.credit ?? undefined,
  visibility: m.visibility,
  size: m.size,
  originalName: m.originalName ?? undefined,
  createdAt: m.createdAt.toISOString(),
});

function newKeyPrefix() {
  const d = new Date();
  return `media/${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${crypto.randomBytes(16).toString("hex")}`;
}

async function storeVariants(buf: Buffer) {
  const settings = await getSettings();
  const e = env();
  const maxBytes = Math.min(settings.uploads?.maxMb ?? e.UPLOAD_MAX_MB, 50) * 1048576;
  let processed;
  try {
    processed = await processImage(buf, { maxBytes, maxDimension: e.UPLOAD_MAX_DIMENSION, allowedTypes: settings.uploads?.allowedTypes });
  } catch (err) {
    if (err instanceof ImageRejected) throw new ServiceError("invalid", err.message, { file: `v.upload_${err.reason}` });
    throw err;
  }
  const storage = getStorage();
  const prefix = newKeyPrefix();
  const stored: { name: string; key: string; width: number; height: number; size: number; mime: string }[] = [];
  try {
    for (const v of processed.variants) {
      const key = `${prefix}/${v.name}.webp`;
      await storage.put(key, v.buffer, "image/webp");
      stored.push({ name: v.name, key, width: v.width, height: v.height, size: v.buffer.length, mime: "image/webp" });
    }
  } catch (err) {
    await Promise.allSettled(stored.map((s) => storage.delete(s.key))); // do not leave partial uploads behind
    throw new ServiceError("unavailable", "The image could not be stored. Please try again.");
  }
  return { processed, stored, storageKind: storage.kind };
}

export async function uploadImage(actor: Principal, file: { buffer: Buffer; name?: string }, meta: { caption?: { ta?: string; en?: string }; credit?: string; alt?: { ta?: string; en?: string } } = {}, opts: { skipRateLimit?: boolean } = {}) {
  await connectDB();
  if (actor.status !== "active") throw forbidden();
  const settings = await getSettings();
  if (!isStaff(actor) && settings.submissions?.requireVerifiedEmail && !actor.emailVerified) {
    throw forbidden("Verify your email address before uploading photographs.");
  }
  if (!opts.skipRateLimit) await enforceRateLimit(`upload:${actor.id}`, 60, 3600);
  const { processed, stored, storageKind } = await storeVariants(file.buffer);
  const orig = stored.find((s) => s.name === "orig")!;
  const doc = await MediaAsset.create({
    owner: actor.id,
    key: orig.key,
    storage: storageKind,
    mime: "image/webp",
    size: orig.size,
    width: processed.width,
    height: processed.height,
    originalName: file.name ? plain(file.name).slice(0, 200) : undefined,
    sha256: crypto.createHash("sha256").update(file.buffer).digest("hex"),
    variants: stored.map((s) => ({ name: s.name, key: s.key, width: s.width, height: s.height, size: s.size, mime: s.mime })),
    caption: { ta: meta.caption?.ta && plain(meta.caption.ta), en: meta.caption?.en && plain(meta.caption.en) },
    alt: { ta: meta.alt?.ta && plain(meta.alt.ta), en: meta.alt?.en && plain(meta.alt.en) },
    credit: meta.credit ? plain(meta.credit) : undefined,
    visibility: "private",
  });
  await audit(actor, "media.upload", { type: "media", id: String(doc._id) }, { size: doc.size });
  return toMediaDTO(doc.toObject() as MediaDoc);
}

export async function updateMediaMeta(actor: Principal, id: string, patch: { caption?: { ta?: string; en?: string }; alt?: { ta?: string; en?: string }; credit?: string }) {
  await connectDB();
  const _id = oid(id);
  if (!_id) throw notFound();
  const m = await MediaAsset.findOne({ _id, deletedAt: { $exists: false } });
  if (!m) throw notFound();
  if (String(m.owner) !== actor.id && !can(actor, "media.manage")) throw forbidden();
  if (patch.caption) m.caption = { ta: plain(patch.caption.ta), en: plain(patch.caption.en) };
  if (patch.alt) m.alt = { ta: plain(patch.alt.ta), en: plain(patch.alt.en) };
  if (patch.credit !== undefined) m.credit = plain(patch.credit);
  await m.save();
  return toMediaDTO(m.toObject() as MediaDoc);
}

/** Replace the pixels of an existing asset while keeping its id (and thus every reference to it). */
export async function replaceMedia(actor: Principal, id: string, buffer: Buffer) {
  await connectDB();
  if (!can(actor, "media.manage")) throw forbidden();
  const _id = oid(id);
  const m = _id && (await MediaAsset.findOne({ _id, deletedAt: { $exists: false } }));
  if (!m) throw notFound();
  const oldKeys = m.variants.map((v) => v.key!).filter(Boolean);
  const oldStore = getStorageFor(m.storage as "b2" | "local");
  const { processed, stored, storageKind } = await storeVariants(buffer);
  const orig = stored.find((s) => s.name === "orig")!;
  m.key = orig.key;
  m.storage = storageKind;
  m.size = orig.size;
  m.width = processed.width;
  m.height = processed.height;
  m.set(
    "variants",
    stored.map((s) => ({ name: s.name, key: s.key, width: s.width, height: s.height, size: s.size, mime: s.mime })),
  );
  await m.save();
  // Only delete old objects after the DB points at the new ones.
  await Promise.allSettled(oldKeys.map((k) => oldStore.delete(k)));
  await audit(actor, "media.replace", { type: "media", id });
  return toMediaDTO(m.toObject() as MediaDoc);
}

export async function deleteMedia(actor: Principal, id: string) {
  await connectDB();
  const _id = oid(id);
  const m = _id && (await MediaAsset.findOne({ _id, deletedAt: { $exists: false } }));
  if (!m) throw notFound();
  const isOwner = String(m.owner) === actor.id;
  if (!can(actor, "media.manage") && !(isOwner && !m.article)) throw forbidden();
  const inUse = await Article.exists({ $or: [{ featuredImage: m._id }, { media: m._id }], deletedAt: { $exists: false } });
  if (inUse) throw new ServiceError("conflict", "This image is used by an article. Remove it from the article first.");
  await removeAssetObjects(m);
  await MediaAsset.deleteOne({ _id: m._id });
  await audit(actor, "media.delete", { type: "media", id });
}

export async function removeAssetObjects(m: MediaDoc) {
  const keys = new Set<string>([m.key, ...m.variants.map((v) => v.key!).filter(Boolean)]);
  const store = getStorageFor(m.storage as "b2" | "local");
  await Promise.allSettled([...keys].map((k) => store.delete(k)));
}

/** Removes uploads that never became part of an article (default: older than 24h). */
export async function cleanupUnusedMedia(olderThanHours = 24) {
  await connectDB();
  const cutoff = new Date(Date.now() - olderThanHours * 3600_000);
  const candidates = await MediaAsset.find({ createdAt: { $lt: cutoff }, article: { $exists: false } }).limit(500);
  let removed = 0;
  for (const m of candidates) {
    const inUse = await Article.exists({ $or: [{ featuredImage: m._id }, { media: m._id }] });
    if (inUse) continue;
    await removeAssetObjects(m);
    await MediaAsset.deleteOne({ _id: m._id });
    removed++;
  }
  return { removed };
}

export type DeliveryResult = { body: Buffer; contentType: string; public: boolean };

/**
 * Authorisation for media delivery.
 * Public only if the asset was marked public by a visible article; otherwise owner or authorised staff.
 */
export async function getMediaForDelivery(id: string, variant: string, viewer: Principal | null): Promise<DeliveryResult | "forbidden" | null> {
  await connectDB();
  const _id = oid(id);
  if (!_id) return null;
  const m = await MediaAsset.findOne({ _id, deletedAt: { $exists: false } }).lean();
  if (!m) return null;
  const isPublic = m.visibility === "public";
  if (!isPublic) {
    const ok = !!viewer && (String(m.owner) === viewer.id || can(viewer, "articles.review") || can(viewer, "articles.edit") || can(viewer, "media.manage"));
    if (!ok) return "forbidden";
  }
  const v = m.variants.find((x) => x.name === variant) ?? m.variants.find((x) => x.name === "lg") ?? m.variants[0];
  const key = v?.key ?? m.key;
  const obj = await getStorageFor(m.storage as "b2" | "local").get(key);
  if (!obj) return null;
  return { body: obj.body, contentType: "image/webp", public: isPublic };
}

export async function listMedia(actor: Principal, opts: { page?: number; q?: string; mine?: boolean }) {
  await connectDB();
  if (!can(actor, "media.manage") && !opts.mine) throw forbidden();
  const page = Math.max(1, opts.page ?? 1);
  const filter: Record<string, unknown> = { deletedAt: { $exists: false } };
  if (opts.mine || !can(actor, "media.manage")) filter.owner = actor.id;
  if (opts.q) filter.$or = [{ originalName: new RegExp(opts.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }, { credit: new RegExp(opts.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }];
  const [items, total] = await Promise.all([
    MediaAsset.find(filter).sort({ createdAt: -1 }).skip((page - 1) * 40).limit(40).lean(),
    MediaAsset.countDocuments(filter),
  ]);
  return { items: items.map((m) => toMediaDTO(m as MediaDoc)), total, pages: Math.ceil(total / 40) };
}

/** Marks every image of an article public/private. Called when visibility of the article changes. */
export async function syncMediaVisibility(articleId: string, makePublic: boolean) {
  const a = await Article.findById(articleId).select("featuredImage media").lean();
  if (!a) return;
  const ids = [...(a.media ?? []), ...(a.featuredImage ? [a.featuredImage] : [])];
  if (!ids.length) return;
  if (makePublic) {
    await MediaAsset.updateMany({ _id: { $in: ids } }, { $set: { visibility: "public", article: a._id } });
  } else {
    // Keep an image public if another visible article still uses it.
    for (const id of ids) {
      const other = await Article.exists({
        _id: { $ne: a._id },
        $or: [{ featuredImage: id }, { media: id }],
        $and: [{ $or: [{ status: "published" }, { status: "scheduled", scheduledAt: { $lte: new Date() } }] }],
        deletedAt: { $exists: false },
      });
      if (!other) await MediaAsset.updateOne({ _id: id }, { $set: { visibility: "private" } });
    }
  }
}

export { invalid };
