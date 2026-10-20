"use client";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import type { Locale } from "@/lib/shared/i18n";
import { msg } from "@/lib/i18n/dictionary";

type Common = { id: string; label: ReactNode; lang: Locale; error?: string; hint?: ReactNode; optional?: string };

const base = "w-full rounded border border-rule bg-paper px-3 py-2.5 text-base text-ink placeholder:text-ink3 focus:border-brand";

function Wrap({ id, label, lang, error, hint, optional, children }: Common & { children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-bold">
        {label} {optional && <span className="font-normal text-ink3">({optional})</span>}
      </label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="mt-1 text-xs text-ink3">{hint}</p>}
      {error && (
        <p id={`${id}-err`} role="alert" className="mt-1 text-sm font-medium text-accent">
          {msg(lang, error)}
        </p>
      )}
    </div>
  );
}
const aria = (id: string, error?: string, hint?: ReactNode) => ({ "aria-invalid": error ? true : undefined, "aria-describedby": error ? `${id}-err` : hint ? `${id}-hint` : undefined });

export function TextField({ id, label, lang, error, hint, optional, ...rest }: Common & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Wrap {...{ id, label, lang, error, hint, optional }}>
      <input id={id} name={id} className={base} {...aria(id, error, hint)} {...rest} />
    </Wrap>
  );
}

export function SelectField({ id, label, lang, error, hint, optional, children, ...rest }: Common & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Wrap {...{ id, label, lang, error, hint, optional }}>
      <select id={id} name={id} className={base} {...aria(id, error, hint)} {...rest}>
        {children}
      </select>
    </Wrap>
  );
}

export function TextArea({ id, label, lang, error, hint, optional, ...rest }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Wrap {...{ id, label, lang, error, hint, optional }}>
      <textarea id={id} name={id} className={base} {...aria(id, error, hint)} {...rest} />
    </Wrap>
  );
}

export function FormAlert({ kind = "error", children }: { kind?: "error" | "ok"; children: ReactNode }) {
  return (
    <p role={kind === "error" ? "alert" : "status"} className={`rounded border px-3 py-2 text-sm ${kind === "error" ? "border-accent bg-accent/10 text-accent" : "border-ok bg-ok/10 text-ok"}`}>
      {children}
    </p>
  );
}

export const buttonPrimary = "rounded bg-brand px-5 py-2.5 font-bold text-brand-ink hover:opacity-90 disabled:opacity-60";
