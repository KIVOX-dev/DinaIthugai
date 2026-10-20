import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const loc = { ta: { type: String, trim: true, maxlength: 200 }, en: { type: String, trim: true, maxlength: 200 } };

const categorySchema = new Schema(
  {
    slug: { type: String, required: true, lowercase: true, trim: true, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ },
    name: loc,
    description: { ta: { type: String, maxlength: 500 }, en: { type: String, maxlength: 500 } },
    parent: { type: Schema.Types.ObjectId, ref: "Category", default: null },
    order: { type: Number, default: 100 },
    showInNav: { type: Boolean, default: true },
    enabled: { type: Boolean, default: true },
    accent: { type: String, match: /^#[0-9a-fA-F]{6}$/ },
  },
  { timestamps: true },
);
categorySchema.index({ slug: 1 }, { unique: true });
categorySchema.index({ parent: 1, order: 1 });
export type CategoryDoc = InferSchemaType<typeof categorySchema> & { _id: mongoose.Types.ObjectId };
export const Category: Model<CategoryDoc> =
  (mongoose.models.Category as Model<CategoryDoc>) || mongoose.model<CategoryDoc>("Category", categorySchema);

const tagSchema = new Schema(
  {
    slug: { type: String, required: true, trim: true, lowercase: true },
    name: loc,
  },
  { timestamps: true },
);
tagSchema.index({ slug: 1 }, { unique: true });
export type TagDoc = InferSchemaType<typeof tagSchema> & { _id: mongoose.Types.ObjectId };
export const Tag: Model<TagDoc> = (mongoose.models.Tag as Model<TagDoc>) || mongoose.model<TagDoc>("Tag", tagSchema);
