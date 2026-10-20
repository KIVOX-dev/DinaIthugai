import type { Metadata } from "next";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import { fmt, requireStaffPage } from "@/lib/admin";
import { can, ROLES } from "@/lib/shared/permissions";
import { Pagination } from "@/components/ui/Pagination";

export const metadata: Metadata = { title: "Users" };
type Row = { id: string; name: string; email: string; phone: string; role: string; status: string; emailVerified: boolean; createdAt: string; lastLoginAt?: string };
const field = "rounded border border-rule bg-paper px-2 py-1.5 text-sm";
const tone: Record<string, string> = { active: "text-ok", suspended: "text-accent", disabled: "text-accent", deletion_requested: "text-warn", deleted: "text-ink3" };

export default async function Users({ searchParams }: PageProps<"/admin/users">) {
  const me = await requireStaffPage("/admin/users", "users.view");
  const sp = (await searchParams) as Record<string, string | undefined>;
  const d = await apiGet<{ items: Row[]; total: number; page: number; pages: number }>("/admin/users", { q: sp.q, role: sp.role, status: sp.status, from: sp.from, to: sp.to, page: sp.page });
  const href = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, page: String(p) })) if (v) q.set(k, v);
    return `/admin/users?${q}`;
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="headline text-3xl">Users</h1>
        {can(me, "users.export") && (
          <a href="/api/admin/users/export.csv" className="rounded border border-brand px-4 py-2 text-sm font-bold text-brand no-underline">
            Export CSV
          </a>
        )}
      </div>
      <form method="get" className="flex flex-wrap items-end gap-2 rounded border border-rule bg-paper p-3">
        <label className="text-xs font-bold">
          Search
          <input name="q" defaultValue={sp.q} placeholder="name, email, phone" className={`${field} mt-1 block w-52`} />
        </label>
        <label className="text-xs font-bold">
          Role
          <select name="role" defaultValue={sp.role ?? ""} className={`${field} mt-1 block`}>
            <option value="">Any</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-bold">
          Status
          <select name="status" defaultValue={sp.status ?? ""} className={`${field} mt-1 block`}>
            <option value="">Any</option>
            {["active", "suspended", "disabled", "deletion_requested", "deleted"].map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-bold">
          Registered from
          <input type="date" name="from" defaultValue={sp.from} className={`${field} mt-1 block`} />
        </label>
        <label className="text-xs font-bold">
          to
          <input type="date" name="to" defaultValue={sp.to} className={`${field} mt-1 block`} />
        </label>
        <button className="rounded bg-brand px-4 py-1.5 text-sm font-bold text-brand-ink">Filter</button>
        <Link href="/admin/users" className="px-2 py-1.5 text-sm text-ink2 underline">
          Reset
        </Link>
        <span className="ml-auto text-sm text-ink3">{d.total} user(s)</span>
      </form>
      <div className="overflow-x-auto rounded border border-rule bg-paper">
        <table className="w-full min-w-[52rem] text-left text-sm">
          <thead className="bg-paper2 text-xs uppercase text-ink3">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Verified</th>
              <th className="px-3 py-2">Registered</th>
              <th className="px-3 py-2">Last login</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {d.items.map((u) => (
              <tr key={u.id} className="hover:bg-paper2/60">
                <td className="px-3 py-2 font-medium">
                  <Link href={`/admin/users/${u.id}`}>{u.name}</Link>
                </td>
                <td className="px-3 py-2">{u.email}</td>
                <td className="px-3 py-2 capitalize">{u.role.replace("_", " ")}</td>
                <td className={`px-3 py-2 font-bold capitalize ${tone[u.status] ?? ""}`}>{u.status.replace("_", " ")}</td>
                <td className="px-3 py-2">{u.emailVerified ? "✓" : "—"}</td>
                <td className="whitespace-nowrap px-3 py-2 text-ink3">{fmt(u.createdAt)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-ink3">{fmt(u.lastLoginAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination lang="en" page={d.page} pages={d.pages} href={href} />
    </div>
  );
}
