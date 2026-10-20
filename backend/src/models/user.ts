import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { ROLES, PERMISSIONS } from "../shared/permissions";

export const ACCOUNT_STATUSES = ["active", "suspended", "disabled", "deletion_requested", "deleted"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

const addressSchema = new Schema(
  {
    line1: { type: String, trim: true, maxlength: 200, required: true },
    line2: { type: String, trim: true, maxlength: 200 },
    city: { type: String, trim: true, maxlength: 100, required: true },
    district: { type: String, trim: true, maxlength: 100 },
    state: { type: String, trim: true, maxlength: 100, required: true },
    postalCode: { type: String, trim: true, maxlength: 20, required: true },
    country: { type: String, trim: true, maxlength: 100, required: true },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, maxlength: 254 },
    normalizedEmail: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true }, // E.164
    gender: { type: String, enum: ["female", "male", "non_binary", "prefer_not_to_say"], default: "prefer_not_to_say" },
    address: { type: addressSchema, required: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: "contributor", index: true },
    permissions: { type: [{ type: String, enum: PERMISSIONS }], default: [] },
    accountStatus: { type: String, enum: ACCOUNT_STATUSES, default: "active", index: true },
    statusReason: { type: String, maxlength: 500 },
    emailVerifiedAt: { type: Date },
    lastLoginAt: { type: Date },
    failedLogins: { type: Number, default: 0 },
    lockedUntil: { type: Date },
    consentAt: { type: Date, required: true },
    consentVersion: { type: String, default: "2026-10" },
    notificationPrefs: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
    },
    preferredLanguage: { type: String, enum: ["ta", "en"], default: "ta" },
    bio: { type: String, maxlength: 600 },
    publicAuthor: { type: Boolean, default: false }, // staff profile page visible on /authors/*
    deletionRequestedAt: { type: Date },
    adminNotes: [
      {
        _id: false,
        by: { type: Schema.Types.ObjectId, ref: "User" },
        note: { type: String, maxlength: 2000 },
        at: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

userSchema.index({ normalizedEmail: 1 }, { unique: true });
userSchema.index({ createdAt: -1 });
userSchema.index({ name: "text", email: "text" });

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: mongoose.Types.ObjectId; createdAt: Date; updatedAt: Date };
export const User: Model<UserDoc> = (mongoose.models.User as Model<UserDoc>) || mongoose.model<UserDoc>("User", userSchema);

/** Sessions: opaque random token, only its SHA-256 is stored. */
const sessionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    ip: String,
    userAgent: { type: String, maxlength: 300 },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export type SessionDoc = InferSchemaType<typeof sessionSchema> & { _id: mongoose.Types.ObjectId };
export const Session: Model<SessionDoc> =
  (mongoose.models.Session as Model<SessionDoc>) || mongoose.model<SessionDoc>("Session", sessionSchema);

/** Single-use tokens for email verification and password reset. */
const authTokenSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["verify_email", "reset_password"], required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
authTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 });
export type AuthTokenDoc = InferSchemaType<typeof authTokenSchema> & { _id: mongoose.Types.ObjectId };
export const AuthToken: Model<AuthTokenDoc> =
  (mongoose.models.AuthToken as Model<AuthTokenDoc>) || mongoose.model<AuthTokenDoc>("AuthToken", authTokenSchema);
