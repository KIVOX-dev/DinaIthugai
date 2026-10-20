import { notFound } from "next/navigation";
import { apiGet } from "@/lib/api";
import { SITE, articleUrl, xml, xmlEscape } from "@/lib/feeds";

export const dynamic = "force-dynamic";

type Item = { slug?: string; title?: string; excerpt?: string; publishedAt?: string; category?: string; author?: string };

/** /rss/ta.xml and /rss/en.xml; optional ?category=slug. */
export async function GET(req: Request, ctx: { params: Promise<{ file: string }> }) {
  const { file } = await ctx.params;
  const m = /^(ta|en)\.xml$/.exec(file);
  if (!m) notFound();
  const lang = m[1] as "ta" | "en";
  const category = new URL(req.url).searchParams.get("category") ?? undefined;
  const { items } = await apiGet<{ items: Item[] }>("/public/feed", { lang, category });
  const name = lang === "ta" ? "தின இதிகை" : "Dina Idhigai";
  const body = items
    .filter((i) => i.slug && i.title)
    .map(
      (i) =>
        `<item><title>${xmlEscape(i.title!)}</title><link>${xmlEscape(articleUrl(lang, i.slug!))}</link><guid isPermaLink="true">${xmlEscape(articleUrl(lang, i.slug!))}</guid>${i.publishedAt ? `<pubDate>${new Date(i.publishedAt).toUTCString()}</pubDate>` : ""}${i.category ? `<category>${xmlEscape(i.category)}</category>` : ""}${i.author ? `<dc:creator>${xmlEscape(i.author)}</dc:creator>` : ""}<description>${xmlEscape(i.excerpt ?? "")}</description></item>`,
    )
    .join("");
  return xml(
    `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>${xmlEscape(name)}</title><link>${SITE}/${lang}</link><description>${xmlEscape(name)}</description><language>${lang}</language>${body}</channel></rss>`,
    "application/rss+xml",
  );
}
