import "server-only";
import { apiGet } from "./api";

export const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export const xmlEscape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

export type SitemapData = {
  categories: string[];
  articles: { id: string; slug: { ta?: string; en?: string }; title: { ta?: string; en?: string }; languages: { ta?: boolean; en?: boolean }; updatedAt: string; publishedAt?: string }[];
};

export const getSitemapData = () => apiGet<SitemapData>("/public/sitemap");

export const articleUrl = (lang: "ta" | "en", slug: string) => `${SITE}/${lang}/news/${encodeURIComponent(slug)}`;

export const xml = (body: string, type = "application/xml") =>
  new Response(body, { headers: { "Content-Type": `${type}; charset=utf-8`, "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } });
