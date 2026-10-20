"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type NavItem = { href: string; label: string; children?: { href: string; label: string }[] };

/** Hamburger + left slide-out drawer (all screen sizes) with focus management and Escape-to-close. */
export function MenuDrawer({ items, extra, labels }: { items: NavItem[]; extra: NavItem[]; labels: { menu: string; close: string; sections: string } }) {
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
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLElement>("a,button")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);
  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-expanded={open}
        aria-controls="site-drawer"
        aria-label={labels.menu}
        data-testid="menu-button"
        onClick={() => setOpen(true)}
        className="flex h-11 w-11 shrink-0 items-center justify-center text-white hover:bg-white/10"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
      </button>
      {open && (
        <div className="fixed inset-0 z-50" data-testid="mobile-menu">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} aria-hidden="true" />
          <div ref={panel} id="site-drawer" role="dialog" aria-modal="true" aria-label={labels.menu} className="absolute left-0 top-0 h-full w-[88%] max-w-sm overflow-y-auto bg-paper shadow-2xl">
            <div className="flex items-center justify-between border-b border-rule px-4 py-3">
              <span className="headline text-lg">{labels.sections}</span>
              <button type="button" onClick={() => setOpen(false)} aria-label={labels.close} className="flex h-9 w-9 items-center justify-center rounded border border-rule">
                <svg width="18" height="18" viewBox="0 0 20 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M4 4l12 12M16 4 4 16" />
                </svg>
              </button>
            </div>
            <ul className="px-4 py-2">
              {items.map((it) => (
                <li key={it.href} className="border-b border-rule">
                  <Link href={it.href} onClick={() => setOpen(false)} className="headline block py-3 text-lg no-underline">
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
        </div>
      )}
    </>
  );
}
