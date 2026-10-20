import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "../globals.css";
import { fontVars } from "@/frontend/fonts";
import { isLocale } from "@/shared/i18n";
import { getSettings } from "@/backend/services/settings";
import { getCategoryTree } from "@/backend/articles/queries";
import { getCurrentUser } from "@/backend/auth/current-user";
import { Header } from "@/frontend/components/site/Header";
import { Footer } from "@/frontend/components/site/Footer";
import { makeT } from "@/frontend/i18n/dictionary";
import { env } from "@/backend/env";

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const s = await getSettings();
  return {
    metadataBase: new URL(env().APP_URL),
    title: { default: `${s.siteName?.[lang]} — ${s.tagline?.[lang]}`, template: `%s | ${s.siteName?.[lang]}` },
    description: s.seo?.description?.[lang] ?? s.tagline?.[lang] ?? undefined,
    alternates: { languages: { ta: "/ta", en: "/en" }, types: { "application/rss+xml": `/rss/${lang}.xml` } },
    openGraph: { siteName: s.siteName?.[lang] ?? undefined, locale: lang === "ta" ? "ta_IN" : "en_IN", type: "website" },
  };
}

export default async function LangLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const [settings, tree, user] = await Promise.all([getSettings(), getCategoryTree(), getCurrentUser()]);
  const t = makeT(lang);
  return (
    <html lang={lang} className={fontVars}>
      <body>
        {settings.maintenanceMode && !(user && user.role !== "contributor" && user.role !== "reader") ? (
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
