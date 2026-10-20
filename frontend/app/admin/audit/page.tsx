import type { Metadata } from "next";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import { fmt, requireStaffPage } from "@/lib/admin";
import { Pagination } from "@/components/ui/Pagination";

export const metadata: Metadata = { title: "Audit log" };
type Row = { id: string; action: string; actor: string; target: string; at: string; meta: string };

export default async function Audit({ searchParams }: PageProps<"/admin/audit">) {
  await requireStaffPage("/admin/audit", "audit.view");
  const sp = (await searchParams) as { page?: string; action?: string };
  const d = await apiGet<{ items: Row[]; total: number; pages: number }>("/admin/audit", { page: sp.page, action: sp.action });
  const page = Number(sp.page) || 1;
  return (
    <div className="space-y-4">
      <h1 className="headline text-3xl">Audit log</h1>
      <form method="get" className="flex items-end gap-2">
        <label className="text-xs font-bold">
          Action starts with
          <input name="action" defaultValue={sp.action} placeholder="article. / user. / auth." className="mt-1 block rounded border border-rule bg-paper px-2 py-1.5 text-sm" />
        </label>
        <button className="rounded bg-brand px-4 py-1.5 text-sm font-bold text-brand-ink">Filter</button>
        <Link href="/admin/audit" className="px-2 py-1.5 text-sm text-ink2 underline">
          Reset
        </Link>
        <span className="ml-auto text-sm text-ink3">{d.total} event(s)</span>
      </form>
      <div className="overflow-x-auto rounded border border-rule bg-paper">
        <table className="w-full min-w-[46rem] text-left text-sm">
          <thead className="bg-paper2 text-xs uppercase text-ink3">
            <tr>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Who</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Target</th>
              <th className="px-3 py-2">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {d.items.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap px-3 py-2 text-ink3">{fmt(r.at)}</td>
                <td className="px-3 py-2">{r.actor}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.action}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.target}</td>
                <td className="max-w-xs truncate px-3 py-2 font-mono text-xs text-ink3">{r.meta}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination lang="en" page={page} pages={d.pages} href={(p) => `/admin/audit?page=${p}${sp.action ? `&action=${encodeURIComponent(sp.action)}` : ""}`} />
    </div>
  );
}
