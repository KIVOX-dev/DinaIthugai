/** Date formatting usable from both server and client components (lib/admin.ts is server-only). */
export const fmt = (iso?: string | null) =>
  iso ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(iso)) : "—";
