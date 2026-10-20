import { connectDB } from "../db";
import { env } from "../env";
import { AuthToken, Session, User, type UserDoc } from "../models";
import { DUMMY_HASH, hashPassword, newToken, sha256, verifyPassword } from "../auth/crypto";
import { loginSchema, profileSchema, registerSchema, resetPasswordSchema, flattenIssues, emailSchema, passwordSchema } from "../validation/schemas";
import { plain } from "../text";
import { ServiceError, invalid, type Principal } from "./common";
import { audit, enforceRateLimit, sendEmail } from "./platform";
import { getSettings } from "./settings";

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
const VERIFY_HOURS = 48;
const RESET_MINUTES = 60;

export type RequestCtx = { ip?: string; userAgent?: string };

export function toPrincipal(u: Pick<UserDoc, "name" | "email" | "role" | "permissions" | "accountStatus" | "emailVerifiedAt" | "preferredLanguage"> & { _id: unknown }): Principal {
  return {
    id: String(u._id),
    name: u.name,
    email: u.email,
    role: u.role,
    permissions: [...(u.permissions ?? [])],
    status: u.accountStatus,
    emailVerified: !!u.emailVerifiedAt,
    preferredLanguage: (u.preferredLanguage as "ta" | "en") ?? "ta",
  };
}

async function issueToken(userId: string, type: "verify_email" | "reset_password") {
  const token = newToken();
  const ttl = type === "verify_email" ? VERIFY_HOURS * 3600_000 : RESET_MINUTES * 60_000;
  // Only the newest token of a type is valid.
  await AuthToken.deleteMany({ user: userId, type, usedAt: { $exists: false } });
  await AuthToken.create({ user: userId, type, tokenHash: sha256(token), expiresAt: new Date(Date.now() + ttl) });
  return token;
}

const linkFor = (path: string) => `${env().APP_URL}${path}`;

async function sendVerification(user: { _id: unknown; email: string; name: string; preferredLanguage?: string }) {
  const token = await issueToken(String(user._id), "verify_email");
  const lang = user.preferredLanguage === "en" ? "en" : "ta";
  const url = linkFor(`/${lang}/verify-email?token=${token}`);
  await sendEmail(
    user.email,
    lang === "ta" ? "தின இதிகை - மின்னஞ்சலை உறுதிப்படுத்தவும்" : "Dina Idhigai - verify your email",
    lang === "ta" ? `வணக்கம் ${user.name},\n\nஉங்கள் மின்னஞ்சலை உறுதிப்படுத்த இந்த இணைப்பைத் திறக்கவும் (48 மணி நேரம் செல்லுபடியாகும்):\n${url}` : `Hello ${user.name},\n\nConfirm your email address using this link (valid for 48 hours):\n${url}`,
    "verify_email",
  );
}

export async function registerUser(raw: unknown, ctx: RequestCtx = {}) {
  await connectDB();
  const settings = await getSettings();
  if (!settings.registrationOpen) throw new ServiceError("unavailable", "Registration is currently closed.");
  if (ctx.ip) await enforceRateLimit(`register:${ctx.ip}`, 10, 3600);
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) throw invalid("Please correct the highlighted fields.", flattenIssues(parsed.error));
  const v = parsed.data;
  const normalizedEmail = v.email.toLowerCase();
  if (await User.exists({ normalizedEmail })) throw invalid("An account with this email already exists.", { email: "v.email_taken" });
  const user = await User.create({
    name: plain(v.name),
    email: v.email,
    normalizedEmail,
    phone: v.phone,
    gender: v.gender,
    address: Object.fromEntries(Object.entries(v.address).map(([k, x]) => [k, typeof x === "string" ? plain(x) : x])),
    passwordHash: await hashPassword(v.password),
    role: "contributor",
    consentAt: new Date(),
    preferredLanguage: v.language,
  }).catch((e) => {
    if ((e as { code?: number }).code === 11000) throw invalid("An account with this email already exists.", { email: "v.email_taken" });
    throw e;
  });
  await sendVerification(user);
  await audit({ id: String(user._id), role: user.role }, "user.register", { type: "user", id: String(user._id) }, undefined, ctx.ip);
  return { id: String(user._id) };
}

export async function verifyEmail(token: string) {
  await connectDB();
  if (!token || token.length > 100) throw invalid("This link is invalid or has expired.");
  const rec = await AuthToken.findOneAndUpdate(
    { tokenHash: sha256(token), type: "verify_email", usedAt: { $exists: false }, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } },
  );
  if (!rec) throw invalid("This link is invalid or has expired.");
  await User.updateOne({ _id: rec.user }, { $set: { emailVerifiedAt: new Date() } });
  await audit({ id: String(rec.user), role: "contributor" }, "user.verify_email", { type: "user", id: String(rec.user) });
  return { userId: String(rec.user) };
}

export async function resendVerification(email: string, ctx: RequestCtx = {}) {
  await connectDB();
  const e = emailSchema.safeParse(email);
  if (!e.success) return;
  await enforceRateLimit(`resend:${e.data}`, 3, 3600);
  const user = await User.findOne({ normalizedEmail: e.data });
  if (user && !user.emailVerifiedAt && user.accountStatus === "active") await sendVerification(user);
  void ctx;
}

export async function login(raw: unknown, ctx: RequestCtx = {}) {
  await connectDB();
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) throw invalid("Enter a valid email and password.", flattenIssues(parsed.error));
  const { email, password } = parsed.data;
  await enforceRateLimit(`login:ip:${ctx.ip ?? "unknown"}`, 30, 600);
  await enforceRateLimit(`login:email:${email}`, 10, 600);

  const user = await User.findOne({ normalizedEmail: email }).select("+passwordHash");
  // Always run a hash comparison so response time doesn't reveal whether the account exists.
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user) throw new ServiceError("unauthorized", "Incorrect email or password.");
  if (user.lockedUntil && user.lockedUntil > new Date()) throw new ServiceError("locked", "Too many failed attempts. Try again later.");
  if (!ok) {
    const failed = (user.failedLogins ?? 0) + 1;
    await User.updateOne(
      { _id: user._id },
      failed >= MAX_FAILED ? { $set: { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) } } : { $set: { failedLogins: failed } },
    );
    await audit({ id: String(user._id), role: user.role }, "auth.login_failed", { type: "user", id: String(user._id) }, { failed }, ctx.ip);
    throw new ServiceError("unauthorized", "Incorrect email or password.");
  }
  if (user.accountStatus !== "active" && user.accountStatus !== "deletion_requested") {
    throw new ServiceError("forbidden", user.accountStatus === "suspended" ? "This account is suspended. Contact the editorial office." : "This account is not available.");
  }
  const token = newToken();
  await Session.create({
    user: user._id,
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + env().SESSION_TTL_DAYS * 86400_000),
    ip: ctx.ip,
    userAgent: ctx.userAgent?.slice(0, 300),
  });
  await User.updateOne({ _id: user._id }, { $set: { failedLogins: 0, lastLoginAt: new Date() }, $unset: { lockedUntil: 1 } });
  await audit({ id: String(user._id), role: user.role }, "auth.login", { type: "user", id: String(user._id) }, undefined, ctx.ip);
  return { token, principal: toPrincipal(user), expiresAt: new Date(Date.now() + env().SESSION_TTL_DAYS * 86400_000) };
}

/** Resolve a session cookie value to a principal; returns null for unknown/expired/disabled. */
export async function principalFromToken(token: string | undefined | null): Promise<Principal | null> {
  if (!token || token.length > 100) return null;
  await connectDB();
  const s = await Session.findOne({ tokenHash: sha256(token), expiresAt: { $gt: new Date() } }).lean();
  if (!s) return null;
  const user = await User.findById(s.user).lean();
  if (!user || (user.accountStatus !== "active" && user.accountStatus !== "deletion_requested")) return null;
  if (Date.now() - new Date(s.lastSeenAt ?? 0).getTime() > 10 * 60_000) {
    void Session.updateOne({ _id: s._id }, { $set: { lastSeenAt: new Date() } }).catch(() => {});
  }
  return toPrincipal(user);
}

export async function logout(token: string | undefined | null) {
  if (!token) return;
  await connectDB();
  await Session.deleteOne({ tokenHash: sha256(token) });
}

export async function revokeAllSessions(userId: string) {
  await connectDB();
  await Session.deleteMany({ user: userId });
}

export async function requestPasswordReset(email: string, ctx: RequestCtx = {}) {
  await connectDB();
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return; // do not reveal anything
  await enforceRateLimit(`reset:ip:${ctx.ip ?? "unknown"}`, 10, 3600);
  await enforceRateLimit(`reset:email:${parsed.data}`, 3, 3600);
  const user = await User.findOne({ normalizedEmail: parsed.data });
  if (!user || (user.accountStatus !== "active" && user.accountStatus !== "deletion_requested")) return;
  await sendResetEmail(user);
  await audit({ id: String(user._id), role: user.role }, "auth.reset_requested", { type: "user", id: String(user._id) }, undefined, ctx.ip);
}

/** Used by the self-service flow and by admins triggering a reset on a user's behalf. */
export async function sendResetEmail(user: { _id: unknown; email: string; preferredLanguage?: string }) {
  const token = await issueToken(String(user._id), "reset_password");
  const lang = user.preferredLanguage === "en" ? "en" : "ta";
  const url = linkFor(`/${lang}/reset-password?token=${token}`);
  await sendEmail(
    user.email,
    lang === "ta" ? "தின இதிகை - கடவுச்சொல் மீட்டமைப்பு" : "Dina Idhigai - reset your password",
    lang === "ta" ? `கடவுச்சொல்லை மீட்டமைக்க (60 நிமிடம் செல்லுபடியாகும்):\n${url}\n\nநீங்கள் கோரவில்லை எனில் இதை புறக்கணிக்கவும்.` : `Reset your password (valid for 60 minutes):\n${url}\n\nIgnore this email if you did not request it.`,
    "reset_password",
  );
}

export async function resetPassword(raw: unknown) {
  await connectDB();
  const parsed = resetPasswordSchema.safeParse(raw);
  if (!parsed.success) throw invalid("Please correct the highlighted fields.", flattenIssues(parsed.error));
  const rec = await AuthToken.findOneAndUpdate(
    { tokenHash: sha256(parsed.data.token), type: "reset_password", usedAt: { $exists: false }, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } },
  ); // atomic: a token can be consumed exactly once
  if (!rec) throw invalid("This link is invalid or has expired.");
  await User.updateOne(
    { _id: rec.user },
    { $set: { passwordHash: await hashPassword(parsed.data.password), failedLogins: 0 }, $unset: { lockedUntil: 1 } },
  );
  await revokeAllSessions(String(rec.user));
  await audit({ id: String(rec.user), role: "user" }, "auth.password_reset", { type: "user", id: String(rec.user) });
}

export async function changePassword(actor: Principal, current: string, next: string) {
  await connectDB();
  const pw = passwordSchema.safeParse(next);
  if (!pw.success) throw invalid("Password is too weak.", { password: "v.password_weak" });
  const user = await User.findById(actor.id).select("+passwordHash");
  if (!user || !(await verifyPassword(current, user.passwordHash))) throw invalid("Current password is incorrect.", { current: "v.password_wrong" });
  user.passwordHash = await hashPassword(pw.data);
  await user.save();
  await revokeAllSessions(actor.id);
  await audit(actor, "auth.password_changed", { type: "user", id: actor.id });
}

export async function updateProfile(actor: Principal, raw: unknown) {
  await connectDB();
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) throw invalid("Please correct the highlighted fields.", flattenIssues(parsed.error));
  const v = parsed.data;
  // NOTE: role / permissions / status are deliberately not part of this schema (no self-escalation path).
  await User.updateOne(
    { _id: actor.id },
    {
      $set: {
        name: plain(v.name),
        phone: v.phone,
        gender: v.gender,
        address: v.address,
        bio: v.bio ? plain(v.bio) : undefined,
        preferredLanguage: v.preferredLanguage,
        "notificationPrefs.inApp": v.notifyInApp,
        "notificationPrefs.email": v.notifyEmail,
      },
    },
  );
  await audit(actor, "user.profile_updated", { type: "user", id: actor.id });
}

export async function requestAccountDeletion(actor: Principal) {
  await connectDB();
  await User.updateOne({ _id: actor.id }, { $set: { accountStatus: "deletion_requested", deletionRequestedAt: new Date() } });
  await audit(actor, "user.deletion_requested", { type: "user", id: actor.id });
}

export async function cancelAccountDeletion(actor: Principal) {
  await connectDB();
  await User.updateOne({ _id: actor.id, accountStatus: "deletion_requested" }, { $set: { accountStatus: "active" }, $unset: { deletionRequestedAt: 1 } });
}
