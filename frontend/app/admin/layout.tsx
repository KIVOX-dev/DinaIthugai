import type { Metadata } from "next";
import Link from "next/link";
import "../globals.css";
import { fontVars } from "@/lib/fonts";
import { requireStaffPage } from "@/lib/admin";
import { can } from "@/lib/shared/permissions";
import type { Permission } from "@/lib/shared/permissions";
import { LogoutButton } from "@/components/site/LogoutButton";

export const metadata: Metadata = { title: { default: "Newsroom", template: "%s · Newsroom" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const NAV: { href: string; label: string; perm?: Permission }[] = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/articles", label: "Articles" },
  { href: "/admin/review", label: "Review queue", perm: "articles.review" },
  { href: "/admin/articles/new", label: "New article", perm: "articles.create" },
  { href: "/admin/media", label: "Media", perm: "media.manage" },
  { href: "/admin/categories", label: "Categories", perm: "categories.manage" },
  { href: "/admin/users", label: "Users", perm: "users.view" },
  { href: "/admin/settings", label: "Settings & ads", perm: "settings.manage" },
  { href: "/admin/audit", label: "Audit log", perm: "audit.view" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaffPage("/admin");
  const items = NAV.filter((n) => !n.perm || can(user, n.perm)); // hiding is cosmetic; the API enforces permissions
  return (
    <html lang="en" className={fontVars}>
      <body className="bg-paper2">
        <div className="min-h-screen lg:grid lg:grid-cols-[15rem_1fr]">
          <aside className="border-b border-rule bg-paper lg:min-h-screen lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between px-4 py-3">
              <Link href="/admin" className="flex flex-col gap-1 no-underline" aria-label="Dina Idhigai newsroom">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="தின இதிகை" width={2400} height={672} className="logo-img h-10 w-auto self-start" />
                <span className="text-xs font-bold uppercase tracking-widest text-ink3">Newsroom</span>
              </Link>
            </div>
            <nav aria-label="Admin" className="no-scrollbar flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-col lg:overflow-visible lg:pb-4">
              {items.map((n) => (
                <Link key={n.href} href={n.href} className="whitespace-nowrap rounded px-3 py-2 text-sm font-medium no-underline hover:bg-paper2">
                  {n.label}
                </Link>
              ))}
            </nav>
          </aside>
          <div className="min-w-0">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-rule bg-paper px-4 py-2 text-sm">
              <Link href="/ta" className="text-brand">
                ← View site
              </Link>
              <div className="flex items-center gap-3">
                <span>
                  {user.name} <span className="rounded bg-paper2 px-1.5 py-0.5 text-xs text-ink2">{user.role.replace("_", " ")}</span>
                </span>
                <LogoutButton lang="en" label="Sign out" />
              </div>
            </header>
            <main className="p-4 sm:p-6">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
