import Link from "next/link";
import type { Locale } from "@/lib/shared/i18n";
import type { CategoryNode, Principal, SiteSettings } from "@/lib/types";
import { isStaff } from "@/lib/shared/permissions";
import { formatLongDate, makeT } from "@/lib/i18n/dictionary";
import { LanguageSwitch } from "./LanguageSwitch";
import { Masthead } from "./Logo";
import { MenuDrawer, type NavItem } from "./MobileNav";
import { SearchToggle } from "./SearchToggle";
import { LogoutButton } from "./LogoutButton";
import { SocialIcons } from "./SocialIcons";

export function Header({ lang, settings, tree, user }: { lang: Locale; settings: SiteSettings; tree: CategoryNode[]; user: Principal | null }) {
  const t = makeT(lang);
  const nav = tree.filter((n) => n.showInNav);
  const drawer: NavItem[] = [
    { href: `/${lang}`, label: t("nav.home") },
    ...nav.map((n) => ({ href: `/${lang}/${n.slug}`, label: n.name[lang], children: n.children.map((c) => ({ href: `/${lang}/${c.slug}`, label: c.name[lang] })) })),
  ];
  const extra: NavItem[] = [
    { href: `/${lang}/latest`, label: t("nav.latest") },
    { href: `/${lang}/trending`, label: t("nav.trending") },
    { href: `/${lang}/gallery`, label: t("nav.gallery") },
    { href: `/${lang}/account/submit`, label: t("nav.submit") },
    ...(user ? [{ href: `/${lang}/account`, label: t("nav.account") }] : [{ href: `/${lang}/login`, label: t("nav.login") }, { href: `/${lang}/register`, label: t("nav.register") }]),
  ];
  const primary = nav.slice(0, 8);
  const now = new Date();

  return (
    <header className="bg-paper">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:bg-brand focus:p-2 focus:text-brand-ink">
        {t("site.skip")}
      </a>

      {/* Row 1: social + quick links (left), logo (centre), language / account / submit (right) */}
      <div className="mx-auto grid max-w-[1500px] 2xl:max-w-[1800px] grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-2 lg:py-4">
        <div className="hidden min-w-0 flex-wrap items-center gap-x-4 gap-y-2 lg:flex">
          <SocialIcons social={settings.social} />
          <Link href={`/${lang}/latest`} className="headline text-lg font-medium no-underline hover:text-brand">
            {t("nav.latest")}
          </Link>
          <Link href={`/${lang}/trending`} className="headline text-lg font-medium no-underline hover:text-brand">
            {t("nav.trending")}
          </Link>
          <Link href={`/${lang}/gallery`} className="headline text-lg font-medium no-underline hover:text-brand">
            {t("nav.gallery")}
          </Link>
        </div>
        <div className="col-span-3 row-start-2 text-center lg:col-span-1 lg:col-start-2 lg:row-start-1">
          <div className="inline-block">
            <Masthead lang={lang} name={settings.siteName} logoSrc={settings.logo} />
            <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-ink3">
              <time dateTime={now.toISOString()}>{formatLongDate(now, lang)}</time>
              {settings.edition?.[lang] && <span> · {settings.edition[lang]}</span>}
            </p>
          </div>
        </div>
        <div className="relative z-10 col-span-3 row-start-1 flex min-w-0 flex-col items-end gap-2 lg:col-span-1 lg:col-start-3">
          <LanguageSwitch lang={lang} label={t("lang.switch")} />
          <div className="hidden items-center gap-3 text-sm lg:flex">
            {user ? (
              <>
                {isStaff(user) && (
                  <Link href="/admin" className="font-bold text-brand no-underline">
                    {t("nav.admin")}
                  </Link>
                )}
                <Link href={`/${lang}/account`} className="max-w-32 truncate no-underline hover:underline">
                  {user.name}
                </Link>
                <LogoutButton lang={lang} label={t("nav.logout")} />
              </>
            ) : (
              <>
                <Link href={`/${lang}/login`} className="no-underline hover:underline">
                  {t("nav.login")}
                </Link>
                <Link href={`/${lang}/register`} className="no-underline hover:underline">
                  {t("nav.register")}
                </Link>
              </>
            )}
            <Link href={`/${lang}/account/submit`} className="rounded bg-accent px-3 py-1.5 font-bold text-white no-underline">
              {t("nav.submit")}
            </Link>
          </div>
        </div>
      </div>

      {/* Row 2: full-width grey navigation bar: menu, sections, search */}
      <nav aria-label="Sections" className="bg-[#6e6a67] text-white">
        <div className="mx-auto flex max-w-[1500px] 2xl:max-w-[1800px] items-center px-2">
          <MenuDrawer items={drawer} extra={extra} labels={{ menu: t("nav.menu"), close: t("nav.close"), sections: t("footer.sections") }} />
          <ul className="no-scrollbar flex flex-1 items-stretch justify-start gap-1 overflow-x-auto md:justify-center lg:gap-3">
            {primary.map((n) => (
              <li key={n.slug} className="group relative shrink-0">
                <Link href={`/${lang}/${n.slug}`} className="headline block whitespace-nowrap px-3 py-2.5 text-[1.05rem] font-bold no-underline hover:bg-white/10 lg:text-[1.3rem]">
                  {n.name[lang]}
                </Link>
                {n.children.length > 0 && (
                  <ul className="absolute left-0 top-full z-30 hidden min-w-44 border border-rule bg-paper py-1 text-ink shadow-lg group-focus-within:block group-hover:block">
                    {n.children.map((c) => (
                      <li key={c.slug}>
                        <Link href={`/${lang}/${c.slug}`} className="block px-3 py-1.5 text-sm font-medium no-underline hover:bg-paper2">
                          {c.name[lang]}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
          <SearchToggle lang={lang} placeholder={t("search.placeholder")} label={t("nav.search")} />
        </div>
      </nav>
    </header>
  );
}
