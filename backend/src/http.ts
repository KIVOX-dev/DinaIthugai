import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError } from "zod";
import { env, isProd } from "./env";
import { principalFromToken } from "./services/auth";
import { ServiceError, type Principal } from "./services/common";
import { flattenIssues } from "./validation/schemas";
import { can, isStaff, type Permission } from "./shared/permissions";

declare module "express-serve-static-core" {
  interface Request {
    user: Principal | null;
  }
}

export const clientIp = (req: Request) => (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() || req.socket.remoteAddress || undefined;
export const ctx = (req: Request) => ({ ip: clientIp(req), userAgent: req.headers["user-agent"] });

export function cookieOptions(expires?: Date) {
  return { httpOnly: true, secure: isProd(), sameSite: "lax" as const, path: "/", ...(expires ? { expires } : {}) };
}

/** Attach req.user from the session cookie (null when anonymous). */
export const attachUser: RequestHandler = async (req, _res, next) => {
  try {
    const token = req.cookies?.[env().SESSION_COOKIE];
    req.user = await principalFromToken(typeof token === "string" ? token : undefined);
    next();
  } catch (e) {
    next(e);
  }
};

/**
 * CSRF defence in depth (cookies are SameSite=Lax): state-changing requests that carry an Origin header
 * must come from the configured frontend/app origins.
 */
export const originGuard: RequestHandler = (req, _res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (!origin) return next();
  const allowed = [env().FRONTEND_URL, env().APP_URL].filter(Boolean).map((u) => new URL(u!).origin);
  const selfHost = req.headers.host;
  try {
    if (allowed.includes(new URL(origin).origin) || new URL(origin).host === selfHost) return next();
  } catch {
    /* fallthrough */
  }
  next(new ServiceError("forbidden", "Cross-origin request blocked."));
};

export const requireUser: RequestHandler = (req, _res, next) => (req.user ? next() : next(new ServiceError("unauthorized", "Please sign in.")));
export const requireStaff: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(new ServiceError("unauthorized", "Please sign in."));
  if (!isStaff(req.user)) return next(new ServiceError("forbidden", "Staff access required."));
  next();
};
export const requirePerm = (perm: Permission): RequestHandler => (req, _res, next) => {
  if (!req.user) return next(new ServiceError("unauthorized", "Please sign in."));
  if (!can(req.user, perm)) return next(new ServiceError("forbidden", `Missing permission: ${perm}`));
  next();
};

export const user = (req: Request): Principal => {
  if (!req.user) throw new ServiceError("unauthorized", "Please sign in.");
  return req.user;
};

export const param = (req: Request, name: string): string => String(req.params[name] ?? "");

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ServiceError) {
    res.status(err.status).json({ error: err.message, code: err.code, fieldErrors: err.details });
    return;
  }
  if (err instanceof ZodError) {
    res.status(422).json({ error: "Invalid input.", code: "invalid", fieldErrors: flattenIssues(err) });
    return;
  }
  const e = err as { type?: string; status?: number; code?: string };
  if (e?.type === "entity.parse.failed") {
    res.status(400).json({ error: "Malformed JSON body.", code: "invalid" });
    return;
  }
  if (e?.code === "LIMIT_FILE_SIZE") {
    res.status(413).json({ error: "That file is too large.", code: "invalid", fieldErrors: { file: "v.upload_too_large" } });
    return;
  }
  console.error("[api] unhandled error", err);
  res.status(500).json({ error: "Internal server error.", code: "internal" });
}
