import type { Role } from "../shared/permissions";
import type { AccountStatus } from "../models/user";

/** The authenticated caller, as passed to every service function. */
export type Principal = {
  id: string;
  name: string;
  email: string;
  role: Role;
  permissions: string[];
  status: AccountStatus;
  emailVerified: boolean;
  preferredLanguage: "ta" | "en";
};

export class ServiceError extends Error {
  constructor(
    public code: "unauthorized" | "forbidden" | "not_found" | "invalid" | "conflict" | "rate_limited" | "locked" | "unavailable",
    message: string,
    public details?: Record<string, string>,
    public status: number = { unauthorized: 401, forbidden: 403, not_found: 404, invalid: 422, conflict: 409, rate_limited: 429, locked: 423, unavailable: 503 }[code],
  ) {
    super(message);
  }
}

export const forbidden = (m = "You do not have permission to do that.") => new ServiceError("forbidden", m);
export const notFound = (m = "Not found.") => new ServiceError("not_found", m);
export const invalid = (m: string, details?: Record<string, string>) => new ServiceError("invalid", m, details);
