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

test("Tamil text typed into the English tab is flagged and can be moved to the Tamil version", async ({ page }) => {
  test.skip(!READER.password, "set E2E_READER_PASSWORD");
  await page.goto("/en/login");
  await page.getByLabel("Email address").fill(READER.email);
  await page.getByLabel("Password", { exact: true }).fill(READER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/en\/account$/);
  await page.goto("/en/account/submit");
  await page.getByRole("tab", { name: /English version/ }).click();
  await page.locator("#title-en").fill("[E2E TEST] A pleasant day");
  await page.locator("#body-en").click();
  await page.keyboard.insertText("இது ஒரு இனிய நாள். இந்த உரை தமிழில் எழுதப்பட்டுள்ளது, ஆனால் ஆங்கிலப் பதிப்பில் தவறாக இடப்பட்டது.");

  const note = page.getByRole("note").filter({ hasText: /looks like Tamil/ });
  await expect(note).toBeVisible();
  await note.getByRole("button", { name: /Move it to the other version/ }).click();

  // the Tamil version now holds the text; the English headline (Latin script) stayed where it was
  await expect(page.getByRole("tab", { name: /Tamil version/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#body-ta")).toContainText("இது ஒரு இனிய நாள்");
  await expect(page.locator("#title-en")).toHaveCount(1);
  await page.getByRole("tab", { name: /English version/ }).click();
  await expect(page.locator("#title-en")).toHaveValue("[E2E TEST] A pleasant day");
  await expect(page.locator("#body-en")).not.toContainText("இது ஒரு இனிய நாள்");
  await expect(page.getByRole("note").filter({ hasText: /looks like Tamil/ })).toHaveCount(0);
});
