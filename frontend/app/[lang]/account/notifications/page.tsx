import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/shared/i18n";
import { apiGet, requireUserPage } from "@/lib/api";
import { formatDate, makeT } from "@/lib/i18n/dictionary";
import { MarkAllRead } from "@/components/account/AccountClient";

type N = { id: string; title: { ta?: string; en?: string }; body?: { ta?: string; en?: string }; link?: string; read: boolean; at: string };
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Notifications", robots: { index: false } };

export default async function Notifications({ params }: PageProps<"/[lang]/account/notifications">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  await requireUserPage(lang, `/${lang}/account/notifications`);
  const d = await apiGet<{ unread: number; items: N[] }>("/auth/notifications");
  const t = makeT(lang);
  const pick = (v?: { ta?: string; en?: string }) => v?.[lang] || v?.en || v?.ta || "";
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="headline text-3xl">{t("nav.notifications")}</h1>
        {d.unread > 0 && <MarkAllRead lang={lang} />}
      </div>
      {d.items.length === 0 ? (
        <p className="mt-6 rounded border border-rule bg-paper2 p-8 text-center text-ink2">{t("account.notifications.none")}</p>
      ) : (
        <ul className="mt-5 divide-y divide-rule border-y border-rule">
          {d.items.map((n) => (
            <li key={n.id} className={`px-2 py-3 ${n.read ? "" : "bg-brand/5"}`}>
              <p className="font-bold">
                {!n.read && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-accent" aria-label="unread" />}
                {n.link ? (
                  <Link href={n.link} className="no-underline hover:underline">
                    {pick(n.title)}
                  </Link>
                ) : (
                  pick(n.title)
                )}
              </p>
              {pick(n.body) && <p className="text-sm text-ink2">{pick(n.body)}</p>}
              <p className="text-xs text-ink3">{formatDate(n.at, lang, true)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
