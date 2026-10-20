import { Router } from "express";
import { z } from "zod";
import { env } from "../env";
import { connectDB } from "../db";
import { User } from "../models";
import { changePassword, cancelAccountDeletion, login, logout, registerUser, requestAccountDeletion, requestPasswordReset, resendVerification, resetPassword, updateProfile, verifyEmail } from "../services/auth";
import { cookieOptions, ctx, requireUser, user } from "../http";
import { getSettings } from "../services/settings";
import { listNotifications, markNotificationsRead } from "../services/admin";

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  const out = await registerUser(req.body, ctx(req));
  res.status(201).json(out);
});

authRouter.post("/login", async (req, res) => {
  const { token, expiresAt, principal } = await login(req.body, ctx(req));
  res.cookie(env().SESSION_COOKIE, token, cookieOptions(expiresAt));
  res.json({ user: principal });
});

authRouter.post("/logout", async (req, res) => {
  const token = req.cookies?.[env().SESSION_COOKIE];
  await logout(typeof token === "string" ? token : undefined);
  res.clearCookie(env().SESSION_COOKIE, cookieOptions());
  res.json({ ok: true });
});

authRouter.get("/me", async (req, res) => {
  res.json({ user: req.user });
});

authRouter.post("/verify-email", async (req, res) => {
  await verifyEmail(String(req.body?.token ?? ""));
  res.json({ ok: true });
});

authRouter.post("/resend-verification", requireUser, async (req, res) => {
  await resendVerification(user(req).email, ctx(req));
  res.json({ ok: true });
});

authRouter.post("/forgot-password", async (req, res) => {
  await requestPasswordReset(String(req.body?.email ?? ""), ctx(req));
  res.json({ ok: true }); // identical response whether or not the account exists
});

authRouter.post("/reset-password", async (req, res) => {
  await resetPassword(req.body);
  res.json({ ok: true });
});

authRouter.get("/profile", requireUser, async (req, res) => {
  await connectDB();
  const u = await User.findById(user(req).id).lean();
  if (!u) return void res.status(404).json({ error: "Not found" });
  res.json({
    profile: {
      name: u.name,
      email: u.email,
      phone: u.phone,
      gender: u.gender,
      address: u.address,
      bio: u.bio ?? "",
      preferredLanguage: u.preferredLanguage,
      notifyInApp: u.notificationPrefs?.inApp !== false,
      notifyEmail: u.notificationPrefs?.email !== false,
      emailVerified: !!u.emailVerifiedAt,
      deletionRequested: u.accountStatus === "deletion_requested",
    },
  });
});

authRouter.put("/profile", requireUser, async (req, res) => {
  await updateProfile(user(req), req.body);
  res.json({ ok: true });
});

authRouter.post("/change-password", requireUser, async (req, res) => {
  const b = z.object({ current: z.string().min(1).max(128), next: z.string().min(1).max(128) }).parse(req.body);
  await changePassword(user(req), b.current, b.next);
  res.clearCookie(env().SESSION_COOKIE, cookieOptions()); // all sessions were revoked
  res.json({ ok: true });
});

authRouter.post("/delete-request", requireUser, async (req, res) => {
  if (req.body?.cancel) await cancelAccountDeletion(user(req));
  else await requestAccountDeletion(user(req));
  res.json({ ok: true });
});

authRouter.get("/notifications", requireUser, async (req, res) => {
  res.json(await listNotifications(user(req)));
});

authRouter.post("/notifications/read", requireUser, async (req, res) => {
  await markNotificationsRead(user(req));
  res.json({ ok: true });
});

authRouter.get("/registration", async (_req, res) => {
  const s = await getSettings();
  res.json({ open: s.registrationOpen !== false });
});
