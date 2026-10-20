import Link from "next/link";
import { apiGet } from "@/lib/api";
import { fmt, requireStaffPage } from "@/lib/admin";

type Stats = {
  articles: { total: number; published: number; drafts: number; pending: number; changes: number; rejected: number; scheduled: number };
  users: { total: number; active: number; suspended: number } | null;
  activity: { id: string; action: string; reason?: string; at: string; by: string; articleId?: string; articleTitle: string }[];
};

function Card({ label, value, href, tone }: { label: string; value: number | string; href?: string; tone?: string }) {
  const body = (
    <div className={`rounded border border-rule bg-paper p-4 ${href ? "hover:border-brand" : ""}`}>
      <p className="text-sm text-ink2">{label}</p>
      <p className={`headline mt-1 text-3xl ${tone ?? ""}`}>{value}</p>
    </div>
  );
  return href ? (
    <Link href={href} className="no-underline">
      {body}
    </Link>
  ) : (
    body
  );
}

export default async function Dashboard({ searchParams }: PageProps<"/admin">) {
  await requireStaffPage("/admin");
  const sp = (await searchParams) as { denied?: string };
  const s = await apiGet<Stats>("/admin/stats");
  return (
    <div className="space-y-6">
      <h1 className="headline text-3xl">Dashboard</h1>
      {sp.denied && <p className="rounded border border-warn bg-paper p-3 text-sm">You do not have permission to open that page.</p>}
      <section aria-label="Articles" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card label="Total articles" value={s.articles.total} href="/admin/articles" />
        <Card label="Published" value={s.articles.published} href="/admin/articles?status=published" tone="text-ok" />
        <Card label="Drafts" value={s.articles.drafts} href="/admin/articles?status=draft" />
        <Card label="Scheduled" value={s.articles.scheduled} href="/admin/articles?status=scheduled" />
        <Card label="Pending review" value={s.articles.pending} href="/admin/review" tone={s.articles.pending ? "text-brand" : ""} />
        <Card label="Changes requested" value={s.articles.changes} href="/admin/review?status=changes_requested" tone="text-warn" />
        <Card label="Rejected" value={s.articles.rejected} href="/admin/articles?status=rejected" tone="text-accent" />
        {s.users && <Card label="Registered users" value={`${s.users.total}`} href="/admin/users" />}
      </section>
      {s.users && (
        <section aria-label="Users" className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card label="Active users" value={s.users.active} href="/admin/users?status=active" tone="text-ok" />
          <Card label="Suspended / disabled" value={s.users.suspended} href="/admin/users?status=suspended" tone="text-accent" />
        </section>
      )}
      <section className="rounded border border-rule bg-paper">
        <h2 className="headline border-b border-rule px-4 py-3 text-xl">Recent editorial activity</h2>
        {s.activity.length === 0 ? (
          <p className="p-4 text-ink2">No activity yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-paper2 text-xs uppercase text-ink3">
                <tr>
                  <th className="px-4 py-2">When</th>
                  <th className="px-4 py-2">Who</th>
                  <th className="px-4 py-2">Action</th>
                  <th className="px-4 py-2">Article</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {s.activity.map((a) => (
                  <tr key={a.id}>
                    <td className="whitespace-nowrap px-4 py-2 text-ink3">{fmt(a.at)}</td>
                    <td className="px-4 py-2">{a.by}</td>
                    <td className="px-4 py-2 font-medium capitalize">{a.action.replaceAll("_", " ")}</td>
                    <td className="max-w-xs truncate px-4 py-2">{a.articleId ? <Link href={`/admin/articles/${a.articleId}`}>{a.articleTitle}</Link> : a.articleTitle}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
