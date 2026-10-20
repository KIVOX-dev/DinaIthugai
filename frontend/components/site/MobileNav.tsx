"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/shared/i18n";

export type NavItem = { href: string; label: string; children?: { href: string; label: string }[] };

/** Slide-down mobile menu with focus management and Escape-to-close. */
export function MobileNav({ lang, items, labels, extra }: { lang: Locale; items: NavItem[]; labels: { menu: string; close: string }; extra: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btn.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    panel.current?.querySelector<HTMLElement>("a")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <div className="md:hidden">
      <button
        ref={btn}
        type="button"
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? labels.close : labels.menu}
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-10 items-center justify-center rounded border border-rule"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          {open ? <path d="M4 4l12 12M16 4 4 16" /> : <path d="M3 5h14M3 10h14M3 15h14" />}
        </svg>
      </button>
      {open && (
        <div ref={panel} id="mobile-menu" data-testid="mobile-menu" className="absolute left-0 right-0 top-full z-40 max-h-[75vh] overflow-y-auto border-b-2 border-brand bg-paper shadow-lg">
          <ul className="mx-auto max-w-7xl px-4 py-2">
            {items.map((it) => (
              <li key={it.href} className="border-b border-rule last:border-0">
                <Link href={it.href} onClick={() => setOpen(false)} className="block py-3 font-bold no-underline">
                  {it.label}
                </Link>
                {it.children && it.children.length > 0 && (
                  <ul className="mb-2 grid grid-cols-2 gap-x-4 pl-3">
                    {it.children.map((c) => (
                      <li key={c.href}>
                        <Link href={c.href} onClick={() => setOpen(false)} className="block py-1.5 text-sm text-ink2 no-underline">
                          {c.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
            {extra.map((it) => (
              <li key={it.href} className="border-b border-rule last:border-0">
                <Link href={it.href} onClick={() => setOpen(false)} className="block py-3 text-ink2 no-underline">
                  {it.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <span className="sr-only">{lang}</span>
    </div>
  );
}
