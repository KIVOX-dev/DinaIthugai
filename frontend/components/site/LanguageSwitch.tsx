"use client";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Locale } from "@/shared/i18n";

/** தமிழ் | English toggle. Swaps the locale prefix, keeping path and query; localized slugs are canonicalised by the target page. */
export function LanguageSwitch({ lang, label }: { lang: Locale; label: string }) {
  const pathname = usePathname() || `/${lang}`;
  const qs = useSearchParams().toString();
  const rest = pathname.replace(/^\/(ta|en)(?=\/|$)/, "");
  const href = (l: Locale) => `/${l}${rest}${qs ? `?${qs}` : ""}`;
  return (
    <nav aria-label={label} className="flex items-center overflow-hidden rounded border border-rule text-sm font-bold">
      {(["ta", "en"] as const).map((l) => (
        <Link
          key={l}
          href={href(l)}
          hrefLang={l}
          lang={l}
          aria-current={l === lang ? "true" : undefined}
          prefetch={false}
          className={`px-3 py-1 no-underline ${l === lang ? "bg-brand text-brand-ink" : "hover:bg-paper2"}`}
        >
          {l === "ta" ? "தமிழ்" : "English"}
        </Link>
      ))}
    </nav>
  );
}
