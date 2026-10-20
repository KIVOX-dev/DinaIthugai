import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Article, MediaAsset, Notification, User } from "../../src/models";
import { login, principalFromToken, registerUser, requestPasswordReset, resetPassword, verifyEmail, toPrincipal } from "../../src/services/auth";
import { getMediaForDelivery, uploadImage } from "../../src/services/media";
import { articleInput, lastEmail, makeCategory, makeUser, pngBuffer, resetDb, startTestDb, stopTestDb, words, type MemoryStorage } from "./helpers";
import { saveArticle, transitionArticle, publishDueScheduled } from "../../src/articles/service";
import { getArticleForEdit, listAdminArticles } from "../../src/articles/admin-queries";
import { getPublicArticle, getLatest, searchArticles } from "../../src/articles/queries";
import { ServiceError } from "../../src/services/common";

let storage: MemoryStorage;
beforeAll(async () => {
  storage = await startTestDb();
});
afterAll(stopTestDb);

const reg = (email: string) => ({
  name: "Test Reader",
  email,
  phone: { countryCode: "+91", number: "98765 43210" },
  gender: "prefer_not_to_say",
  address: { line1: "12 Park Road", city: "Coimbatore", state: "Tamil Nadu", postalCode: "641001", country: "India" },
  password: "Password123",
  passwordConfirm: "Password123",
  acceptTerms: true,
  language: "en",
});

describe("registration, verification, login, reset", () => {
  it("registers, verifies by emailed single-use link, logs in, and resets password", async () => {
    await resetDb();
    await registerUser(reg("new@example.test"));
    const u = await User.findOne({ normalizedEmail: "new@example.test" }).select("+passwordHash");
    expect(u?.emailVerifiedAt).toBeUndefined();
    expect(u?.passwordHash).not.toContain("Password123");

    const mail = await lastEmail("new@example.test");
    const token = /token=([\w-]+)/.exec(mail!.text)![1];
    await verifyEmail(token);
    expect((await User.findOne({ normalizedEmail: "new@example.test" }))?.emailVerifiedAt).toBeTruthy();
    await expect(verifyEmail(token)).rejects.toThrow(); // single use

    const { token: session } = await login({ email: "new@example.test", password: "Password123" });
    expect((await principalFromToken(session))?.email).toBe("new@example.test");

    await requestPasswordReset("new@example.test");
    const resetMail = await lastEmail("new@example.test");
    const rt = /token=([\w-]+)/.exec(resetMail!.text)![1];
    await resetPassword({ token: rt, password: "NewPassword456", passwordConfirm: "NewPassword456" });
    await expect(resetPassword({ token: rt, password: "Another789012", passwordConfirm: "Another789012" })).rejects.toThrow();
    expect(await principalFromToken(session)).toBeNull(); // sessions revoked on reset
    await expect(login({ email: "new@example.test", password: "Password123" })).rejects.toThrow();
    await login({ email: "new@example.test", password: "NewPassword456" });
  });

  it("rejects duplicate emails and weak input", async () => {
    await expect(registerUser(reg("new@example.test"))).rejects.toMatchObject({ code: "invalid" });
    await expect(registerUser({ ...reg("x@example.test"), password: "short", passwordConfirm: "short" })).rejects.toMatchObject({ code: "invalid" });
    await expect(registerUser({ ...reg("y@example.test"), acceptTerms: false })).rejects.toMatchObject({ code: "invalid" });
  });

  it("is not vulnerable to NoSQL operator injection on login", async () => {
    await expect(login({ email: { $ne: null }, password: { $ne: null } })).rejects.toMatchObject({ code: "invalid" });
  });

  it("locks the account after repeated failures and blocks suspended users", async () => {
    await resetDb();
    await makeUser("contributor", { email: "lock@example.test", normalizedEmail: "lock@example.test" });
    for (let i = 0; i < 5; i++) await expect(login({ email: "lock@example.test", password: "wrong-password" })).rejects.toThrow();
    await expect(login({ email: "lock@example.test", password: "Password123" })).rejects.toMatchObject({ code: "locked" });
    await makeUser("contributor", { email: "sus@example.test", normalizedEmail: "sus@example.test", accountStatus: "suspended" });
    await expect(login({ email: "sus@example.test", password: "Password123" })).rejects.toMatchObject({ code: "forbidden" });
  });
});

describe("contributor submission -> review -> publication", () => {
  it("runs the whole editorial workflow against the real backend", async () => {
    await resetDb();
    const cat = await makeCategory();
    const author = await makeUser("contributor");
    const editor = await makeUser("editor");
    const admin = await makeUser("admin");
    const stranger = await makeUser("contributor");

    // upload photo -> stored privately (variants in object storage, metadata in MongoDB)
    const media = await uploadImage(author, { buffer: await pngBuffer(), name: "photo.png" }, { credit: "Test Reader" });
    expect(storage.objects.size).toBe(5);
    const asset = await MediaAsset.findById(media.id);
    expect(asset?.visibility).toBe("private");
    expect(await getMediaForDelivery(media.id, "lg", null)).toBe("forbidden");
    expect(await getMediaForDelivery(media.id, "lg", stranger)).toBe("forbidden");
    expect(await getMediaForDelivery(media.id, "lg", author)).toMatchObject({ contentType: "image/webp" });

    // draft with an inline image; malicious markup is stripped
    const body = `<p>${words(120)}</p><script>alert(1)</script><img src="/api/media/${media.id}/lg" alt="x" onerror="alert(1)"><img src="https://evil.test/x.png"><a href="javascript:alert(1)">bad</a>`;
    const saved = await saveArticle(author, null, articleInput(cat, { body: { ta: "", en: body }, featuredImage: media.id }));
    const draft = await Article.findById(saved.id).lean();
    expect(draft?.body?.en).not.toMatch(/script|onerror|evil\.test|javascript:/i);
    expect(draft?.body?.en).toContain(`/api/media/${media.id}/lg`);
    expect(draft?.status).toBe("draft");
    expect(draft?.source).toBe("community");

    // other users cannot see or touch it
    await expect(getArticleForEdit(stranger, saved.id)).rejects.toMatchObject({ code: "not_found" });
    await expect(getArticleForEdit(editor, saved.id)).rejects.toMatchObject({ code: "not_found" }); // authors' drafts are private even from editors
    await expect(saveArticle(stranger, saved.id, articleInput(cat))).rejects.toBeInstanceOf(ServiceError);
    await expect(transitionArticle(admin, saved.id, "published")).rejects.toBeInstanceOf(ServiceError);

    // submit without declaration fails; with it succeeds and is queued
    await saveArticle(author, saved.id, articleInput(cat, { declaration: false, featuredImage: media.id, body: { ta: "", en: body } }));
    await expect(transitionArticle(author, saved.id, "submitted")).rejects.toMatchObject({ code: "invalid" });
    await saveArticle(author, saved.id, articleInput(cat, { featuredImage: media.id, body: { ta: "", en: body } }));
    await transitionArticle(author, saved.id, "submitted");
    expect((await Article.findById(saved.id))?.status).toBe("submitted");
    const queue = await listAdminArticles(editor, { queue: true });
    expect(queue.items.map((i) => i.id)).toContain(saved.id);

    // never public automatically
    expect((await getLatest("en")).total).toBe(0);
    // locked: author cannot silently edit after submission
    await expect(saveArticle(author, saved.id, articleInput(cat, { title: { ta: "", en: "Changed" } }))).rejects.toMatchObject({ code: "forbidden" });

    // editor: reason required, then request changes
    await transitionArticle(editor, saved.id, "in_review");
    await expect(transitionArticle(editor, saved.id, "changes_requested", {})).rejects.toMatchObject({ code: "invalid" });
    await transitionArticle(editor, saved.id, "changes_requested", { reason: "Please add the date of the event." });
    expect(await Notification.countDocuments({ user: author.id, type: "submission.changes_requested" })).toBe(1);

    // author edits and resubmits
    await saveArticle(author, saved.id, articleInput(cat, { featuredImage: media.id, body: { ta: "", en: body + "<p>The event took place on Sunday.</p>" } }));
    await transitionArticle(author, saved.id, "submitted");

    // editor without publish permission can approve but not publish; approval does not publish
    await transitionArticle(editor, saved.id, "approved");
    expect((await getLatest("en")).total).toBe(0);
    await expect(transitionArticle(editor, saved.id, "published")).rejects.toMatchObject({ code: "forbidden" });

    // admin publishes -> idempotent on retry, one notification
    await transitionArticle(admin, saved.id, "published");
    const again = await transitionArticle(admin, saved.id, "published");
    expect(again.changed).toBe(false);
    expect(await Notification.countDocuments({ user: author.id, type: "submission.published" })).toBe(1);

    // public: visible with stable slug, media now deliverable to anonymous readers
    const pub = await getPublicArticle("en", "a-local-story");
    expect(pub?.view.card.title).toBe("A local story");
    expect(await getMediaForDelivery(media.id, "lg", null)).toMatchObject({ public: true });
    expect((await getLatest("en")).items).toHaveLength(1);
    expect((await searchArticles("en", { q: "local" })).total).toBe(1);
    // missing translation: Tamil list excludes it, Tamil URL shows the English text with a notice
    expect((await getLatest("ta")).total).toBe(0);
    const ta = await getPublicArticle("ta", "a-local-story");
    expect(ta?.view.languageNotice).toBe(true);
    expect(ta?.view.language).toBe("en");

    // unpublish hides the article and its photo again
    await transitionArticle(admin, saved.id, "unpublished");
    expect(await getPublicArticle("en", "a-local-story")).toBeNull();
    expect(await getMediaForDelivery(media.id, "lg", null)).toBe("forbidden");

    // contributor sees final status
    const mine = await Article.findById(saved.id).lean();
    expect(mine?.status).toBe("unpublished");
  });

  it("rejection requires a reason; community content cannot skip moderation", async () => {
    await resetDb();
    const cat = await makeCategory();
    const author = await makeUser("contributor");
    const admin = await makeUser("admin");
    const editor = await makeUser("editor");
    const { id } = await saveArticle(author, null, articleInput(cat));
    await expect(transitionArticle(admin, id, "published")).rejects.toBeInstanceOf(ServiceError); // not visible to admin while draft
    await transitionArticle(author, id, "submitted");
    await expect(transitionArticle(admin, id, "published")).rejects.toMatchObject({ code: "conflict" }); // invalid transition
    await expect(transitionArticle(editor, id, "rejected", { reason: "x" })).rejects.toMatchObject({ code: "invalid" });
    await transitionArticle(editor, id, "rejected", { reason: "Does not meet editorial standards." });
    expect((await Article.findById(id))?.submission?.reviewNote).toContain("editorial standards");
  });

  it("unverified contributors cannot submit or upload", async () => {
    await resetDb();
    const cat = await makeCategory();
    const u = await makeUser("contributor", { emailVerifiedAt: undefined });
    await expect(uploadImage(u, { buffer: await pngBuffer(), name: "a.png" })).rejects.toMatchObject({ code: "forbidden" });
    const { id } = await saveArticle(u, null, articleInput(cat));
    await expect(transitionArticle(u, id, "submitted")).rejects.toMatchObject({ code: "forbidden" });
  });
});

describe("admin direct publishing and scheduling", () => {
  it("lets an admin publish directly with revision history, and schedules without a browser", async () => {
    await resetDb();
    const cat = await makeCategory();
    const admin = await makeUser("admin");
    const input = articleInput(cat, { title: { ta: "ஒரு செய்தி", en: "Direct story" }, body: { ta: `<p>${words(40, "சொல்")}</p>`, en: `<p>${words(40)}</p>` } });
    const { id } = await saveArticle(admin, null, input);
    expect((await Article.findById(id))?.source).toBe("staff");
    await saveArticle(admin, id, { ...input, title: { ta: "ஒரு செய்தி", en: "Direct story v2" } });
    const dto = await getArticleForEdit(admin, id);
    expect(dto.revisions.length).toBeGreaterThanOrEqual(2);
    expect(dto.availability).toEqual({ ta: true, en: true });
    expect(dto.slug.ta).toBe("ஒரு-செய்தி"); // Unicode slug preserved

    await transitionArticle(admin, id, "published");
    const ta = await getPublicArticle("ta", "ஒரு-செய்தி");
    expect(ta?.view.languageNotice).toBe(false);

    // scheduling
    const s = await saveArticle(admin, null, articleInput(cat, { title: { ta: "", en: "Future story" } }));
    await expect(transitionArticle(admin, s.id, "scheduled", { scheduledAt: new Date(Date.now() - 3600_000) })).rejects.toMatchObject({ code: "invalid" });
    const when = new Date(Date.now() + 3600_000);
    await transitionArticle(admin, s.id, "scheduled", { scheduledAt: when });
    expect(await getPublicArticle("en", "future-story")).toBeNull(); // not yet
    await Article.updateOne({ _id: s.id }, { $set: { scheduledAt: new Date(Date.now() - 1000), publishedAt: new Date(Date.now() - 1000) } }); // time passes
    expect(await getPublicArticle("en", "future-story")).not.toBeNull(); // visible by time alone
    const r1 = await publishDueScheduled();
    const r2 = await publishDueScheduled();
    expect(r1.published).toBe(1);
    expect(r2.published).toBe(0); // idempotent
    expect((await Article.findById(s.id))?.status).toBe("published");
  });

  it("enforces slug uniqueness", async () => {
    await resetDb();
    const cat = await makeCategory();
    const admin = await makeUser("admin");
    const a = await saveArticle(admin, null, articleInput(cat));
    const b = await saveArticle(admin, null, articleInput(cat));
    expect(a.slug.en).toBe("a-local-story");
    expect(b.slug.en).toBe("a-local-story-2");
  });
});

describe("hardening", () => {
  it("rejects non-image and disguised uploads", async () => {
    await resetDb();
    const u = await makeUser("contributor");
    await expect(uploadImage(u, { buffer: Buffer.from("<svg onload=alert(1)></svg>"), name: "x.png" })).rejects.toMatchObject({ code: "invalid" });
    await expect(uploadImage(u, { buffer: Buffer.from("MZ\x90\x00 this is an exe"), name: "x.jpg" })).rejects.toMatchObject({ code: "invalid" });
    const png = await pngBuffer();
    await expect(uploadImage(u, { buffer: Buffer.concat([png.subarray(0, 40), Buffer.from("garbage")]), name: "c.png" })).rejects.toMatchObject({ code: "invalid" });
    await expect(uploadImage(u, { buffer: Buffer.alloc(0), name: "e.png" })).rejects.toMatchObject({ code: "invalid" });
  });

  it("toPrincipal does not leak secrets", async () => {
    const u = await User.findOne().select("+passwordHash");
    expect(JSON.stringify(toPrincipal(u!))).not.toContain("passwordHash");
  });
});
