import type { Metadata } from "next";
import { apiGet } from "@/lib/api";
import { requireStaffPage } from "@/lib/admin";
import type { SiteData } from "@/lib/types";
import { SettingsForm, type AdItem, type SettingsData } from "@/components/admin/SettingsForm";

export const metadata: Metadata = { title: "Settings & ads" };

export default async function Settings() {
  await requireStaffPage("/admin/settings", "settings.manage");
  const [{ settings }, { items: ads }, site] = await Promise.all([apiGet<{ settings: SettingsData }>("/admin/settings"), apiGet<{ items: AdItem[] }>("/admin/ads"), apiGet<SiteData>("/public/site", { lang: "en" })]);
  const categories = site.tree.flatMap((n) => [{ slug: n.slug, name: n.name.en }, ...n.children.map((c) => ({ slug: c.slug, name: `${n.name.en} › ${c.name.en}` }))]);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="headline text-3xl">Settings &amp; ads</h1>
        <p className="text-sm text-ink2">Everything here is stored in MongoDB and applies to the public site immediately.</p>
      </div>
      <SettingsForm initial={settings} ads={ads} categories={categories} />
    </div>
  );
}
