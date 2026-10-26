import Link from "next/link";
import type { Locale } from "@/lib/shared/i18n";

/** Original emblem: a rising sun over an open book. Replaceable via site settings (logo media). */
export function Emblem({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="" className="text-brand shrink-0">
      <circle cx="32" cy="32" r="30" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M32 9v6M17.5 15.5l4 4M46.5 15.5l-4 4M10 28h6M54 28h-6" />
      </g>
      <path d="M22 30a10 10 0 0 1 20 0z" fill="var(--accent)" />
      <path d="M10 36c8-3 15-1 22 4 7-5 14-7 22-4v14c-8-3-15-1-22 4-7-5-14-7-22-4z" fill="currentColor" />
      <path d="M32 40v14" stroke="var(--paper)" strokeWidth="1.8" />
    </svg>
  );
}

export function Masthead({ lang, name, logoSrc, compact = false }: { lang: Locale; name: { ta?: string | null; en?: string | null }; logoSrc?: string; compact?: boolean }) {
  const label = name[lang] || name.en || name.ta || "Dina Idhigai";
  return (
    <Link href={`/${lang}`} className="logo-link inline-flex items-center justify-center no-underline" aria-label={label}>
      {/* Default: the client's masthead logo in /public/logo.png; an admin-uploaded logo (settings) overrides it. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logoSrc ?? "/logo.png"} alt={label} width={2400} height={672} className={`logo-img w-auto ${compact ? "h-9" : "h-14 sm:h-[4.5rem] md:h-20"}`} fetchPriority="high" />
    </Link>
  );
}
