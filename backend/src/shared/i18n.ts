export const LOCALES = ["ta", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ta";

export const isLocale = (v: string): v is Locale => (LOCALES as readonly string[]).includes(v);
export const otherLocale = (l: Locale): Locale => (l === "ta" ? "en" : "ta");

export type Localized<T = string> = { ta?: T; en?: T };

/** Pick a localized value, optionally falling back to the other language. */
export function pick<T>(v: Localized<T> | undefined | null, l: Locale, fallback = false): T | undefined {
  if (!v) return undefined;
  const primary = v[l];
  if (primary !== undefined && primary !== null && (primary as unknown) !== "") return primary;
  return fallback ? v[otherLocale(l)] : undefined;
}
