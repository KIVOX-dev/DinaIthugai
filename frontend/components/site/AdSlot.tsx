import type { Locale } from "@/shared/i18n";
import { makeT } from "@/frontend/i18n/dictionary";

type Ad = { id: string; src: string; href: string; alt: string };

/** Image-only ads managed from the admin dashboard (no raw HTML, so ads cannot inject script). */
export function AdSlot({ ads, lang, className = "" }: { ads?: Ad[]; lang: Locale; className?: string }) {
  if (!ads?.length) return null;
  const ad = ads[Math.floor((Date.now() / 60000) % ads.length)];
  return (
    <aside aria-label={makeT(lang)("ad.label")} className={className}>
      <p className="mb-0.5 text-center text-[10px] uppercase tracking-widest text-ink3">{makeT(lang)("ad.label")}</p>
      <a href={ad.href} rel="sponsored noopener noreferrer" target="_blank">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ad.src} alt={ad.alt} loading="lazy" className="mx-auto max-h-32 w-full object-contain" />
      </a>
    </aside>
  );
}
