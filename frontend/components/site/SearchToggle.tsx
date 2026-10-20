"use client";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/shared/i18n";
import { SearchBox } from "./SearchBox";

/** Magnifier icon at the right of the nav bar; opens an inline search field. */
export function SearchToggle({ lang, placeholder, label }: { lang: Locale; placeholder: string; label: string }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    wrap.current?.querySelector("input")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <div ref={wrap} className="relative flex shrink-0 items-center">
      {open && (
        <div className="absolute right-12 top-1/2 z-40 w-[min(78vw,22rem)] -translate-y-1/2 bg-paper p-1 text-ink shadow-lg">
          <SearchBox lang={lang} placeholder={placeholder} label={label} />
        </div>
      )}
      <button type="button" aria-label={label} aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex h-11 w-11 items-center justify-center text-white hover:bg-white/10">
        <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
          <circle cx="8.5" cy="8.5" r="6" />
          <path d="m13 13 5 5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
