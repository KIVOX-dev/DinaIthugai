/**
 * Seeds FICTIONAL demo data: categories, demo staff accounts and sample articles.
 * Everything is clearly labelled "[DEMO]" / "@demo.invalid". Safe to re-run (it skips what exists).
 *   npm run seed
 */
import crypto from "node:crypto";
import mongoose from "mongoose";
import sharp from "sharp";
import { hashPassword } from "../src/auth/crypto";
import { connectDB } from "../src/db";
import { Article, Category, SiteSettings, Tag, User, ensureIndexes } from "../src/models";
import { saveArticle, transitionArticle } from "../src/articles/service";
import { uploadImage } from "../src/services/media";
import { toPrincipal } from "../src/services/auth";
import { getSettings } from "../src/services/settings";
import type { Role } from "../src/shared/permissions";

const CATS: { slug: string; ta: string; en: string; parent?: string; accent?: string }[] = [
  { slug: "tamil-nadu", ta: "தமிழ்நாடு", en: "Tamil Nadu", accent: "#c8281e" },
  { slug: "coimbatore", ta: "கோவை", en: "Coimbatore", parent: "tamil-nadu" },
  { slug: "chennai", ta: "சென்னை", en: "Chennai", parent: "tamil-nadu" },
  { slug: "madurai", ta: "மதுரை", en: "Madurai", parent: "tamil-nadu" },
  { slug: "india", ta: "இந்தியா", en: "India" },
  { slug: "world", ta: "உலகம்", en: "World" },
  { slug: "politics", ta: "அரசியல்", en: "Politics" },
  { slug: "business", ta: "வணிகம்", en: "Business" },
  { slug: "sports", ta: "விளையாட்டு", en: "Sports" },
  { slug: "cinema", ta: "சினிமா", en: "Cinema" },
  { slug: "education", ta: "கல்வி", en: "Education" },
  { slug: "health", ta: "ஆரோக்கியம்", en: "Health" },
  { slug: "spirituality", ta: "ஆன்மிகம்", en: "Spirituality" },
  { slug: "opinion", ta: "கருத்து", en: "Opinion" },
];

const COLORS = ["#1a2a9a", "#c8281e", "#17724a", "#9a6200", "#6a2a9a", "#0f6a7a", "#7a2a3a"];
async function demoImage(i: number, label: string) {
  const c = COLORS[i % COLORS.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="#101010"/></linearGradient></defs><rect width="1600" height="900" fill="url(#g)"/><circle cx="1250" cy="300" r="170" fill="#ffffff22"/><circle cx="400" cy="640" r="260" fill="#ffffff14"/><text x="80" y="820" font-family="sans-serif" font-size="46" fill="#ffffffcc">DEMO IMAGE · ${label}</text></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

const para = (s: string) => `<p>${s}</p>`;
const lorem = (n: number, ta: boolean) =>
  Array.from({ length: n }, (_, i) =>
    ta
      ? para(`இது ஒரு கற்பனையான செய்திக் கட்டுரையின் பத்தி ${i + 1}. இந்த உள்ளடக்கம் தளத்தின் வடிவமைப்பைக் காட்டுவதற்காக மட்டுமே உருவாக்கப்பட்டது; இதில் உள்ள பெயர்களும் நிகழ்வுகளும் உண்மையானவை அல்ல.`)
      : para(`This is paragraph ${i + 1} of a fictional demo story, written only to show the layout of the site. Names, places and events here are invented and do not describe real people or happenings.`),
  ).join("");

type Demo = { cat: string; ta?: string; en?: string; flags?: Partial<{ featured: boolean; breaking: boolean; trending: boolean; priority: number }> };
const STORIES: Demo[] = [
  { cat: "tamil-nadu", ta: "[டெமோ] மாநிலம் முழுவதும் கல்வி விழிப்புணர்வு இயக்கம் தொடக்கம்", en: "[DEMO] Statewide education awareness drive begins", flags: { featured: true, priority: 90 } },
  { cat: "coimbatore", ta: "[டெமோ] கோவை பள்ளியில் சரஸ்வதி பூஜை விழா: குழந்தைகளுக்கு வித்யாரம்பம்", en: "[DEMO] Vidyarambham held at a Coimbatore school on Saraswati Puja", flags: { featured: true, priority: 80 } },
  { cat: "tamil-nadu", ta: "[டெமோ] மழை எச்சரிக்கை: பல மாவட்டங்களில் மிதமான மழை வாய்ப்பு", en: "[DEMO] Rain alert: moderate showers likely in several districts", flags: { breaking: true } },
  { cat: "india", ta: "[டெமோ] தேசிய அளவில் புதிய டிஜிட்டல் கற்றல் திட்டம் அறிவிப்பு", en: "[DEMO] New national digital learning scheme announced" },
  { cat: "world", en: "[DEMO] Global climate talks enter final week" },
  { cat: "politics", ta: "[டெமோ] சட்டப்பேரவை கூட்டத்தொடர் அடுத்த வாரம் தொடக்கம்", en: "[DEMO] Assembly session to begin next week", flags: { breaking: true } },
  { cat: "business", ta: "[டெமோ] சிறு தொழில்களுக்கு புதிய கடன் வசதி", en: "[DEMO] New credit facility for small businesses" },
  { cat: "sports", ta: "[டெமோ] மாவட்ட கிரிக்கெட் இறுதிப் போட்டி இன்று", en: "[DEMO] District cricket final today", flags: { trending: true } },
  { cat: "cinema", ta: "[டெமோ] புதிய திரைப்பட இசை வெளியீட்டு விழா", en: "[DEMO] Music launch for new film draws crowds" },
  { cat: "education", ta: "[டெமோ] பொதுத்தேர்வு கால அட்டவணை வெளியீடு", en: "[DEMO] Board exam timetable released" },
  { cat: "health", ta: "[டெமோ] பருவகால நோய்களைத் தடுக்க மருத்துவர்களின் ஆலோசனை", en: "[DEMO] Doctors advise on preventing seasonal illnesses" },
  { cat: "spirituality", ta: "[டெமோ] கோயில் திருவிழா ஏற்பாடுகள் தீவிரம்", en: "[DEMO] Preparations for temple festival in full swing" },
  { cat: "opinion", ta: "[டெமோ] கருத்து: தாய்மொழிக் கல்வியின் முக்கியத்துவம்", en: "[DEMO] Opinion: Why mother-tongue learning matters" },
  { cat: "chennai", ta: "[டெமோ] சென்னை மெட்ரோ விரிவாக்கப் பணிகள் ஆய்வு", en: "[DEMO] Chennai Metro expansion work reviewed" },
  { cat: "madurai", ta: "[டெமோ] மதுரையில் கைவினைப் பொருட்கள் கண்காட்சி", en: "[DEMO] Handicrafts fair opens in Madurai" },
];

async function user(role: Role, name: string, email: string, pw: string, extra: Record<string, unknown> = {}) {
  let u = await User.findOne({ normalizedEmail: email });
  if (!u)
    u = await User.create({
      name,
      email,
      normalizedEmail: email,
      phone: "+910000000000",
      address: { line1: "Demo Street", city: "Coimbatore", state: "Tamil Nadu", postalCode: "641001", country: "India" },
      passwordHash: await hashPassword(pw),
      role,
      emailVerifiedAt: new Date(),
      consentAt: new Date(),
      preferredLanguage: "en",
      ...extra,
    });
  return u;
}

(async () => {
  await connectDB();
  await ensureIndexes();
  await getSettings();

  const ids: Record<string, mongoose.Types.ObjectId> = {};
  for (const [i, c] of CATS.entries()) {
    const doc = await Category.findOneAndUpdate(
      { slug: c.slug },
      { $setOnInsert: { slug: c.slug, name: { ta: c.ta, en: c.en }, order: i * 10, accent: c.accent, showInNav: !c.parent, parent: c.parent ? ids[c.parent] : null } },
      { upsert: true, returnDocument: "after" },
    );
    ids[c.slug] = doc._id;
  }
  await Tag.updateOne({ slug: "demo" }, { $setOnInsert: { slug: "demo", name: { ta: "டெமோ", en: "Demo" } } }, { upsert: true });

  const pw = () => crypto.randomBytes(9).toString("base64url") + "7a";
  const creds: [string, string, string][] = [];
  const mk = async (role: Role, name: string, email: string, extra: Record<string, unknown> = {}) => {
    const existing = await User.findOne({ normalizedEmail: email });
    const p = pw();
    const u = await user(role, name, email, p, extra);
    if (!existing) creds.push([role, email, p]);
    return u;
  };
  const admin = await mk("admin", "[DEMO] Admin Anitha", "admin@demo.invalid", { publicAuthor: true, bio: "Fictional demo administrator." });
  await mk("editor", "[DEMO] Editor Elango", "editor@demo.invalid", { publicAuthor: true });
  await mk("reporter", "[DEMO] Reporter Revathi", "reporter@demo.invalid");
  await mk("contributor", "[DEMO] Reader Ravi", "reader@demo.invalid");

  if ((await Article.countDocuments({ title: { $exists: true }, authorName: "[DEMO]" })) === 0) {
    const actor = toPrincipal(admin);
    for (const [i, s] of STORIES.entries()) {
      const img = await uploadImage(actor, { buffer: await demoImage(i, s.cat), name: `demo-${i}.png` }, { credit: "Demo illustration" });
      const text = (ta: boolean) => lorem(6, ta);
      const saved = await saveArticle(actor, null, {
        title: { ta: s.ta ?? "", en: s.en ?? "" },
        subtitle: { ta: s.ta ? "கற்பனையான டெமோ செய்தி" : "", en: s.en ? "A fictional demo story" : "" },
        excerpt: { ta: "", en: "" },
        body: { ta: s.ta ? text(true) : "", en: s.en ? text(false) : "" },
        preferredLanguage: s.ta ? "ta" : "en",
        category: String(ids[s.cat]),
        featuredImage: img.id,
        featuredCredit: "Demo illustration",
        featuredCaption: { ta: "", en: "Demo illustration" },
        authorName: "[DEMO]",
        authorId: String(admin._id),
        ...s.flags,
      });
      await transitionArticle(actor, saved.id, "published");
      // stagger publication times so ordering looks natural
      await Article.updateOne({ _id: saved.id }, { $set: { publishedAt: new Date(Date.now() - i * 47 * 60_000), views: Math.floor(Math.random() * 900) } });
    }
  }

  await SiteSettings.updateOne({ key: "site" }, { $set: { homepageSections: [] } });
  console.log("Seed complete.");
  if (creds.length) {
    console.log("\nDEMO accounts (fictional, passwords shown once):");
    for (const [r, e, p] of creds) console.log(`  ${r.padEnd(12)} ${e}   ${p}`);
  }
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
