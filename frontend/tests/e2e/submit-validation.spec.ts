import { expect, test } from "@playwright/test";

/**
 * Regression: a submission below the minimum word count was refused (correctly) but the reason appeared at the top of the
 * long form, out of sight of the Submit button. The reason must now scroll into view and state the actual numbers.
 * Uses the seeded demo reader (verified email): set E2E_READER_PASSWORD.
 */
const READER = { email: "reader@demo.invalid", password: process.env.E2E_READER_PASSWORD ?? "" };

test("too-short submission explains why, visibly, and stays a draft", async ({ page }) => {
  test.skip(!READER.password, "set E2E_READER_PASSWORD (seed password of reader@demo.invalid)");
  await page.goto("/en/login");
  await page.getByLabel("Email address").fill(READER.email);
  await page.getByLabel("Password", { exact: true }).fill(READER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/en\/account$/);

  await page.goto("/en/account/submit");
  await page.getByRole("tab", { name: /English version/ }).click();
  await page.locator("#title-en").fill("[E2E TEST] Too short");
  await page.locator("#body-en").click();
  await page.keyboard.type(Array.from({ length: 20 }, (_, i) => `short${i}`).join(" "));
  await page.locator("#category").selectOption({ label: "Tamil Nadu" });
  await page.getByRole("checkbox", { name: /I confirm that I own/ }).check();

  // the live counter already warns before the user presses anything
  await expect(page.getByText(/20 \/ \d+/)).toBeVisible();

  await page.getByRole("button", { name: "Submit for review" }).click();
  const alert = page.locator('[role="alert"]:not(#__next-route-announcer__)').first();
  await expect(alert).toContainText(/too short/i);
  await expect(alert).toContainText("20 /");
  await expect(alert).toBeInViewport(); // scrolled into view, not hidden at the top of the form
  await expect(page).not.toHaveURL(/submitted=1/);

  // it is saved as a draft (not submitted); clean it up
  const id = /submissions\/([a-f0-9]{24})\/edit/.exec(page.url())?.[1];
  expect(id).toBeTruthy();
  const detail = await page.request.get(`/api/articles/${id}`);
  expect((await detail.json()).article.status).toBe("draft");
  expect((await page.request.delete(`/api/articles/${id}`)).ok()).toBeTruthy();
});
