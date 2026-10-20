import { expect, test, type Page } from "@playwright/test";

/** Opens every admin and public page as the right user and fails on server errors, console errors or missing headings. */
const ADMIN = { email: "admin@demo.invalid", password: process.env.E2E_ADMIN_PASSWORD ?? "" };

const ADMIN_PAGES: [string, RegExp][] = [
  ["/admin", /Dashboard/],
  ["/admin/articles", /Articles/],
  ["/admin/review", /Review queue/],
  ["/admin/articles/new", /New article/],
  ["/admin/users", /Users/],
  ["/admin/media", /Media/],
  ["/admin/categories", /Categories/],
  ["/admin/settings", /Settings/],
  ["/admin/audit", /Audit log/],
];

const PUBLIC_PAGES = ["/ta", "/en", "/ta/latest", "/en/trending", "/en/gallery", "/ta/tamil-nadu", "/en/search?q=demo", "/ta/about", "/en/contact", "/en/editorial-policy", "/en/corrections-policy", "/ta/privacy", "/en/terms", "/en/login", "/ta/register", "/en/forgot-password"];

function watch(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && !/favicon|Failed to load resource/.test(m.text()) && errors.push(`console: ${m.text().slice(0, 200)}`));
  return errors;
}

test.describe("smoke", () => {
  for (const p of PUBLIC_PAGES) {
    test(`public ${p}`, async ({ page }) => {
      const errors = watch(page);
      const res = await page.goto(p);
      expect(res?.status()).toBe(200);
      await expect(page.locator("h1").first()).toBeVisible();
      expect(errors).toEqual([]);
    });
  }

  test.describe("admin", () => {
    test.skip(!ADMIN.password, "set E2E_ADMIN_PASSWORD");
    test.beforeEach(async ({ page }) => {
      await page.goto("/en/login");
      await page.getByLabel("Email address").fill(ADMIN.email);
      await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
      await page.getByRole("button", { name: "Sign in" }).click();
      await page.waitForURL(/\/admin/);
    });
    for (const [p, h] of ADMIN_PAGES) {
      test(`admin ${p}`, async ({ page }) => {
        const errors = watch(page);
        const res = await page.goto(p);
        expect(res?.status()).toBe(200);
        await expect(page.getByRole("heading", { level: 1, name: h })).toBeVisible();
        expect(errors).toEqual([]);
      });
    }
    test("no 'unsaved changes' prompt unless something was really edited", async ({ page }) => {
      const dialogs: string[] = [];
      page.on("dialog", (d) => {
        dialogs.push(d.type());
        void d.accept();
      });
      await page.goto("/admin/articles?status=published");
      await page.getByRole("link").filter({ hasText: /DEMO/ }).first().click();
      await expect(page.getByRole("heading", { name: "Workflow" })).toBeVisible();
      await page.waitForTimeout(1500); // let the editor finish loading
      await page.goto("/admin"); // leaving without touching anything
      expect(dialogs).toEqual([]);

      await page.goto("/admin/articles?status=published");
      await page.getByRole("link").filter({ hasText: /DEMO/ }).first().click();
      await expect(page.getByRole("heading", { name: "Workflow" })).toBeVisible();
      await page.getByRole("tab", { name: /English version/ }).click();
      await page.locator("#excerpt-en").click();
      await page.keyboard.type(" edited");
      await page.goto("/admin"); // leaving after a real edit must still warn
      expect(dialogs).toContain("beforeunload");
    });

    test("admin can open a user, an article editor and a seeded article public page", async ({ page }) => {
      const errors = watch(page);
      await page.goto("/admin/users");
      await page.getByRole("link", { name: /\[DEMO\] Editor/ }).first().click();
      await expect(page.getByRole("heading", { level: 1, name: /Editor/ })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Account status" })).toBeVisible(); // admins hold users.suspend
      await expect(page.getByRole("heading", { name: "Role & permissions" })).toHaveCount(0); // role changes are super-admin only
      await page.goto("/admin/articles?status=published");
      await page.getByRole("link").filter({ hasText: /DEMO/ }).first().click();
      await expect(page.getByRole("heading", { name: "Workflow" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "AI assistant" })).toBeVisible();
      expect(errors).toEqual([]);
    });
  });
});
