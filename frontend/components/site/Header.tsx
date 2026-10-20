import Link from "next/link";
import type { Locale } from "@/shared/i18n";
import type { Principal } from "@/backend/services/common";
import type { CategoryNode } from "@/backend/articles/queries";
import type { SettingsDoc } from "@/backend/models";
import { isStaff } from "@/shared/permissions";
import { formatLongDate, makeT } from "@/frontend/i18n/dictionary";
import { LanguageSwitch } from "./LanguageSwitch";
import { Masthead } from "./Logo";
import { MobileNav, type NavItem } from "./MobileNav";
import { SearchBox } from "./SearchBox";
import { logoutAction } from "@/app/_actions/auth";

export function Header({ lang, settings, tree, user }: { lang: Locale; settings: SettingsDoc; tree: CategoryNode[]; user: Principal | null }) {
  const t = makeT(lang);
  const nav = tree.filter((n) => n.showInNav);
  const items: NavItem[] = [
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
  const visible = items.slice(0, 9);
  const overflow = items.slice(9);

  return (
    <header className="relative border-b border-rule bg-paper">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:bg-brand focus:p-2 focus:text-brand-ink">
        {t("site.skip")}
      </a>
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm text-ink2">
        <div className="flex items-center gap-3">
          <time dateTime={new Date().toISOString()}>{formatLongDate(new Date(), lang)}</time>
          {settings.edition?.[lang] && (
            <span className="hidden border-l border-rule pl-3 sm:inline">
              {t("home.edition")}: <strong>{settings.edition[lang]}</strong>
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <LanguageSwitch lang={lang} label={t("lang.switch")} />
          <div className="hidden items-center gap-3 sm:flex">
            {user ? (
              <>
                {isStaff(user) && (
                  <Link href="/admin" className="font-bold text-brand no-underline">
                    {t("nav.admin")}
                  </Link>
                )}
                <Link href={`/${lang}/account`} className="no-underline hover:underline">
                  {user.name}
                </Link>
                <form action={logoutAction}>
                  <input type="hidden" name="lang" value={lang} />
                  <button className="hover:underline">{t("nav.logout")}</button>
                </form>
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
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 pb-3 pt-1">
        <div className="hidden w-64 lg:block">
          <SearchBox lang={lang} placeholder={t("search.placeholder")} label={t("nav.search")} />
        </div>
        <div className="flex-1 text-center">
          <Masthead lang={lang} name={settings.siteName} />
          <p className="mt-1 hidden text-xs uppercase tracking-widest text-ink3 sm:block">{settings.tagline?.[lang]}</p>
        </div>
        <Link href={`/${lang}/account/submit`} className="hidden rounded bg-accent px-3 py-2 text-sm font-bold text-white no-underline lg:block">
          {t("nav.submit")}
        </Link>
        <MobileNav lang={lang} items={items} extra={extra} labels={{ menu: t("nav.menu"), close: t("nav.close") }} />
      </div>

      <nav aria-label="Sections" className="hidden border-y-2 border-ink bg-paper md:block">
        <ul className="mx-auto flex max-w-7xl flex-wrap items-stretch px-2 text-[15px] font-bold">
          {visible.map((it) => (
            <li key={it.href} className="group relative">
              <Link href={it.href} className="block px-3 py-2.5 no-underline hover:bg-brand hover:text-brand-ink">
                {it.label}
              </Link>
              {it.children && it.children.length > 0 && (
                <ul className="absolute left-0 top-full z-30 hidden min-w-48 border border-rule bg-paper py-1 shadow-lg group-focus-within:block group-hover:block">
                  {it.children.map((c) => (
                    <li key={c.href}>
                      <Link href={c.href} className="block px-3 py-1.5 text-sm font-medium no-underline hover:bg-paper2">
                        {c.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
          <li className="group relative">
            <span tabIndex={0} className="block cursor-default px-3 py-2.5 hover:bg-paper2">
              {t("nav.more")} ▾
            </span>
            <ul className="absolute right-0 top-full z-30 hidden min-w-44 border border-rule bg-paper py-1 shadow-lg group-focus-within:block group-hover:block">
              {[...overflow, ...extra.slice(0, 3)].map((c) => (
                <li key={c.href}>
                  <Link href={c.href} className="block px-3 py-1.5 text-sm font-medium no-underline hover:bg-paper2">
                    {c.label}
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        </ul>
      </nav>
    </header>
  );
}
