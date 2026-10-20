import { connectDB, oid } from "../db";
import { Article, AuditLog, Session, User, type UserDoc } from "../models";
import { PERMISSIONS, ROLES, ROLE_RANK, can, effectivePermissions, type Permission, type Role } from "../shared/permissions";
import { verifyPassword } from "../auth/crypto";
import { escapeRegex, plain } from "../text";
import { ServiceError, forbidden, invalid, notFound, type Principal } from "./common";
import { audit, notify } from "./platform";
import { revokeAllSessions, sendResetEmail } from "./auth";
import { profileSchema, flattenIssues } from "../validation/schemas";

const PAGE = 25;

export type UserRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  status: string;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt?: string;
};

const row = (u: UserDoc): UserRow => ({
  id: String(u._id),
  name: u.name,
  email: u.email,
  phone: u.phone,
  role: u.role as Role,
  status: u.accountStatus,
  emailVerified: !!u.emailVerifiedAt,
  createdAt: u.createdAt.toISOString(),
  lastLoginAt: u.lastLoginAt?.toISOString(),
});

export async function listUsers(actor: Principal, f: { q?: string; role?: string; status?: string; from?: string; to?: string; page?: number }) {
  await connectDB();
  if (!can(actor, "users.view")) throw forbidden();
  const filter: Record<string, unknown> = {};
  if (f.q) {
    const rx = new RegExp(escapeRegex(f.q.slice(0, 80)), "i");
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
  }
  if (f.role && (ROLES as readonly string[]).includes(f.role)) filter.role = f.role;
  if (f.status) filter.accountStatus = String(f.status);
  const range: Record<string, Date> = {};
  if (f.from && !isNaN(+new Date(f.from))) range.$gte = new Date(f.from);
  if (f.to && !isNaN(+new Date(f.to))) range.$lte = new Date(new Date(f.to).getTime() + 86400_000 - 1);
  if (Object.keys(range).length) filter.createdAt = range;
  const page = Math.max(1, f.page ?? 1);
  const [users, total] = await Promise.all([User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * PAGE).limit(PAGE).lean(), User.countDocuments(filter)]);
  return { items: users.map((u) => row(u as UserDoc)), total, pages: Math.max(1, Math.ceil(total / PAGE)), page };
}

export async function getUserDetail(actor: Principal, id: string) {
  await connectDB();
  if (!can(actor, "users.view")) throw forbidden();
  const _id = oid(id);
  const u = _id && (await User.findById(_id).lean()); // passwordHash is select:false and never returned
  if (!u) throw notFound();
  const [submissions, sessions, recent] = await Promise.all([
    Article.find({ submitter: u._id, deletedAt: { $exists: false } }).select("title status createdAt updatedAt").sort({ createdAt: -1 }).limit(50).lean(),
    Session.find({ user: u._id, expiresAt: { $gt: new Date() } }).select("createdAt lastSeenAt ip userAgent").sort({ createdAt: -1 }).limit(10).lean(),
    AuditLog.find({ $or: [{ actor: u._id }, { targetType: "user", targetId: String(u._id) }] }).sort({ createdAt: -1 }).limit(20).lean(),
  ]);
  return {
    user: {
      ...row(u as UserDoc),
      gender: u.gender,
      address: u.address,
      permissions: u.permissions ?? [],
      effectivePermissions: [...effectivePermissions({ role: u.role as Role, permissions: u.permissions })],
      statusReason: u.statusReason,
      bio: u.bio,
      publicAuthor: !!u.publicAuthor,
      deletionRequestedAt: u.deletionRequestedAt?.toISOString(),
      consentAt: u.consentAt?.toISOString(),
      notes: (u.adminNotes ?? []).map((n) => ({ by: String(n.by), note: n.note ?? "", at: (n.at ?? new Date()).toISOString() })),
    },
    submissions: submissions.map((s) => ({ id: String(s._id), title: s.title?.ta || s.title?.en || "(untitled)", status: s.status, createdAt: s.createdAt.toISOString() })),
    sessions: sessions.map((s) => ({ id: String(s._id), createdAt: (s as unknown as { createdAt: Date }).createdAt.toISOString(), ip: s.ip ?? undefined, userAgent: s.userAgent ?? undefined })),
    activity: recent.map((r) => ({ action: r.action, at: r.createdAt.toISOString() })),
  };
}

/** Actors may only manage users strictly below their own rank (super admins may manage anyone). */
function assertCanManage(actor: Principal, target: UserDoc, opts: { allowSelf?: boolean } = {}) {
  const self = String(target._id) === actor.id;
  if (self && !opts.allowSelf) throw forbidden("You cannot perform this action on your own account.");
  if (actor.role !== "super_admin" && !self && ROLE_RANK[target.role as Role] >= ROLE_RANK[actor.role]) {
    throw forbidden("You cannot manage an account with an equal or higher role.");
  }
}

async function loadTarget(id: string) {
  const _id = oid(id);
  const u = _id && (await User.findById(_id));
  if (!u) throw notFound();
  return u;
}

export async function adminUpdateUser(actor: Principal, id: string, raw: unknown) {
  await connectDB();
  if (!can(actor, "users.edit")) throw forbidden();
  const target = await loadTarget(id);
  assertCanManage(actor, target, { allowSelf: true });
  const parsed = profileSchema.omit({ preferredLanguage: true, notifyEmail: true, notifyInApp: true }).safeParse(raw);
  if (!parsed.success) throw invalid("Please correct the highlighted fields.", flattenIssues(parsed.error));
  const v = parsed.data;
  // role, permissions and accountStatus are NOT editable here.
  target.name = plain(v.name);
  target.phone = v.phone;
  target.gender = v.gender;
  target.set("address", v.address);
  target.bio = v.bio ? plain(v.bio) : undefined;
  await target.save();
  await audit(actor, "user.admin_update", { type: "user", id });
}

export async function setPublicAuthor(actor: Principal, id: string, on: boolean) {
  await connectDB();
  if (!can(actor, "users.edit")) throw forbidden();
  const target = await loadTarget(id);
  assertCanManage(actor, target, { allowSelf: true });
  target.publicAuthor = on;
  await target.save();
  await audit(actor, "user.public_author", { type: "user", id }, { on });
}

export async function setRoleAndPermissions(
  actor: Principal,
  id: string,
  change: { role: string; permissions?: string[]; confirm?: boolean; reauthPassword?: string },
) {
  await connectDB();
  if (!can(actor, "users.manage_roles")) throw forbidden();
  if (!change.confirm) throw invalid("Please confirm this change.");
  if (!(ROLES as readonly string[]).includes(change.role)) throw invalid("Unknown role.");
  const target = await loadTarget(id);
  // No self-service escalation (or even self-demotion through this endpoint).
  if (String(target._id) === actor.id) throw forbidden("You cannot change your own role or permissions.");
  assertCanManage(actor, target);
  const newRole = change.role as Role;
  const perms = (change.permissions ?? []).filter((p): p is Permission => (PERMISSIONS as readonly string[]).includes(p));

  const touchesPrivileged = newRole === "admin" || newRole === "super_admin" || target.role === "admin" || target.role === "super_admin";
  if (touchesPrivileged) {
    // Critical: only super admins, and only after re-entering their own password.
    if (actor.role !== "super_admin") throw forbidden("Only a super administrator can change administrator roles.");
    const me = await User.findById(actor.id).select("+passwordHash");
    if (!change.reauthPassword || !me || !(await verifyPassword(change.reauthPassword, me.passwordHash))) {
      throw new ServiceError("forbidden", "Re-enter your password to confirm this critical change.", { reauthPassword: "v.password_wrong" });
    }
  }
  // Cannot hand out more than you hold, nor a role above your own.
  if (actor.role !== "super_admin") {
    if (ROLE_RANK[newRole] >= ROLE_RANK[actor.role]) throw forbidden("You cannot assign a role equal to or above your own.");
    const mine = effectivePermissions(actor);
    for (const p of perms) if (!mine.has(p)) throw forbidden(`You cannot grant a permission you do not hold (${p}).`);
  }
  if (target.role === "super_admin" && newRole !== "super_admin") {
    const others = await User.countDocuments({ role: "super_admin", accountStatus: "active", _id: { $ne: target._id } });
    if (others === 0) throw new ServiceError("conflict", "At least one active super administrator must remain.");
  }
  const before = { role: target.role, permissions: target.permissions };
  target.role = newRole;
  target.set("permissions", perms);
  await target.save();
  await Session.deleteMany({ user: target._id }); // force re-authentication with the new privileges
  await audit(actor, "user.role_change", { type: "user", id }, { before, after: { role: newRole, permissions: perms } });
  await notify(id, { type: "account.role_changed", title: { en: "Your account role was updated", ta: "உங்கள் கணக்கு பங்கு புதுப்பிக்கப்பட்டது" }, critical: true });
}

export async function setAccountStatus(actor: Principal, id: string, status: "active" | "suspended" | "disabled", opts: { reason?: string; confirm?: boolean } = {}) {
  await connectDB();
  if (!can(actor, "users.suspend")) throw forbidden();
  const target = await loadTarget(id);
  assertCanManage(actor, target);
  if (status !== "active") {
    if (!opts.confirm) throw invalid("Please confirm this action.");
    if (!opts.reason || plain(opts.reason).length < 3) throw invalid("A reason is required.", { reason: "v.reason_short" });
  }
  if (target.role === "super_admin" && status !== "active") {
    const others = await User.countDocuments({ role: "super_admin", accountStatus: "active", _id: { $ne: target._id } });
    if (others === 0) throw new ServiceError("conflict", "You cannot suspend the last active super administrator.");
  }
  target.accountStatus = status;
  target.statusReason = status === "active" ? undefined : plain(opts.reason);
  await target.save();
  if (status !== "active") await revokeAllSessions(id);
  await audit(actor, `user.${status === "active" ? "reactivate" : status}`, { type: "user", id }, { reason: opts.reason });
  await notify(id, {
    type: "account.status",
    title: status === "active" ? { en: "Your account was reactivated", ta: "உங்கள் கணக்கு மீண்டும் செயல்படுத்தப்பட்டது" } : { en: "Your account was suspended", ta: "உங்கள் கணக்கு இடைநிறுத்தப்பட்டது" },
    critical: true,
  });
}

export async function adminRevokeSessions(actor: Principal, id: string) {
  await connectDB();
  if (!can(actor, "users.suspend")) throw forbidden();
  const target = await loadTarget(id);
  assertCanManage(actor, target, { allowSelf: true });
  await revokeAllSessions(id);
  await audit(actor, "user.sessions_revoked", { type: "user", id });
}

export async function adminTriggerReset(actor: Principal, id: string) {
  await connectDB();
  if (!can(actor, "users.edit")) throw forbidden();
  const target = await loadTarget(id);
  assertCanManage(actor, target);
  await sendResetEmail(target);
  await audit(actor, "user.reset_triggered", { type: "user", id });
}

export async function adminVerifyEmail(actor: Principal, id: string) {
  await connectDB();
  if (!can(actor, "users.edit")) throw forbidden();
  const target = await loadTarget(id);
  assertCanManage(actor, target, { allowSelf: true });
  target.emailVerifiedAt = new Date();
  await target.save();
  await audit(actor, "user.verified_by_admin", { type: "user", id });
}

export async function addUserNote(actor: Principal, id: string, note: string) {
  await connectDB();
  if (!can(actor, "users.edit")) throw forbidden();
  const text = plain(note).slice(0, 2000);
  if (!text) throw invalid("Write a note.");
  const target = await loadTarget(id);
  target.adminNotes.push({ by: oid(actor.id)!, note: text, at: new Date() } as never);
  await target.save();
  await audit(actor, "user.note", { type: "user", id });
}

/** Anonymise an account after a deletion request. Published articles stay but lose personal attribution. */
export async function processDeletion(actor: Principal, id: string, opts: { confirm?: boolean } = {}) {
  await connectDB();
  if (!can(actor, "users.delete")) throw forbidden();
  if (!opts.confirm) throw invalid("Please confirm this action.");
  const target = await loadTarget(id);
  assertCanManage(actor, target);
  if (target.accountStatus !== "deletion_requested" && actor.role !== "super_admin") {
    throw new ServiceError("conflict", "Only accounts with a pending deletion request can be deleted.");
  }
  if (target.role === "super_admin") throw forbidden("Super administrator accounts cannot be deleted here.");
  target.set({
    name: "Deleted user",
    email: `deleted+${target._id}@invalid.local`,
    normalizedEmail: `deleted+${target._id}@invalid.local`,
    phone: "+00000000000",
    address: { line1: "-", city: "-", state: "-", postalCode: "000", country: "-" },
    gender: "prefer_not_to_say",
    bio: undefined,
    adminNotes: [],
    accountStatus: "deleted",
    publicAuthor: false,
  });
  await target.save();
  await revokeAllSessions(id);
  await Article.updateMany({ submitter: target._id, status: { $in: ["draft", "changes_requested"] } }, { $set: { deletedAt: new Date() } });
  await audit(actor, "user.deleted", { type: "user", id });
}

export async function exportUsersCsv(actor: Principal) {
  await connectDB();
  if (!can(actor, "users.export")) throw forbidden();
  const users = await User.find({ accountStatus: { $ne: "deleted" } }).sort({ createdAt: -1 }).limit(20000).lean();
  const esc = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // neutralise spreadsheet formula injection
    return `"${s.replace(/"/g, '""')}"`;
  };
  const header = ["id", "name", "email", "phone", "role", "status", "verified", "city", "state", "country", "createdAt", "lastLoginAt"];
  const lines = users.map((u) => [String(u._id), u.name, u.email, u.phone, u.role, u.accountStatus, u.emailVerifiedAt ? "yes" : "no", u.address?.city, u.address?.state, u.address?.country, u.createdAt.toISOString(), u.lastLoginAt?.toISOString()].map(esc).join(","));
  await audit(actor, "user.export", undefined, { count: users.length });
  return [header.join(","), ...lines].join("\n");
}
