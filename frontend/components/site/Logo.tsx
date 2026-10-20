import Link from "next/link";
import type { Locale } from "@/shared/i18n";

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
  const parts = label.split(" ");
  return (
    <Link href={`/${lang}`} className="inline-flex items-center justify-center gap-3 no-underline" aria-label={label}>
      {logoSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoSrc} alt={label} className={compact ? "h-10 w-auto" : "h-16 w-auto sm:h-20"} />
      ) : (
        <>
          <span className={`headline text-brand ${compact ? "text-3xl" : "text-5xl sm:text-6xl md:text-7xl"} leading-none`} style={{ letterSpacing: 0 }}>
            {parts[0]}
          </span>
          {!compact && <Emblem size={64} />}
          {parts.length > 1 && (
            <span className={`headline text-brand ${compact ? "text-3xl" : "text-5xl sm:text-6xl md:text-7xl"} leading-none`}>{parts.slice(1).join(" ")}</span>
          )}
        </>
      )}
    </Link>
  );
}
