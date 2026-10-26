import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const variantSchema = new Schema(
  { name: String, key: String, width: Number, height: Number, size: Number, mime: String },
  { _id: false },
);

const mediaSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    key: { type: String, required: true, unique: true }, // object key of the primary (re-encoded) image
    storage: { type: String, enum: ["b2", "local"], required: true },
    mime: { type: String, required: true },
    size: { type: Number, required: true },
    width: Number,
    height: Number,
    originalName: { type: String, maxlength: 200 },
    sha256: String,
    variants: [variantSchema],
    caption: { ta: { type: String, maxlength: 500 }, en: { type: String, maxlength: 500 } },
    alt: { ta: { type: String, maxlength: 300 }, en: { type: String, maxlength: 300 } },
    credit: { type: String, maxlength: 200 },
    origin: { type: String, enum: ["dinamalar"], index: true }, // set on images imported from a partner; these are purged after IMPORTED_MEDIA_DAYS
    // Public delivery is only allowed once an article using it is publicly visible.
    visibility: { type: String, enum: ["private", "public"], default: "private", index: true },
    article: { type: Schema.Types.ObjectId, ref: "Article", index: true }, // set when attached
    deletedAt: Date,
  },
  { timestamps: true },
);
mediaSchema.index({ createdAt: -1 });
mediaSchema.index({ article: 1, visibility: 1 });
export type MediaDoc = InferSchemaType<typeof mediaSchema> & { _id: mongoose.Types.ObjectId; createdAt: Date };
export const MediaAsset: Model<MediaDoc> =
  (mongoose.models.MediaAsset as Model<MediaDoc>) || mongoose.model<MediaDoc>("MediaAsset", mediaSchema);
