import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { STATUSES } from "../shared/article-states";

const L = (max: number) => ({ ta: { type: String, trim: true, maxlength: max }, en: { type: String, trim: true, maxlength: max } });
const LBody = { ta: { type: String, maxlength: 200_000 }, en: { type: String, maxlength: 200_000 } };

const articleSchema = new Schema(
  {
    title: L(300),
    subtitle: L(400),
    slug: L(300),
    excerpt: L(600),
    body: LBody, // sanitized HTML
    seoTitle: L(120),
    seoDescription: L(300),
    searchText: LBody, // plain text derived from title/excerpt/body for indexing & highlighting
    languageAvailability: { ta: { type: Boolean, default: false }, en: { type: Boolean, default: false } },
    preferredLanguage: { type: String, enum: ["ta", "en"], default: "ta" },

    category: { type: Schema.Types.ObjectId, ref: "Category", index: true },
    tags: [{ type: Schema.Types.ObjectId, ref: "Tag" }],
    location: { type: String, maxlength: 200 },
    edition: { type: String, maxlength: 80 },

    source: { type: String, enum: ["staff", "community"], default: "staff", index: true },
    author: { type: Schema.Types.ObjectId, ref: "User", index: true }, // byline (staff profile)
    authorName: { type: String, maxlength: 150 }, // free-text byline override
    submitter: { type: Schema.Types.ObjectId, ref: "User", index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    assignedEditor: { type: Schema.Types.ObjectId, ref: "User", index: true },

    featuredImage: { type: Schema.Types.ObjectId, ref: "MediaAsset" },
    featuredCaption: L(500),
    featuredCredit: { type: String, maxlength: 200 },
    media: [{ type: Schema.Types.ObjectId, ref: "MediaAsset" }], // every image referenced by the body

    importedFrom: { url: { type: String, maxlength: 500 } }, // internal only (dedupe of partner imports); never exposed publicly
    sources: [{ _id: false, label: { type: String, maxlength: 200 }, url: { type: String, maxlength: 500 } }],
    credits: { type: String, maxlength: 400 },
    canonicalUrl: { type: String, maxlength: 500 },

    status: { type: String, enum: STATUSES, default: "draft" },
    visibility: { type: String, enum: ["public", "private"], default: "public" },
    revision: { type: Number, default: 1 },
    lockedRevision: Number, // revision snapshot that was submitted for review

    submission: {
      submittedAt: Date,
      declaration: { type: Boolean, default: false },
      authorNotes: { type: String, maxlength: 2000 },
      reviewNote: { type: String, maxlength: 2000 }, // latest reason shown to the author
      internalNotes: [
        { _id: false, by: { type: Schema.Types.ObjectId, ref: "User" }, note: { type: String, maxlength: 2000 }, at: { type: Date, default: Date.now } },
      ],
    },

    headline: { ta: { type: String, maxlength: 300 } }, // AI-refreshed homepage headline (the real title is untouched)
    headlineAt: Date,
    featured: { type: Boolean, default: false },
    trending: { type: Boolean, default: false },
    breaking: { type: Boolean, default: false },
    priority: { type: Number, default: 0, min: 0, max: 100 }, // homepage priority, higher first
    views: { type: Number, default: 0 },

    scheduledAt: Date,
    publishedAt: Date,
    publishedBy: { type: Schema.Types.ObjectId, ref: "User" },
    unpublishedAt: Date,
    archivedAt: Date,
    deletedAt: Date,
  },
  { timestamps: true },
);

// Unique slugs per language route scope. Partial so articles without that language don't collide on null.
articleSchema.index({ "slug.ta": 1 }, { unique: true, partialFilterExpression: { "slug.ta": { $type: "string" } } });
articleSchema.index({ "slug.en": 1 }, { unique: true, partialFilterExpression: { "slug.en": { $type: "string" } } });
// A partner story can be imported only once, even if two import runs overlap.
articleSchema.index({ "importedFrom.url": 1 }, { unique: true, partialFilterExpression: { "importedFrom.url": { $type: "string" } } });
articleSchema.index({ status: 1, publishedAt: -1 }); // public latest feed
articleSchema.index({ status: 1, scheduledAt: 1 }); // scheduler
articleSchema.index({ category: 1, status: 1, publishedAt: -1 });
articleSchema.index({ status: 1, source: 1, createdAt: 1 }); // review queue
articleSchema.index({ submitter: 1, createdAt: -1 }); // user submission history
articleSchema.index({ tags: 1, status: 1, publishedAt: -1 });
articleSchema.index({ breaking: 1, status: 1, publishedAt: -1 });
articleSchema.index({ featured: 1, priority: -1, publishedAt: -1 });
articleSchema.index({ views: -1, publishedAt: -1 });
articleSchema.index(
  { "title.ta": "text", "title.en": "text", "excerpt.ta": "text", "excerpt.en": "text", "searchText.ta": "text", "searchText.en": "text" },
  {
    name: "article_text",
    default_language: "none", // whitespace tokenisation: works for Tamil, no stemming claimed
    weights: { "title.ta": 10, "title.en": 10, "excerpt.ta": 4, "excerpt.en": 4, "searchText.ta": 1, "searchText.en": 1 },
  },
);

export type ArticleDoc = InferSchemaType<typeof articleSchema> & { _id: mongoose.Types.ObjectId; createdAt: Date; updatedAt: Date };
export const Article: Model<ArticleDoc> =
  (mongoose.models.Article as Model<ArticleDoc>) || mongoose.model<ArticleDoc>("Article", articleSchema);

const revisionSchema = new Schema(
  {
    article: { type: Schema.Types.ObjectId, ref: "Article", required: true },
    revision: { type: Number, required: true },
    kind: { type: String, enum: ["edit", "submit", "approve", "publish", "ai_accept", "restore"], default: "edit" },
    snapshot: {
      title: L(300),
      subtitle: L(400),
      excerpt: L(600),
      body: LBody,
      seoTitle: L(120),
      seoDescription: L(300),
    },
    featuredImage: { type: Schema.Types.ObjectId, ref: "MediaAsset" },
    status: String,
    by: { type: Schema.Types.ObjectId, ref: "User" },
    note: { type: String, maxlength: 500 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
revisionSchema.index({ article: 1, revision: -1 });
export type RevisionDoc = InferSchemaType<typeof revisionSchema> & { _id: mongoose.Types.ObjectId; createdAt: Date };
export const ArticleRevision: Model<RevisionDoc> =
  (mongoose.models.ArticleRevision as Model<RevisionDoc>) || mongoose.model<RevisionDoc>("ArticleRevision", revisionSchema);

const reviewSchema = new Schema(
  {
    article: { type: Schema.Types.ObjectId, ref: "Article", required: true },
    reviewer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    action: {
      type: String,
      enum: ["assigned", "start_review", "approved", "rejected", "changes_requested", "reopened", "resubmitted", "published", "scheduled", "unpublished", "archived", "restored"],
      required: true,
    },
    fromStatus: String,
    toStatus: String,
    reason: { type: String, maxlength: 2000 },
    revision: Number,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
reviewSchema.index({ article: 1, createdAt: 1 });
export type ReviewDoc = InferSchemaType<typeof reviewSchema> & { _id: mongoose.Types.ObjectId; createdAt: Date };
export const EditorialReview: Model<ReviewDoc> =
  (mongoose.models.EditorialReview as Model<ReviewDoc>) || mongoose.model<ReviewDoc>("EditorialReview", reviewSchema);
