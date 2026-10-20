import type { Metadata } from "next";
import { apiGet } from "@/lib/api";
import { requireStaffPage } from "@/lib/admin";
import type { SiteData } from "@/lib/types";
import { StaffWorkspace } from "@/components/admin/StaffWorkspace";

export const metadata: Metadata = { title: "New article" };

export default async function NewArticle() {
  await requireStaffPage("/admin/articles/new", "articles.create");
  const site = await apiGet<SiteData>("/public/site", { lang: "en" });
  return (
    <div className="space-y-4">
      <h1 className="headline text-3xl">New article</h1>
      <p className="text-sm text-ink2">Write the Tamil and English versions independently. Save the draft, then publish or schedule from the Workflow panel. Admins publish directly, with no moderation queue.</p>
      <StaffWorkspace article={null} tree={site.tree} allowed={[]} editors={[]} maxImages={site.settings.maxImages} />
    </div>
  );
}
