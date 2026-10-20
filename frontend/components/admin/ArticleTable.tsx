import Link from "next/link";
import { fmt } from "@/lib/admin";
import { STATUSES } from "@/lib/shared/article-states";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Pagination } from "@/components/ui/Pagination";

export type AdminRow = {
  id: string;
  title: string;
  titleTa?: string;
  titleEn?: string;
  status: string;
  source: string;
  category?: string;
  submitter?: string;
  assignedEditor?: string;
  languages: { ta: boolean; en: boolean };
  updatedAt: string;
  submittedAt?: string;
  publishedAt?: string;
  scheduledAt?: string;
  featured: boolean;
  breaking: boolean;
  images: number;
};
export type AdminList = { items: AdminRow[]; total: number; page: number; pages: number };

const field = "rounded border border-rule bg-paper px-2 py-1.5 text-sm";

/** Filter bar (plain GET form, so filters live in the URL) + table + pagination. */
export function ArticleTable({ data, base, params, queue }: { data: AdminList; base: string; params: Record<string, string | undefined>; queue?: boolean }) {
  const href = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...params, page: String(p) })) if (v) q.set(k, v);
    return `${base}?${q}`;
  };
  return (
    <div className="space-y-4">
      <form method="get" action={base} className="flex flex-wrap items-end gap-2 rounded border border-rule bg-paper p-3">
        <label className="text-xs font-bold">
          Search title
          <input name="q" defaultValue={params.q} className={`${field} mt-1 block w-48`} placeholder="headline…" />
        </label>
        <label className="text-xs font-bold">
          Status
          <select name="status" defaultValue={params.status ?? ""} className={`${field} mt-1 block`}>
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        {!queue && (
          <label className="text-xs font-bold">
            Source
            <select name="source" defaultValue={params.source ?? ""} className={`${field} mt-1 block`}>
              <option value="">All</option>
              <option value="staff">Staff</option>
              <option value="community">Community</option>
            </select>
          </label>
        )}
        <label className="text-xs font-bold">
          Language
          <select name="lang" defaultValue={params.lang ?? ""} className={`${field} mt-1 block`}>
            <option value="">Any</option>
            <option value="ta">Tamil</option>
            <option value="en">English</option>
          </select>
        </label>
        <label className="text-xs font-bold">
          Assigned
          <select name="assigned" defaultValue={params.assigned ?? ""} className={`${field} mt-1 block`}>
            <option value="">Anyone</option>
            <option value="me">Me</option>
            <option value="none">Unassigned</option>
          </select>
        </label>
        <button className="rounded bg-brand px-4 py-1.5 text-sm font-bold text-brand-ink">Filter</button>
        <Link href={base} className="px-2 py-1.5 text-sm text-ink2 underline">
          Reset
        </Link>
        <span className="ml-auto text-sm text-ink3">{data.total} article(s)</span>
      </form>

      <div className="overflow-x-auto rounded border border-rule bg-paper">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead className="bg-paper2 text-xs uppercase text-ink3">
            <tr>
              <th className="px-3 py-2">Headline</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">{queue ? "Submitter" : "Source"}</th>
              <th className="px-3 py-2">Lang</th>
              <th className="px-3 py-2">Imgs</th>
              <th className="px-3 py-2">Assigned</th>
              <th className="px-3 py-2">{queue ? "Submitted" : "Updated"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {data.items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-ink2">
                  Nothing here.
                </td>
              </tr>
            )}
            {data.items.map((r) => (
              <tr key={r.id} className="hover:bg-paper2/60">
                <td className="max-w-sm px-3 py-2">
                  <Link href={`/admin/articles/${r.id}`} className="headline block truncate text-base no-underline hover:underline">
                    {r.titleEn || r.titleTa || "(untitled)"}
                  </Link>
                  {r.titleEn && r.titleTa && <span className="block truncate text-xs text-ink3">{r.titleTa}</span>}
                  {(r.featured || r.breaking) && (
                    <span className="mt-0.5 inline-flex gap-1 text-[10px] font-bold uppercase">
                      {r.breaking && <span className="rounded bg-accent px-1 text-white">breaking</span>}
                      {r.featured && <span className="rounded bg-brand px-1 text-brand-ink">featured</span>}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <StatusBadge status={r.status} lang="en" />
                  {r.scheduledAt && r.status === "scheduled" && <span className="mt-1 block text-xs text-ink3">{fmt(r.scheduledAt)}</span>}
                </td>
                <td className="px-3 py-2">{r.category ?? "—"}</td>
                <td className="px-3 py-2">{queue ? r.submitter ?? "—" : r.source}</td>
                <td className="px-3 py-2">
                  {r.languages.ta && "த"} {r.languages.en && "EN"}
                </td>
                <td className="px-3 py-2">{r.images}</td>
                <td className="px-3 py-2">{r.assignedEditor ?? "—"}</td>
                <td className="whitespace-nowrap px-3 py-2 text-ink3">{fmt(queue ? r.submittedAt ?? r.updatedAt : r.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination lang="en" page={data.page} pages={data.pages} href={href} />
    </div>
  );
}
