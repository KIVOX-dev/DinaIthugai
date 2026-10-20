import type { Metadata } from "next";
import { apiGet } from "@/lib/api";
import { requireStaffPage } from "@/lib/admin";
import { MediaLibrary } from "@/components/admin/MediaLibrary";
import { Pagination } from "@/components/ui/Pagination";

export const metadata: Metadata = { title: "Media" };

export default async function Media({ searchParams }: PageProps<"/admin/media">) {
  await requireStaffPage("/admin/media", "media.manage");
  const sp = (await searchParams) as { page?: string; q?: string };
  const d = await apiGet<{ items: Parameters<typeof MediaLibrary>[0]["items"]; total: number; pages: number }>("/media", { page: sp.page, q: sp.q });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="headline text-3xl">Media</h1>
        <p className="text-sm text-ink2">{d.total} image(s). Uploads are validated by content, re-encoded and stripped of metadata. Images stay private until an article that uses them is published.</p>
      </div>
      <MediaLibrary items={d.items} />
      <Pagination lang="en" page={Number(sp.page) || 1} pages={d.pages} href={(p) => `/admin/media?page=${p}`} />
    </div>
  );
}
