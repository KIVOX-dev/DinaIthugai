import nodemailer from "nodemailer";
import { connectDB } from "../db";
import { env, isProd } from "../env";
import { AuditLog, EmailOutbox, Notification, RateLimit, User } from "../models";
import type { Localized } from "../shared/i18n";
import { ServiceError } from "./common";

/* ------------------------------ rate limiting ------------------------------ */

/** Fixed-window limiter stored in MongoDB so it holds across serverless instances. */
export async function rateLimit(key: string, limit: number, windowSec: number) {
  await connectDB();
  const now = Date.now();
  const bucket = Math.floor(now / (windowSec * 1000));
  const expiresAt = new Date((bucket + 1) * windowSec * 1000 + 60_000);
  const doc = await RateLimit.findOneAndUpdate(
    { key: `${key}:${bucket}` },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
    { upsert: true, returnDocument: "after" },
  ).lean();
  const count = doc?.count ?? 1;
  return { ok: count <= limit, remaining: Math.max(0, limit - count), retryAfter: Math.ceil(((bucket + 1) * windowSec * 1000 - now) / 1000) };
}

export async function enforceRateLimit(key: string, limit: number, windowSec: number) {
  const r = await rateLimit(key, limit, windowSec);
  if (!r.ok) throw new ServiceError("rate_limited", `Too many attempts. Try again in ${r.retryAfter} seconds.`);
}

/* --------------------------------- audit ---------------------------------- */

export async function audit(
  actor: { id: string; role: string } | null,
  action: string,
  target?: { type: string; id: string },
  meta?: Record<string, unknown>,
  ip?: string,
) {
  try {
    await connectDB();
    await AuditLog.create({ actor: actor?.id, actorRole: actor?.role, action, targetType: target?.type, targetId: target?.id, meta, ip });
  } catch (e) {
    console.error("[audit] failed to record", action, e);
  }
}

/* ---------------------------------- email --------------------------------- */

export function emailConfigured() {
  return Boolean(env().SMTP_HOST);
}

export async function sendEmail(to: string, subject: string, text: string, kind?: string) {
  await connectDB();
  const e = env();
  if (e.SMTP_HOST) {
    try {
      const transport = nodemailer.createTransport({
        host: e.SMTP_HOST,
        port: e.SMTP_PORT,
        secure: e.SMTP_PORT === 465,
        auth: e.SMTP_USER ? { user: e.SMTP_USER, pass: e.SMTP_PASSWORD } : undefined,
      });
      await transport.sendMail({ from: e.EMAIL_FROM, to, subject, text });
      return true;
    } catch (err) {
      console.error("[email] send failed", err);
      return false;
    }
  }
  if (!isProd()) {
    // Development transport: keep the message so verification/reset links can be followed (and tested).
    await EmailOutbox.create({ to, subject, text, kind, status: "logged" });
    console.info(`[email:dev] to=${to} subject="${subject}"\n${text}`);
    return true;
  }
  console.warn("[email] SMTP is not configured; message not delivered:", subject);
  return false;
}

/* ------------------------------- notifications ---------------------------- */

export type NotifyInput = {
  type: string;
  title: Localized;
  body?: Localized;
  link?: string;
  dedupeKey?: string;
  /** Account-critical messages bypass the in-app preference. */
  critical?: boolean;
  email?: boolean;
};

export async function notify(userId: string, n: NotifyInput) {
  try {
    await connectDB();
    const user = await User.findById(userId).select("email notificationPrefs preferredLanguage").lean();
    if (!user) return;
    if (user.notificationPrefs?.inApp !== false || n.critical) {
      try {
        await Notification.create({ user: userId, type: n.type, title: n.title, body: n.body, link: n.link, dedupeKey: n.dedupeKey && `${n.dedupeKey}:${userId}` });
      } catch (err) {
        if ((err as { code?: number }).code !== 11000) throw err; // duplicate = already notified (idempotent retry)
        return;
      }
    }
    if ((n.email ?? true) && (user.notificationPrefs?.email !== false || n.critical) && emailConfigured()) {
      const lang = user.preferredLanguage ?? "ta";
      const title = n.title[lang] ?? n.title.en ?? n.title.ta ?? n.type;
      const body = n.body?.[lang] ?? n.body?.en ?? n.body?.ta ?? "";
      const link = n.link ? `${env().APP_URL}${n.link}` : "";
      void sendEmail(user.email, title, `${body}\n\n${link}`.trim(), n.type);
    }
  } catch (e) {
    console.error("[notify] failed", e);
  }
}
