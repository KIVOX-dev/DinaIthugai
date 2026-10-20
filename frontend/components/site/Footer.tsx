import Link from "next/link";
import type { Locale } from "@/shared/i18n";
import type { CategoryNode } from "@/backend/articles/queries";
import type { SettingsDoc } from "@/backend/models";
import { makeT } from "@/frontend/i18n/dictionary";

export function Footer({ lang, settings, tree }: { lang: Locale; settings: SettingsDoc; tree: CategoryNode[] }) {
  const t = makeT(lang);
  const pages = [
    ["about", t("footer.about")],
    ["contact", t("footer.contact")],
    ["editorial-policy", t("footer.editorial")],
    ["corrections-policy", t("footer.corrections")],
    ["privacy", t("footer.privacy")],
    ["terms", t("footer.terms")],
  ] as const;
  const social = Object.entries(settings.social ?? {}).filter(([, v]) => v);
  return (
    <footer className="mt-12 border-t-4 border-brand bg-paper2">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 md:grid-cols-4">
        <div>
          <p className="headline text-2xl text-brand">{settings.siteName?.[lang]}</p>
          <p className="mt-2 text-sm text-ink2">{settings.tagline?.[lang]}</p>
          {settings.contact?.email && (
            <p className="mt-3 text-sm">
              <a href={`mailto:${settings.contact.email}`}>{settings.contact.email}</a>
            </p>
          )}
          {settings.contact?.address?.[lang] && <p className="text-sm text-ink2">{settings.contact.address[lang]}</p>}
        </div>
        <div>
          <h2 className="mb-2 font-bold">{t("footer.sections")}</h2>
          <ul className="grid grid-cols-2 gap-1 text-sm">
            {tree.map((c) => (
              <li key={c.slug}>
                <Link href={`/${lang}/${c.slug}`} className="no-underline hover:underline">
                  {c.name[lang]}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="mb-2 font-bold">{t("footer.company")}</h2>
          <ul className="space-y-1 text-sm">
            {pages.map(([slug, label]) => (
              <li key={slug}>
                <Link href={`/${lang}/${slug}`} className="no-underline hover:underline">
                  {label}
                </Link>
              </li>
            ))}
            {(settings.footerLinks ?? []).map((l) => (
              <li key={l.href}>
                <a href={l.href ?? "#"} className="no-underline hover:underline">
                  {l.label?.[lang] ?? l.label?.en}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="mb-2 font-bold">{t("footer.follow")}</h2>
          <ul className="space-y-1 text-sm">
            {social.map(([k, v]) => (
              <li key={k}>
                <a href={String(v)} rel="noopener noreferrer" target="_blank" className="capitalize no-underline hover:underline">
                  {k}
                </a>
              </li>
            ))}
            <li>
              <a href={`/rss/${lang}.xml`} className="no-underline hover:underline">
                RSS
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-rule py-3 text-center text-xs text-ink3">
        © {new Date().getFullYear()} {settings.siteName?.[lang]}. {t("footer.rights")}
      </div>
    </footer>
  );
}
