import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ApiError, apiGet } from "@/lib/api";
import { requireStaffPage } from "@/lib/admin";
import { TRANSITIONS, checkTransition, type ArticleStatus } from "@/lib/shared/article-states";
import type { EditArticle, SiteData } from "@/lib/types";
import { StaffWorkspace } from "@/components/admin/StaffWorkspace";
import { StatusBadge } from "@/components/ui/StatusBadge";

export const metadata: Metadata = { title: "Edit article" };

export default async function AdminArticle({ params }: PageProps<"/admin/articles/[id]">) {
  const { id } = await params;
  const user = await requireStaffPage(`/admin/articles/${id}`);
  let article: EditArticle;
  try {
    article = (await apiGet<{ article: EditArticle }>(`/articles/${id}`)).article;
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) notFound();
    throw e;
  }
  const [site, editors] = await Promise.all([
    apiGet<SiteData>("/public/site", { lang: "en" }),
    article.can.review ? apiGet<{ items: { id: string; name: string; role: string }[] }>("/admin/editors").then((r) => r.items) : Promise.resolve([]),
  ]);
  // Same rule the server enforces: only offer the actions this user may actually perform.
  const allowed = TRANSITIONS[article.status as ArticleStatus].filter((to) => checkTransition({ from: article.status as ArticleStatus, to, source: article.source, actor: user, isOwner: article.can.owner }).ok);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="headline text-2xl sm:text-3xl">{article.title.en || article.title.ta || "(untitled)"}</h1>
        <StatusBadge status={article.status} lang="en" />
      </div>
      <StaffWorkspace article={article} tree={site.tree} allowed={allowed} editors={editors} maxImages={site.settings.maxImages} />
    </div>
  );
}
