import sanitizeHtml from "sanitize-html";

/** Matches only our own media delivery URLs. */
export const MEDIA_SRC_RE = /^\/api\/media\/([a-f0-9]{24})\/(thumb|sm|md|lg|orig)$/;

const BODY_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["p", "br", "hr", "h2", "h3", "h4", "ul", "ol", "li", "blockquote", "strong", "b", "em", "i", "u", "s", "a", "img", "figure", "figcaption", "code", "pre"],
  allowedAttributes: {
    a: ["href", "title", "rel", "target"],
    img: ["src", "alt", "title", "width", "height", "data-media-id"],
    figure: ["class"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesAppliedToAttributes: ["href"],
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, rel: "noopener noreferrer nofollow ugc", ...(attribs.target ? { target: "_blank" } : {}) },
    }),
  },
  exclusiveFilter: (frame) => {
    // Images are only allowed if they point to our own media endpoint (no remote/tracking/data: URLs).
    if (frame.tag === "img") return !MEDIA_SRC_RE.test(frame.attribs.src ?? "");
    return false;
  },
};

export function sanitizeBody(html: string | undefined | null): string {
  return sanitizeHtml(html ?? "", BODY_OPTIONS).trim();
}

/** Strip every tag: used for titles, excerpts, notes etc. */
export function plain(input: string | undefined | null): string {
  return sanitizeHtml(input ?? "", { allowedTags: [], allowedAttributes: {} })
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function htmlToText(html: string | undefined | null): string {
  const spaced = (html ?? "").replace(/<\/(p|h[1-6]|li|blockquote|figure|figcaption)>|<br\s*\/?>/gi, " ");
  return plain(spaced);
}

export function wordCount(html: string | undefined | null): number {
  const t = htmlToText(html);
  return t ? t.split(/\s+/).length : 0;
}

export function readingMinutes(html: string | undefined | null): number {
  return Math.max(1, Math.round(wordCount(html) / 200));
}

export function mediaIdsInBody(html: string | undefined | null): string[] {
  const ids = new Set<string>();
  for (const m of (html ?? "").matchAll(/src="\/api\/media\/([a-f0-9]{24})\/[a-z]+"/g)) ids.add(m[1]);
  return [...ids];
}

/** Unicode-aware slug: keeps Tamil letters and combining marks, strips everything else. */
export function slugify(input: string, max = 80): string {
  const s = input
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  const cps = Array.from(s).slice(0, max).join("");
  return cps.replace(/-+$/g, "");
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function truncate(s: string, n: number): string {
  const cps = Array.from(s);
  return cps.length <= n ? s : cps.slice(0, n - 1).join("").trimEnd() + "…";
}
