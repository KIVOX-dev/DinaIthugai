/**
 * Imports Dinamalar's Coimbatore district news (with the story photo) into the newspaper.
 * Used with Dinamalar's permission for the Coimbatore section only — keep SECTIONS limited to what has been agreed.
 * The original URL is kept in a hidden field (importedFrom) only to avoid importing a story twice.
 */
import { connectDB } from "../db";
import { env } from "../env";
import { Article, Category, MediaAsset, User } from "../models";
import { invalidatePublic } from "../articles/cache";
import { saveArticle, transitionArticle } from "../articles/service";
import { removeAssetObjects, uploadImage } from "../services/media";
import { toPrincipal } from "../services/auth";
import { wordCount } from "../text";
import { paraphraseNews } from "../ai/rewrite";

const ORIGIN = "https://www.dinamalar.com";
const UA = "DinaIdhigaiBot/1.0 (+licensed Coimbatore news import)";
const BYLINE = "தின இதிகை செய்திக் குழு";

/** Dinamalar listing path -> our category slug. */
export const SECTIONS: { path: string; category: string; name: { ta: string; en: string }; parent?: string }[] = [
  { path: "/news/tamil-nadu-district-news-coimbatore", category: "coimbatore", name: { ta: "கோவை", en: "Coimbatore" }, parent: "tamil-nadu" },
  { path: "/news/tamil-nadu-district-news-nilgiris", category: "nilgiris", name: { ta: "நீலகிரி", en: "Nilgiris" }, parent: "tamil-nadu" },
  { path: "/news/tamil-nadu-district-news-tiruppur", category: "tiruppur", name: { ta: "திருப்பூர்", en: "Tiruppur" }, parent: "tamil-nadu" },
  { path: "/news/tamil-nadu-district-news-erode", category: "erode", name: { ta: "ஈரோடு", en: "Erode" }, parent: "tamil-nadu" },
  { path: "/news/tamil-nadu-district-news-chennai", category: "chennai", name: { ta: "சென்னை", en: "Chennai" }, parent: "tamil-nadu" },
  { path: "/news/tamil-nadu-news", category: "tamil-nadu", name: { ta: "தமிழ்நாடு", en: "Tamil Nadu" } },
  // Not enabled by default: add the slug to DINAMALAR_SECTIONS once the partner has agreed to the section.
  { path: "/news/india-tamil-news", category: "india", name: { ta: "இந்தியா", en: "India" } },
  { path: "/news/world-tamil-news", category: "world", name: { ta: "உலகம்", en: "World" } },
  { path: "/news/business", category: "business", name: { ta: "வணிகம்", en: "Business" } },
  { path: "/news/sports", category: "sports", name: { ta: "விளையாட்டு", en: "Sports" } },
  { path: "/news/kalvimalar-news", category: "education", name: { ta: "கல்வி", en: "Education" } },
];

/** Dinamalar has no politics section: Tamil Nadu stories about parties, ministers, elections etc. go to our Politics category. */
const POLITICS = /முதல்வர்|அமைச்சர்|துணை முதல்|திமுக|தி\.மு\.க|அதிமுக|அ\.தி\.மு\.க|பா\.ஜ|பாஜ|காங்கிரஸ்|தவெக|த\.வெ\.க|நாம் தமிழர்|பா\.ம\.க|பாமக|விசிக|கம்யூனிஸ்ட்|எம்\.எல்\.ஏ|எம்\.பி\.|சட்டசபை|சட்டப்பேரவை|தேர்தல்|அரசியல்|கட்சி|ஸ்டாலின்|உதயநிதி|பழனிசாமி|அண்ணாமலை|விஜய்|சீமான்|ஆளுநர்|கவர்னர்|எதிர்க்கட்சி|சபாநாயகர்/;

/** Only sections listed in DINAMALAR_SECTIONS run; everything else stays off until the partner has agreed to it. */
const licensed = () => new Set(env().DINAMALAR_SECTIONS.split(",").map((s) => s.trim()).filter(Boolean));

async function ensureCategory(s: (typeof SECTIONS)[number]) {
  const found = await Category.findOne({ slug: s.category });
  if (found) return found;
  const parent = s.parent ? await Category.findOne({ slug: s.parent }) : null;
  return Category.create({ slug: s.category, name: s.name, order: 50, showInNav: !s.parent, parent: parent?._id ?? null });
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decode = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const clean = (s: string) => decode(s.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();

async function get(url: string): Promise<Response> {
  const res = await fetch(url, { headers: { "user-agent": UA, accept: "text/html,*/*", "accept-language": "ta,en;q=0.5" }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res;
}

export type Story = { url: string; id: string; title: string; paragraphs: string[]; imageUrl?: string; publishedAt?: Date };

export function parseListing(html: string, path: string): string[] {
  // Sections such as business or sports list stories under sub-sections (/news/business-banking-and-finance/...),
  // so accept any path that starts with the section path. Newest stories (highest id) first.
  const re = new RegExp(`href="(${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[a-z0-9-]*/[^"#?]+/\\d+)"`, "g");
  const links = [...new Set([...html.matchAll(re)].map((m) => m[1]))];
  return links.sort((a, b) => Number(b.match(/(\d+)$/)?.[1]) - Number(a.match(/(\d+)$/)?.[1]));
}

export function parseStory(html: string, url: string): Story | null {
  const meta = (p: string) => html.match(new RegExp(`<meta property="${p}" content="([^"]*)"`))?.[1];
  const title = clean(meta("og:title") ?? "");
  const paragraphs = [...html.matchAll(/<p class="[^"]*allow-copy[^"]*">([\s\S]*?)<\/p>/g)].map((m) => clean(m[1])).filter(Boolean);
  const id = url.match(/\/(\d+)$/)?.[1];
  if (!title || !id || !paragraphs.length) return null;
  const date = html.match(/"publisheddate":"([^"]+)"/)?.[1];
  const image = meta("og:image")?.replace(/\?.*$/, "");
  return { url, id, title, paragraphs, imageUrl: image, publishedAt: date ? new Date(date) : undefined };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type ImportResult = { checked: number; imported: number; skipped: number; failed: number; errors: string[] };

let running = false;

export async function importDinamalar(opts: { limit?: number; publish?: boolean } = {}): Promise<ImportResult> {
  if (running) return { checked: 0, imported: 0, skipped: 0, failed: 0, errors: ["an import is already running"] };
  running = true;
  try {
    return await runImport(opts);
  } finally {
    running = false;
  }
}

async function runImport(opts: { limit?: number; publish?: boolean }): Promise<ImportResult> {
  await connectDB();
  const limit = opts.limit ?? 10;
  const publish = opts.publish ?? true;
  const adminDoc = await User.findOne({ role: "admin", accountStatus: "active" }).sort({ createdAt: 1 });
  if (!adminDoc) throw new Error("No active admin account to attribute imported articles to.");
  const actor = toPrincipal(adminDoc);
  const result: ImportResult = { checked: 0, imported: 0, skipped: 0, failed: 0, errors: [] };

  const allowed = licensed();
  for (const section of SECTIONS.filter((s) => allowed.has(s.category))) {
    const cat = await ensureCategory(section);
    const links = parseListing(await (await get(ORIGIN + section.path)).text(), section.path);
    let imported = 0; // `limit` applies per section so every district gets its share
    for (const link of links) {
      if (imported >= limit) break;
      result.checked++;
      const url = ORIGIN + link;
      try {
        if (await Article.exists({ "importedFrom.url": url })) {
          result.skipped++;
          continue;
        }
        await sleep(800); // be gentle with their servers
        const story = parseStory(await (await get(url)).text(), url);
        if (!story) {
          result.failed++;
          continue;
        }
        let featuredImage: string | undefined;
        if (story.imageUrl) {
          try {
            const buf = Buffer.from(await (await get(`${story.imageUrl}?im=Resize,width=1600`)).arrayBuffer());
            const media = await uploadImage(actor, { buffer: buf, name: `dinamalar-${story.id}.jpg` }, { alt: { ta: story.title } }, { skipRateLimit: true }); // trusted server-side import
            featuredImage = media.id;
            await MediaAsset.updateOne({ _id: media.id }, { $set: { origin: "dinamalar" } });
          } catch (e) {
            result.errors.push(`image ${story.id}: ${(e as Error).message}`);
          }
        }
        if (!featuredImage) {
          result.skipped++; // every story on the site carries a photo
          continue;
        }
        // Lightly reword with AI (same facts, similar words). If the AI is unavailable or alters facts, keep the
        // original text but save it as a draft for an editor instead of publishing it unchanged.
        let { title, paragraphs } = story;
        let reworded = false;
        for (let attempt = 1; attempt <= 2 && !reworded; attempt++) {
          try {
            const r = await paraphraseNews(story.title, story.paragraphs);
            title = r.title;
            paragraphs = r.paragraphs;
            reworded = true;
          } catch (e) {
            if (attempt === 2) result.errors.push(`ai ${story.id}: ${(e as Error).message}`);
          }
        }
        const storyCat =
          section.category === "tamil-nadu" && POLITICS.test(`${title} ${paragraphs[0] ?? ""}`)
            ? await ensureCategory({ path: "", category: "politics", name: { ta: "அரசியல்", en: "Politics" } })
            : cat;
        const body = paragraphs.map((p) => `<p>${esc(p)}</p>`).join("");
        const saved = await saveArticle(actor, null, {
          title: { ta: title, en: "" },
          subtitle: { ta: "", en: "" },
          excerpt: { ta: paragraphs[0].slice(0, 280), en: "" },
          body: { ta: body, en: "" },
          preferredLanguage: "ta",
          category: String(storyCat._id),
          location: section.name.ta,
          featuredImage,
          featuredCaption: { ta: "", en: "" },
          authorName: BYLINE,
          authorId: String(adminDoc._id),
        });
        try {
          await Article.updateOne({ _id: saved.id }, { $set: { "importedFrom.url": url } });
        } catch (e) {
          if ((e as { code?: number }).code === 11000) {
            // another run imported this story first: drop our copy (and its photo)
            await Article.deleteOne({ _id: saved.id });
            if (featuredImage) {
              const m = await MediaAsset.findById(featuredImage);
              if (m) {
                await removeAssetObjects(m);
                await MediaAsset.deleteOne({ _id: m._id });
              }
            }
            result.skipped++;
            continue;
          }
          throw e;
        }
        if (publish && reworded && wordCount(body) > 0) {
          await transitionArticle(actor, saved.id, "published");
          if (story.publishedAt && !isNaN(+story.publishedAt)) await Article.updateOne({ _id: saved.id }, { $set: { publishedAt: story.publishedAt } });
        }
        result.imported++;
        imported++;
      } catch (e) {
        result.failed++;
        result.errors.push(`${link}: ${(e as Error).message}`);
      }
    }
  }
  return result;
}

/** How long imported Dinamalar photos are kept in storage. Admin-uploaded images are never touched. */
export const IMPORTED_MEDIA_DAYS = 10;

/**
 * Deletes imported Dinamalar photos older than IMPORTED_MEDIA_DAYS from storage (Backblaze) and detaches them from their
 * articles. The article text stays; only the photo goes. Safe to run repeatedly.
 */
export async function purgeImportedMedia(days = IMPORTED_MEDIA_DAYS) {
  await connectDB();
  // one-time backfill for images imported before the `origin` flag existed
  await MediaAsset.updateMany({ origin: { $exists: false }, originalName: /^dinamalar-\d+\.jpg$/ }, { $set: { origin: "dinamalar" } });
  const cutoff = new Date(Date.now() - days * 86_400_000);
  const old = await MediaAsset.find({ origin: "dinamalar", createdAt: { $lt: cutoff } }).limit(200);
  let removed = 0;
  for (const m of old) {
    await Article.updateMany({ $or: [{ featuredImage: m._id }, { media: m._id }] }, { $unset: { featuredImage: 1, featuredCredit: 1 }, $pull: { media: m._id } });
    await removeAssetObjects(m);
    await MediaAsset.deleteOne({ _id: m._id });
    removed++;
  }
  if (removed) await invalidatePublic();
  return { removed };
}
