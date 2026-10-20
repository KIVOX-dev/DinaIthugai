import type { Metadata } from "next";
import { apiGet } from "@/lib/api";
import { requireStaffPage } from "@/lib/admin";
import { CategoryManager } from "@/components/admin/CategoryManager";

export const metadata: Metadata = { title: "Categories" };

export default async function Categories() {
  await requireStaffPage("/admin/categories", "categories.manage");
  const { items } = await apiGet<{ items: Parameters<typeof CategoryManager>[0]["items"] }>("/admin/categories");
  return (
    <div className="space-y-4">
      <div>
        <h1 className="headline text-3xl">Categories</h1>
        <p className="text-sm text-ink2">Sections shown in the navigation and the homepage. A category&apos;s slug is its URL (/ta/slug and /en/slug), so change slugs with care.</p>
      </div>
      <CategoryManager items={items} />
    </div>
  );
}
