/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type LooseDoc = { _id: mongoose.Types.ObjectId; createdAt: Date; [k: string]: any };

function model<T>(name: string, schema: Schema<any>): Model<T> {
  return (mongoose.models[name] as unknown as Model<T>) || (mongoose.model(name, schema) as unknown as Model<T>);
}

/* ---------- notifications ---------- */
const notificationSchema = new Schema<any>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, required: true, maxlength: 60 },
    title: { ta: String, en: String },
    body: { ta: String, en: String },
    link: { type: String, maxlength: 300 },
    readAt: Date,
    dedupeKey: { type: String, maxlength: 200 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, readAt: 1 });
// Idempotency: retrying a publish must not create duplicate notifications.
notificationSchema.index({ dedupeKey: 1 }, { unique: true, partialFilterExpression: { dedupeKey: { $type: "string" } } });
export type NotificationDoc = LooseDoc;
export const Notification = model<NotificationDoc>("Notification", notificationSchema);

/* ---------- site settings (singleton document) ---------- */
const settingsSchema = new Schema<any>(
  {
    key: { type: String, default: "site", unique: true },
    siteName: { ta: { type: String, default: "தின இதிகை" }, en: { type: String, default: "Dina Idhigai" } },
    tagline: { ta: { type: String, default: "NOTHING MORE THAN NEWS" }, en: { type: String, default: "NOTHING MORE THAN NEWS" } },
    logoMediaId: { type: Schema.Types.ObjectId, ref: "MediaAsset" },
    defaultLocale: { type: String, enum: ["ta", "en"], default: "ta" },
    enabledLocales: { type: [String], default: ["ta", "en"] },
    edition: { ta: { type: String, default: "கோவை" }, en: { type: String, default: "Coimbatore" } },
    homepageSections: {
      type: [
        {
          _id: false,
          key: String, // category slug or one of: latest, trending, opinion, gallery
          enabled: { type: Boolean, default: true },
          order: { type: Number, default: 100 },
          limit: { type: Number, default: 5 },
        },
      ],
      default: [],
    },
    // Categories (slugs) whose stories get priority in the homepage headlines.
    priorityRegions: { type: [String], default: ["coimbatore", "nilgiris", "tiruppur", "erode", "chennai"] },
    // Headlines typed in by an admin: shown at the top of the Headlines section.
    customHeadlines: {
      type: [{ _id: false, text: { type: String, maxlength: 300 }, href: { type: String, maxlength: 500 }, enabled: { type: Boolean, default: true }, order: { type: Number, default: 100 } }],
      default: [],
    },
    seo: {
      title: { ta: String, en: String },
      description: { ta: String, en: String },
      ogImage: String,
    },
    social: { facebook: String, x: String, instagram: String, youtube: String, whatsapp: String },
    contact: { email: String, phone: String, address: { ta: String, en: String } },
    footerLinks: [{ _id: false, label: { ta: String, en: String }, href: String }],
    staticPages: { type: Schema.Types.Mixed, default: {} }, // { [slug]: { ta?: html, en?: html } }
    submissions: {
      enabled: { type: Boolean, default: true },
      requireVerifiedEmail: { type: Boolean, default: true },
      maxImagesPerArticle: { type: Number, default: 8 },
      minWords: { type: Number, default: 80 },
      rules: { ta: String, en: String },
    },
    uploads: { maxMb: { type: Number, default: 8 }, allowedTypes: { type: [String], default: ["image/jpeg", "image/png", "image/webp"] } },
    ai: { enabled: { type: Boolean, default: true }, hourlyLimitPerUser: { type: Number, default: 30 } },
    registrationOpen: { type: Boolean, default: true },
    maintenanceMode: { type: Boolean, default: false },
    maintenanceMessage: { ta: String, en: String },
    breakingBanner: { enabled: { type: Boolean, default: true }, label: { ta: { type: String, default: "முக்கிய செய்தி" }, en: { type: String, default: "Breaking" } } },
  },
  { timestamps: true },
);
type L = { ta?: string | null; en?: string | null };
export interface SettingsDoc {
  _id: mongoose.Types.ObjectId;
  key: string;
  siteName: L;
  tagline: L;
  logoMediaId?: mongoose.Types.ObjectId | null;
  defaultLocale: "ta" | "en";
  enabledLocales: string[];
  edition: L;
  priorityRegions: string[];
  customHeadlines: { text?: string | null; href?: string | null; enabled?: boolean; order?: number }[];
  homepageSections: { key?: string | null; enabled?: boolean; order?: number; limit?: number }[];
  seo: { title?: L; description?: L; ogImage?: string | null };
  social: { facebook?: string | null; x?: string | null; instagram?: string | null; youtube?: string | null; whatsapp?: string | null };
  contact: { email?: string | null; phone?: string | null; address?: L };
  footerLinks: { label?: L; href?: string | null }[];
  staticPages: Record<string, L>;
  submissions: { enabled: boolean; requireVerifiedEmail: boolean; maxImagesPerArticle: number; minWords: number; rules?: L };
  uploads: { maxMb: number; allowedTypes: string[] };
  ai: { enabled: boolean; hourlyLimitPerUser: number };
  registrationOpen: boolean;
  maintenanceMode: boolean;
  maintenanceMessage?: L;
  breakingBanner: { enabled: boolean; label: L };
}
export const SiteSettings = model<SettingsDoc>("SiteSettings", settingsSchema);

/* ---------- advertisements ---------- */
export const AD_SLOTS = ["header_leaderboard", "home_sidebar", "home_inline", "article_inline", "article_sidebar", "footer_banner"] as const;
const adSchema = new Schema<any>(
  {
    slot: { type: String, enum: AD_SLOTS, required: true },
    name: { type: String, required: true, maxlength: 120 },
    imageMedia: { type: Schema.Types.ObjectId, ref: "MediaAsset", required: true }, // image ads only: no raw HTML
    href: { type: String, required: true, maxlength: 500 },
    alt: { type: String, maxlength: 200 },
    enabled: { type: Boolean, default: true },
    startsAt: Date,
    endsAt: Date,
    locales: { type: [String], default: ["ta", "en"] },
  },
  { timestamps: true },
);
adSchema.index({ slot: 1, enabled: 1 });
export type AdDoc = LooseDoc;
export const Advertisement = model<AdDoc>("Advertisement", adSchema);

/* ---------- audit log ---------- */
const auditSchema = new Schema<any>(
  {
    actor: { type: Schema.Types.ObjectId, ref: "User" },
    actorRole: String,
    action: { type: String, required: true, maxlength: 80 },
    targetType: { type: String, maxlength: 40 },
    targetId: { type: String, maxlength: 60 },
    meta: { type: Schema.Types.Mixed },
    ip: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
auditSchema.index({ createdAt: -1 });
auditSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
auditSchema.index({ actor: 1, createdAt: -1 });
export type AuditDoc = LooseDoc;
export const AuditLog = model<AuditDoc>("AuditLog", auditSchema);

/* ---------- AI usage (metadata only, no article text) ---------- */
const aiUsageSchema = new Schema<any>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    article: { type: Schema.Types.ObjectId, ref: "Article" },
    operation: { type: String, required: true },
    provider: String,
    model: String,
    inputChars: Number,
    outputChars: Number,
    ok: Boolean,
    error: { type: String, maxlength: 200 },
    ms: Number,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
aiUsageSchema.index({ user: 1, createdAt: -1 });
export type AiUsageDoc = LooseDoc;
export const AiUsage = model<AiUsageDoc>("AiUsage", aiUsageSchema);

/* ---------- rate limiting (fixed window, shared across instances) ---------- */
const rateSchema = new Schema<any>({
  key: { type: String, required: true, unique: true },
  count: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
});
rateSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const RateLimit = model<{ key: string; count: number; expiresAt: Date }>("RateLimit", rateSchema);

/* ---------- email outbox (dev/log transport + delivery record) ---------- */
const emailSchema = new Schema<any>(
  {
    to: { type: String, required: true },
    subject: String,
    text: String,
    html: String,
    status: { type: String, enum: ["sent", "logged", "failed"], default: "logged" },
    error: String,
    kind: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
emailSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 14 });
emailSchema.index({ to: 1, createdAt: -1 });
export const EmailOutbox = model<{ to: string; subject: string; text: string; html: string; status: string; kind?: string; createdAt: Date }>(
  "EmailOutbox",
  emailSchema,
);
