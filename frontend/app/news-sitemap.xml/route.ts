import { SITE, articleUrl, getSitemapData, xml, xmlEscape } from "@/lib/feeds";

export const dynamic = "force-dynamic";

/** Google News sitemap: articles published in the last 48 hours. */
export async function GET() {
  const d = await getSitemapData();
  const cutoff = Date.now() - 48 * 3600_000;
  const rows: string[] = [];
  for (const a of d.articles) {
    if (!a.publishedAt || new Date(a.publishedAt).getTime() < cutoff) continue;
    for (const l of ["ta", "en"] as const) {
      const slug = a.slug[l];
      const title = a.title[l];
      if (!a.languages[l] || !slug || !title) continue;
      rows.push(
        `<url><loc>${xmlEscape(articleUrl(l, slug))}</loc><news:news><news:publication><news:name>Dina Idhigai</news:name><news:language>${l}</news:language></news:publication><news:publication_date>${new Date(a.publishedAt).toISOString()}</news:publication_date><news:title>${xmlEscape(title)}</news:title></news:news></url>`,
      );
    }
  }
  void SITE;
  return xml(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">${rows.join("")}</urlset>`);
}
