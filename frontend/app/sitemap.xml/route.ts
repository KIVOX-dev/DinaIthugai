import { SITE, articleUrl, getSitemapData, xml, xmlEscape } from "@/lib/feeds";
import { STATIC_SLUGS } from "@/lib/i18n/pages";

export const dynamic = "force-dynamic";

const alt = (pairs: [string, string][]) => pairs.map(([l, u]) => `<xhtml:link rel="alternate" hreflang="${l}" href="${xmlEscape(u)}"/>`).join("");

/** Only publicly visible content is listed: the API returns published (or due) articles only. */
export async function GET() {
  const d = await getSitemapData();
  const urls: string[] = [];
  const add = (loc: string, alternates: [string, string][], lastmod?: string, freq?: string) =>
    urls.push(`<url><loc>${xmlEscape(loc)}</loc>${lastmod ? `<lastmod>${new Date(lastmod).toISOString()}</lastmod>` : ""}${freq ? `<changefreq>${freq}</changefreq>` : ""}${alt(alternates)}</url>`);

  for (const l of ["ta"] as const) add(`${SITE}/${l}`, [["ta", `${SITE}/ta`]], undefined, "hourly");
  for (const c of d.categories) for (const l of ["ta"] as const) add(`${SITE}/${l}/${c}`, [["ta", `${SITE}/ta/${c}`]], undefined, "hourly");
  for (const p of STATIC_SLUGS) for (const l of ["ta"] as const) add(`${SITE}/${l}/${p}`, [["ta", `${SITE}/ta/${p}`]], undefined, "yearly");
  for (const a of d.articles) {
    const pairs: [string, string][] = [];
    if (a.languages.ta && a.slug.ta) pairs.push(["ta", articleUrl("ta", a.slug.ta)]);
    if (a.languages.en && a.slug.en) pairs.push(["en", articleUrl("en", a.slug.en)]);
    for (const [, u] of pairs) add(u, pairs, a.updatedAt);
  }
  return xml(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls.join("")}</urlset>`);
}

