import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Article } from "../../src/models";
import { saveArticle, transitionArticle } from "../../src/articles/service";
import { getLatest, getPublicArticle, getRelatedAndAdjacent, getGallery, getHomepage, getTrending, searchArticles } from "../../src/articles/queries";
import { articleInput, makeCategory, makeUser, pngBuffer, resetDb, startTestDb, stopTestDb, words } from "./helpers";
import { uploadImage } from "../../src/services/media";

beforeAll(async () => {
  await startTestDb();
});
afterAll(stopTestDb);

/**
 * Regression suite: unpublished content must never leak through ANY public query path.
 * (A previous bug let the search substring fallback and the related-stories query overwrite the visibility $or.)
 */
describe("public queries never expose unpublished articles", () => {
  it("covers every status through search (text + substring), lists, related, article lookup, gallery, homepage", async () => {
    await resetDb();
    const cat = await makeCategory();
    const admin = await makeUser("admin");
    const author = await makeUser("contributor");
    const photo = await uploadImage(admin, { buffer: await pngBuffer(), name: "p.png" });
    const mk = async (title: string, who = admin) => {
      const r = await saveArticle(who, null, articleInput(cat, { title: { ta: "", en: title }, body: { ta: "", en: `<p>${words(120)} shared-keyword</p>` }, ...(who === admin ? { featuredImage: photo.id } : {}) })); // contributors may only use their own uploads
      return r.id;
    };

    const published = await mk("Visible Moonlight Story");
    await transitionArticle(admin, published, "published");

    const draft = await mk("Hidden Moonlight Draft");
    const submitted = await mk("Hidden Moonlight Submitted", author);
    await transitionArticle(author, submitted, "submitted");
    const approved = await mk("Hidden Moonlight Approved");
    await transitionArticle(admin, approved, "approved");
    const future = await mk("Hidden Moonlight Scheduled");
    await transitionArticle(admin, future, "scheduled", { scheduledAt: new Date(Date.now() + 3600_000) });
    const unpublished = await mk("Hidden Moonlight Unpublished");
    await transitionArticle(admin, unpublished, "published");
    await transitionArticle(admin, unpublished, "unpublished");
    const archived = await mk("Hidden Moonlight Archived");
    await transitionArticle(admin, archived, "archived");
    const deleted = await mk("Hidden Moonlight Deleted");
    await Article.updateOne({ _id: deleted }, { $set: { deletedAt: new Date() } });

    const titles = (r: { items: { title: string }[] }) => r.items.map((i) => i.title);

    // search: text index path and the partial-word (substring) fallback path
    expect(titles(await searchArticles("en", { q: "Moonlight" }))).toEqual(["Visible Moonlight Story"]);
    expect(titles(await searchArticles("en", { q: "oonligh" }))).toEqual(["Visible Moonlight Story"]); // substring fallback
    expect(titles(await searchArticles("en", { q: "shared-keyword" }))).toEqual(["Visible Moonlight Story"]);
    expect(titles(await searchArticles("en", {}))).toEqual(["Visible Moonlight Story"]); // browse, no query
    expect(titles(await searchArticles("en", { q: "Hidden" }))).toEqual([]);
    expect(titles(await searchArticles("en", { q: "idden Moon" }))).toEqual([]); // substring of a hidden title

    // feeds
    expect(titles(await getLatest("en"))).toEqual(["Visible Moonlight Story"]);
    expect(titles({ items: await getTrending("en") })).toEqual(["Visible Moonlight Story"]);
    const home = await getHomepage("en");
    const homeTitles = [home.lead, ...home.secondary, ...home.latest, ...home.trending, ...home.sections.flatMap((s) => s.items)].filter(Boolean).map((c) => c!.title);
    expect(new Set(homeTitles)).toEqual(new Set(["Visible Moonlight Story"]));

    // related stories & adjacent navigation (the query that used to overwrite the visibility filter)
    const pub = await getPublicArticle("en", "visible-moonlight-story");
    expect(pub).not.toBeNull();
    const adj = await getRelatedAndAdjacent("en", { id: String(pub!.doc._id), category: cat, tags: [], publishedAt: pub!.doc.publishedAt ?? undefined });
    expect(adj.related.map((r) => r.title)).toEqual([]);
    expect([adj.prev?.title, adj.next?.title].filter(Boolean)).toEqual([]);

    // direct lookup by slug for each hidden article
    for (const slug of ["hidden-moonlight-draft", "hidden-moonlight-submitted", "hidden-moonlight-approved", "hidden-moonlight-scheduled", "hidden-moonlight-unpublished", "hidden-moonlight-archived", "hidden-moonlight-deleted"]) {
      expect(await getPublicArticle("en", slug)).toBeNull();
    }

    // gallery only exposes photos of visible articles; the shared photo is public now because one article is visible
    const g = await getGallery("en", 1);
    expect(g.items.every((i) => i.slug === "visible-moonlight-story")).toBe(true);

    // ids unused by the assertions above, kept to make failures easier to read
    void [draft, approved, future, unpublished, archived, deleted];
  });

  it("a second visible story appears in related; hidden ones still do not", async () => {
    await resetDb();
    const cat = await makeCategory();
    const admin = await makeUser("admin");
    const a = (await saveArticle(admin, null, articleInput(cat, { title: { ta: "", en: "Story A" } }))).id;
    const b = (await saveArticle(admin, null, articleInput(cat, { title: { ta: "", en: "Story B" } }))).id;
    const hidden = (await saveArticle(admin, null, articleInput(cat, { title: { ta: "", en: "Story Hidden" } }))).id;
    await transitionArticle(admin, a, "published");
    await transitionArticle(admin, b, "published");
    void hidden;
    const pub = await getPublicArticle("en", "story-a");
    const adj = await getRelatedAndAdjacent("en", { id: a, category: cat, tags: [], publishedAt: pub!.doc.publishedAt ?? undefined });
    expect(adj.related.map((r) => r.title)).toEqual(["Story B"]);
  });
});
