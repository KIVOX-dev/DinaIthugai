import type { Metadata } from "next";
import { apiGet } from "@/lib/api";
import { requireStaffPage } from "@/lib/admin";
import { ArticleTable, type AdminList } from "@/components/admin/ArticleTable";

export const metadata: Metadata = { title: "Review queue" };

export default async function Review({ searchParams }: PageProps<"/admin/review">) {
  await requireStaffPage("/admin/review", "articles.review");
  const sp = (await searchParams) as Record<string, string | undefined>;
  const data = await apiGet<AdminList>("/admin/articles", { queue: 1, q: sp.q, status: sp.status, lang: sp.lang, assigned: sp.assigned, page: sp.page });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="headline text-3xl">Review queue</h1>
        <p className="text-sm text-ink2">Community submissions waiting for an editor, oldest first. Approving never publishes automatically.</p>
      </div>
      <ArticleTable data={data} base="/admin/review" params={sp} queue />
    </div>
  );
}
