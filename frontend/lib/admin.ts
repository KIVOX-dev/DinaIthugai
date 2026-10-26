import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser } from "./api";
import { can, isStaff, type Permission } from "./shared/permissions";
import type { Principal } from "./types";

/** Server-side gate for admin pages. The backend re-checks every call; this only avoids rendering pages the user cannot use. */
export async function requireStaffPage(path: string, perm?: Permission): Promise<Principal> {
  const u = await getCurrentUser();
  if (!u) redirect(`/ta/login?next=${encodeURIComponent(path)}`);
  if (!isStaff(u)) redirect("/en");
  if (perm && !can(u, perm)) redirect("/admin?denied=1");
  return u;
}

export const fmt = (iso?: string | null) =>
  iso ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(iso)) : "—";
