import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "../globals.css";
import { fontVars } from "@/lib/fonts";
import { isLocale } from "@/lib/shared/i18n";
import { isStaff } from "@/lib/shared/permissions";
import { apiGet, getCurrentUser } from "@/lib/api";
import type { SiteData } from "@/lib/types";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { makeT } from "@/lib/i18n/dictionary";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const { settings: s } = await apiGet<SiteData>("/public/site", { lang });
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: `${s.siteName[lang]} — ${s.tagline[lang]}`, template: `%s | ${s.siteName[lang]}` },
    description: s.tagline[lang] ?? undefined,
    alternates: { languages: { ta: "/ta", en: "/en" }, types: { "application/rss+xml": `/rss/${lang}.xml` } },
    openGraph: { siteName: s.siteName[lang] ?? undefined, locale: lang === "ta" ? "ta_IN" : "en_IN", type: "website" },
  };
}

export default async function LangLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const [site, user] = await Promise.all([apiGet<SiteData>("/public/site", { lang }), getCurrentUser()]);
  const { settings, tree } = site;
  const t = makeT(lang);
  const maintenance = settings.maintenanceMode && !isStaff(user);
  return (
    <html lang={lang} className={fontVars}>
      <body>
        {maintenance ? (
          <main className="mx-auto max-w-xl px-4 py-24 text-center">
            <h1 className="headline text-3xl">{t("maintenance.title")}</h1>
            <p className="mt-3 text-ink2">{settings.maintenanceMessage?.[lang] || t("maintenance.body")}</p>
          </main>
        ) : (
          <>
            <Header lang={lang} settings={settings} tree={tree} user={user} />
            <main id="main">{children}</main>
            <Footer lang={lang} settings={settings} tree={tree} />
          </>
        )}
      </body>
    </html>
  );
}
