"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LogoutButton } from "./LogoutButton";

export type ProfileUser = { name: string; email: string; staff: boolean };
export type ProfileLabels = { login: string; register: string; account: string; submissions: string; notifications: string; admin: string; logout: string; profile: string };

export const initialOf = (name: string) => Array.from(name.trim())[0]?.toUpperCase() ?? "?";

/** Account links shared by the avatar dropdown and the side menu. */
export function ProfileLinks({ lang, user, labels, onNavigate }: { lang: string; user: ProfileUser; labels: ProfileLabels; onNavigate?: () => void }) {
  const row = "block rounded px-3 py-2 text-[15px] no-underline hover:bg-paper2";
  return (
    <ul>
      <li>
        <Link href={`/${lang}/account`} onClick={onNavigate} className={row}>
          {labels.account}
        </Link>
      </li>
      <li>
        <Link href={`/${lang}/account/submissions`} onClick={onNavigate} className={row}>
          {labels.submissions}
        </Link>
      </li>
      <li>
        <Link href={`/${lang}/account/notifications`} onClick={onNavigate} className={row}>
          {labels.notifications}
        </Link>
      </li>
      {user.staff && (
        <li>
          <Link href="/admin" onClick={onNavigate} className={`${row} font-bold text-brand`}>
            {labels.admin}
          </Link>
        </li>
      )}
      <li className="mt-1 border-t border-rule pt-1">
        <span className={`${row} cursor-pointer text-accent`}>
          <LogoutButton lang={lang} label={labels.logout} />
        </span>
      </li>
    </ul>
  );
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <span aria-hidden="true" className="headline flex shrink-0 items-center justify-center rounded-full bg-brand text-brand-ink" style={{ width: size, height: size, fontSize: size * 0.5 }}>
      {initialOf(name)}
    </span>
  );
}

/** Round avatar button (top right) opening an account dropdown, like a normal app. Guests get a person icon with sign-in links. */
export function ProfileMenu({ lang, user, labels }: { lang: string; user: ProfileUser | null; labels: ProfileLabels }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const close = () => setOpen(false);
  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={user ? `${labels.profile}: ${user.name}` : labels.login}
        data-testid="profile-button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-10 items-center justify-center rounded-full ring-1 ring-rule hover:ring-brand"
      >
        {user ? (
          <Avatar name={user.name} />
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
          </svg>
        )}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-40 mt-2 w-64 rounded-lg border border-rule bg-paper p-2 text-ink shadow-xl">
          {user ? (
            <>
              <div className="flex items-center gap-3 border-b border-rule px-3 pb-3 pt-2">
                <Avatar name={user.name} size={44} />
                <div className="min-w-0">
                  <p className="headline truncate text-base">{user.name}</p>
                  <p className="truncate text-xs text-ink3">{user.email}</p>
                </div>
              </div>
              <ProfileLinks lang={lang} user={user} labels={labels} onNavigate={close} />
            </>
          ) : (
            <ul>
              <li>
                <Link href={`/${lang}/login`} onClick={close} className="block rounded px-3 py-2 font-bold no-underline hover:bg-paper2">
                  {labels.login}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/register`} onClick={close} className="block rounded px-3 py-2 no-underline hover:bg-paper2">
                  {labels.register}
                </Link>
              </li>
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
