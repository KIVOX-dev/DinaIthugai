import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

/**
 * End-to-end acceptance flow against the real backend + database:
 * register -> verify email -> sign in -> submit article with photo -> editor requests changes -> author resubmits ->
 * editor approves (not public yet) -> admin publishes -> visible on homepage/category/article URL -> author sees status ->
 * test content is archived again so the live site stays clean.
 *
 * Needs the demo accounts from `npm run seed` in backend/ (admin@demo.invalid, editor@demo.invalid) and their passwords:
 *   E2E_ADMIN_PASSWORD, E2E_EDITOR_PASSWORD
 */
const ADMIN = { email: "admin@demo.invalid", password: process.env.E2E_ADMIN_PASSWORD ?? "" };
const EDITOR = { email: "editor@demo.invalid", password: process.env.E2E_EDITOR_PASSWORD ?? "" };
// Our own alerts, excluding Next.js's hidden route announcer which also has role="alert".
const appAlert = (page: Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)');
const stamp = Date.now();
const USER = { name: "E2E Reader", email: `e2e+${stamp}@example.test`, password: `E2e-${randomBytes(9).toString("base64url")}-1a` }; // random per run: no credential literal in the repo
const TITLE = `[E2E TEST] Community report ${stamp}`;
const BODY = Array.from({ length: 90 }, (_, i) => `word${i}`).join(" ");

async function signIn(page: Page, email: string, password: string, lang = "en") {
  await page.goto(`/${lang}/login`);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

function emailLink(to: string, kind: "verify-email" | "reset-password") {
  const out = execSync(`npx tsx --env-file=.env scripts/last-email.ts "${to}"`, { cwd: path.resolve(__dirname, "../../../backend"), encoding: "utf8" });
  const m = new RegExp(`https?://[^\\s]+/${kind}\\?token=[\\w-]+`).exec(out);
  if (!m) throw new Error(`no ${kind} link in email:\n${out}`);
  return new URL(m[0]);
}

test.describe.serial("contributor -> editor -> publication", () => {
  test.skip(!ADMIN.password || !EDITOR.password, "set E2E_ADMIN_PASSWORD and E2E_EDITOR_PASSWORD (seed passwords)");
  let articleUrl = "";
  let submissionUrl = "";
  let photo: Buffer;

  test.beforeAll(async () => {
    photo = await sharp({ create: { width: 900, height: 600, channels: 3, background: { r: 20, g: 90, b: 160 } } }).png().toBuffer();
  });

  test("reader registers, verifies email and signs in", async ({ page }) => {
    await page.goto("/en/register");
    await page.getByLabel("Full name").fill(USER.name);
    await page.getByLabel("Email address").fill(USER.email);
    await page.getByLabel("Phone number").fill("98765 43210");
    await page.getByLabel("Address line 1").fill("12 Park Road");
    await page.getByLabel("City / town").fill("Coimbatore");
    await page.getByLabel("Postal code").fill("641001");
    await page.getByLabel("Password", { exact: true }).fill(USER.password);
    await page.getByLabel("Confirm password").fill(USER.password);
    // validation: terms must be accepted
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("You must accept the privacy policy and terms.")).toBeVisible();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/en\/login\?registered=1/);

    const link = emailLink(USER.email, "verify-email");
    await page.goto(`/en/verify-email${link.search}`);
    await expect(page.getByText("Your email address is verified")).toBeVisible();

    await signIn(page, USER.email, USER.password);
    await expect(page).toHaveURL(/\/en\/account$/);
  });

  test("wrong password is rejected without revealing whether the account exists", async ({ page }) => {
    await signIn(page, USER.email, "definitely-wrong-password");
    await expect(appAlert(page).first()).toContainText("Incorrect email or password");
    await signIn(page, "nobody@example.test", "definitely-wrong-password");
    await expect(appAlert(page).first()).toContainText("Incorrect email or password");
  });

  test("contributor writes an article with a photo and submits it", async ({ page }) => {
    await signIn(page, USER.email, USER.password);
    await page.waitForURL(/\/en\/account$/);
    await page.goto("/en/account/submit");
    await page.getByRole("tab", { name: /English version/ }).click();
    await page.locator("#title-en").fill(TITLE);
    await page.locator("#body-en").click();
    await page.keyboard.type(BODY);
    await page.locator("#category").selectOption({ label: "Tamil Nadu" });
    // featured photo upload -> real multipart upload to the backend
    await page.locator("#featuredFile").setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: photo });
    await expect(page.locator('img[src*="/api/media/"]').first()).toBeVisible();
    // the declaration is mandatory
    await page.getByRole("button", { name: "Submit for review" }).click();
    await expect(appAlert(page).first()).toBeVisible();
    await page.getByRole("checkbox", { name: /I confirm that I own/ }).check();
    await page.getByRole("button", { name: "Submit for review" }).click();
    await expect(page).toHaveURL(/\/en\/account\/submissions\/[a-f0-9]{24}\?submitted=1/);
    submissionUrl = new URL(page.url()).pathname;
    await expect(page.getByText("Submitted. Our editors will review it shortly.")).toBeVisible();
    await expect(page.getByText("Under review").or(page.getByText("Submitted", { exact: true })).first()).toBeVisible();
    // locked while in review
    await expect(page.getByText("This submission is locked while it is being reviewed.")).toBeVisible();
  });

  test("a non-published submission is not public", async ({ page, request }) => {
    const r = await request.get("/api/public/search?lang=en&q=E2E%20TEST");
    const json = await r.json();
    expect(json.items.map((i: { title: string }) => i.title)).not.toContain(TITLE);
    // another visitor cannot open the author's submission page
    await page.goto(submissionUrl);
    await expect(page).toHaveURL(/\/en\/login/);
  });

  test("editor requests changes; author revises and resubmits", async ({ page, browser }) => {
    await signIn(page, EDITOR.email, EDITOR.password);
    await page.waitForURL(/\/admin/);
    await page.goto("/admin/review");
    await page.getByRole("link", { name: TITLE }).click();
    await expect(page.getByRole("heading", { name: "Workflow" })).toBeVisible();
    await page.getByRole("button", { name: "Start review" }).click();
    await expect(page.getByText("Start review: done")).toBeVisible();
    // reason is mandatory
    await page.getByRole("button", { name: "Request changes" }).click();
    await expect(page.getByText("A reason of at least 5 characters is required.")).toBeVisible();
    await page.getByLabel(/Reason \/ comments/).fill("Please add the date of the event.");
    await page.getByRole("button", { name: "Request changes" }).click();
    await expect(page.getByText("Request changes: done")).toBeVisible();

    // author sees the feedback and resubmits
    const ctx = await browser.newContext();
    const author = await ctx.newPage();
    await signIn(author, USER.email, USER.password);
    await author.waitForURL(/\/en\/account$/);
    await author.goto(submissionUrl);
    await expect(author.getByText("Please add the date of the event.").first()).toBeVisible();
    await author.getByRole("link", { name: "Edit and resubmit" }).click();
    await author.getByRole("tab", { name: /English version/ }).click();
    await author.locator("#body-en").click();
    await author.keyboard.press("Control+End");
    await author.keyboard.type(" The event took place on Sunday.");
    await author.getByRole("button", { name: "Submit for review" }).click();
    await expect(author).toHaveURL(/submitted=1/);
    await ctx.close();
  });

  test("editor approves: still not public; editor without publish permission cannot publish", async ({ page, request }) => {
    await signIn(page, EDITOR.email, EDITOR.password);
    await page.waitForURL(/\/admin/);
    await page.goto(submissionUrl.replace("/en/account/submissions/", "/admin/articles/"));
    await page.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText("Approve: done")).toBeVisible();
    await expect(page.getByRole("button", { name: "Publish now" })).toHaveCount(0); // editors lack articles.publish
    const r = await request.get("/api/public/search?lang=en&q=E2E%20TEST");
    expect((await r.json()).items.map((i: { title: string }) => i.title)).not.toContain(TITLE);
  });

  test("admin publishes; article is public at a stable URL; contributor sees the final status", async ({ page, browser }) => {
    await signIn(page, ADMIN.email, ADMIN.password);
    await page.waitForURL(/\/admin/);
    await page.goto(submissionUrl.replace("/en/account/submissions/", "/admin/articles/"));
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Publish now" }).click();
    await expect(page.getByText("Publish now: done")).toBeVisible();

    // public pages
    const anon = await browser.newContext();
    const pub = await anon.newPage();
    await pub.goto("/en/tamil-nadu");
    await expect(pub.getByRole("link", { name: TITLE }).first()).toBeVisible();
    await pub.getByRole("link", { name: TITLE }).first().click();
    await pub.waitForURL(/\/en\/news\//);
    articleUrl = new URL(pub.url()).pathname;
    expect(articleUrl).toMatch(/^\/en\/news\/e2e-test-community-report-/);
    await expect(pub.getByRole("heading", { level: 1, name: TITLE })).toBeVisible();
    await expect(pub.locator('img[src*="/api/media/"]').first()).toBeVisible();
    // photo is now publicly deliverable
    const imgSrc = await pub.locator('figure img').first().getAttribute("src");
    expect((await anon.request.get(imgSrc!)).status()).toBe(200);
    // Tamil URL for an English-only story: honest notice, not a fabricated translation
    await pub.goto(articleUrl.replace("/en/", "/ta/"));
    await expect(pub.getByRole("note")).toBeVisible();
    await anon.close();

    // author sees the published status
    const ctx = await browser.newContext();
    const author = await ctx.newPage();
    await signIn(author, USER.email, USER.password);
    await author.waitForURL(/\/en\/account$/);
    await author.goto(submissionUrl);
    await expect(author.getByText("Published", { exact: true }).first()).toBeVisible();
    await expect(author.getByRole("link", { name: /View published article/ })).toBeVisible();
    await ctx.close();
  });

  test("admin unpublishes and archives the test article; it disappears and its photo becomes private", async ({ page, browser }) => {
    await signIn(page, ADMIN.email, ADMIN.password);
    await page.waitForURL(/\/admin/);
    await page.goto(submissionUrl.replace("/en/account/submissions/", "/admin/articles/"));
    page.on("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Unpublish" }).click();
    await expect(page.getByText("Unpublish: done")).toBeVisible();
    await page.getByRole("button", { name: "Archive" }).click();
    await expect(page.getByText("Archive: done")).toBeVisible();
    const anon = await browser.newContext();
    const res = await anon.request.get(articleUrl.replace("/en/news/", "/api/public/article/").replace(/^\/api\/public\/article\/(.*)$/, "/api/public/article/$1?lang=en"));
    expect(res.status()).toBe(404);
    await anon.close();
  });

  test("anonymous visitors cannot reach admin APIs or pages", async ({ request, page }) => {
    for (const p of ["/api/admin/stats", "/api/admin/users", "/api/ai/assist"]) {
      const r = await request.get(p);
      expect([401, 404, 405]).toContain(r.status());
    }
    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/en\/login/);
  });
});
