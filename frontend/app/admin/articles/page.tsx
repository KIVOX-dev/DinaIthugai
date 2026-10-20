import type { Metadata } from "next";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import { requireStaffPage } from "@/lib/admin";
import { can } from "@/lib/shared/permissions";
import { ArticleTable, type AdminList } from "@/components/admin/ArticleTable";

export const metadata: Metadata = { title: "Articles" };

export default async function Articles({ searchParams }: PageProps<"/admin/articles">) {
  const user = await requireStaffPage("/admin/articles");
  const sp = (await searchParams) as Record<string, string | undefined>;
  const data = await apiGet<AdminList>("/admin/articles", { q: sp.q, status: sp.status, source: sp.source, lang: sp.lang, assigned: sp.assigned, page: sp.page });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="headline text-3xl">Articles</h1>
        {can(user, "articles.create") && (
          <Link href="/admin/articles/new" className="rounded bg-brand px-4 py-2 font-bold text-brand-ink no-underline">
            + New article
          </Link>
        )}
      </div>
      <ArticleTable data={data} base="/admin/articles" params={sp} />
    </div>
  );
}
