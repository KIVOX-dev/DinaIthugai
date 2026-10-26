import Link from "next/link";
import type { Locale } from "@/lib/shared/i18n";
import type { CategoryNode, SiteSettings } from "@/lib/types";
import { makeT } from "@/lib/i18n/dictionary";
import { SocialIcons } from "./SocialIcons";

export function Footer({ lang, settings, tree }: { lang: Locale; settings: SiteSettings; tree: CategoryNode[] }) {
  const t = makeT(lang);
  const pages = [
    ["about", t("footer.about")],
    ["contact", t("footer.contact")],
    ["editorial-policy", t("footer.editorial")],
    ["corrections-policy", t("footer.corrections")],
    ["privacy", t("footer.privacy")],
    ["terms", t("footer.terms")],
  ] as const;
  const link = "no-underline hover:underline";
  return (
    <footer className="mt-14 bg-[#6e6a67] text-white">
      <div className="mx-auto max-w-[1500px] 2xl:max-w-[1800px] px-4 py-10">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-4">
            <Link href={`/${lang}`} className="inline-block" aria-label={settings.siteName[lang] ?? undefined}>
              {/* Default: white version of the masthead logo straight on the footer colour.
                  An admin-uploaded logo is a dark-on-white image, so it's turned light and
                  blended in (invert → the white background goes black, and `screen` makes
                  black vanish into the footer) instead of sitting on a white plate. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={settings.logo ?? "/logo-white.png"}
                alt={settings.siteName[lang] ?? ""}
                width={2400}
                height={672}
                className={settings.logo ? "h-20 w-auto grayscale invert mix-blend-screen" : "h-20 w-auto"}
                loading="lazy"
              />
            </Link>
            <p className="mt-3 max-w-xs text-sm text-white/85">{settings.tagline[lang]}</p>
            <div className="mt-4">
              <SocialIcons social={settings.social} />
            </div>
            {settings.contact?.email && (
              <p className="mt-4 text-sm">
                <a href={`mailto:${settings.contact.email}`} className={link}>
                  {settings.contact.email}
                </a>
              </p>
            )}
            {settings.contact?.phone && <p className="text-sm">{settings.contact.phone}</p>}
            {settings.contact?.address?.[lang] && <p className="mt-1 text-sm text-white/85">{settings.contact.address[lang]}</p>}
          </div>

          <nav aria-label={t("footer.sections")} className="md:col-span-5">
            <h2 className="headline mb-3 border-b border-white/30 pb-2 text-xl">{t("footer.sections")}</h2>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3">
              {tree.map((c) => (
                <li key={c.slug}>
                  <Link href={`/${lang}/${c.slug}`} className={`headline ${link} text-[1.05rem]`}>
                    {c.name[lang]}
                  </Link>
                </li>
              ))}
              <li>
                <Link href={`/${lang}/gallery`} className={`headline ${link} text-[1.05rem]`}>
                  {t("nav.gallery")}
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-label={t("footer.company")} className="md:col-span-3">
            <h2 className="headline mb-3 border-b border-white/30 pb-2 text-xl">{t("footer.company")}</h2>
            <ul className="space-y-1.5 text-[15px]">
              {pages.map(([slug, label]) => (
                <li key={slug}>
                  <Link href={`/${lang}/${slug}`} className={link}>
                    {label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href={`/${lang}/account/submit`} className={link}>
                  {t("nav.submit")}
                </Link>
              </li>
              <li>
                <a href={`/rss/${lang}.xml`} className={link}>
                  RSS
                </a>
              </li>
              {(settings.footerLinks ?? []).map((l) => (
                <li key={l.href}>
                  <a href={l.href ?? "#"} className={link}>
                    {l.label?.[lang] ?? l.label?.en}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
      <div className="border-t border-white/25 bg-black/15 py-3 text-center text-xs text-white/85">
        © {new Date().getFullYear()} {settings.siteName[lang]}. {t("footer.rights")}
      </div>
    </footer>
  );
}
