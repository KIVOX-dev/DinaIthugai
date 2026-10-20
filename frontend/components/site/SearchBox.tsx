"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/shared/i18n";

/** Debounced search input. Submitting (or pausing) navigates to /{lang}/search?q= so filters live in the URL. */
export function SearchBox({ lang, placeholder, label, initial = "", live = false }: { lang: Locale; placeholder: string; label: string; initial?: string; live?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  const first = useRef(true);
  useEffect(() => {
    if (!live) return;
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      const p = new URLSearchParams(window.location.search);
      if (q.trim()) p.set("q", q.trim());
      else p.delete("q");
      p.delete("page");
      router.replace(`/${lang}/search?${p.toString()}`);
    }, 350);
    return () => clearTimeout(t);
  }, [q, live, lang, router]);
  return (
    <form
      role="search"
      action={`/${lang}/search`}
      onSubmit={(e) => {
        e.preventDefault();
        const p = new URLSearchParams(live ? window.location.search : "");
        if (q.trim()) p.set("q", q.trim());
        p.delete("page");
        router.push(`/${lang}/search?${p.toString()}`);
      }}
      className="flex w-full"
    >
      <label className="sr-only" htmlFor={live ? "q-live" : "q-hdr"}>
        {label}
      </label>
      <input
        id={live ? "q-live" : "q-hdr"}
        name="q"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        maxLength={120}
        className="min-w-0 flex-1 rounded-l border border-r-0 border-rule bg-paper px-3 py-1.5 text-sm"
      />
      <button type="submit" className="rounded-r bg-brand px-3 text-sm font-bold text-brand-ink" aria-label={label}>
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
          <circle cx="8.5" cy="8.5" r="6" />
          <path d="m13 13 5 5" strokeLinecap="round" />
        </svg>
      </button>
    </form>
  );
}
