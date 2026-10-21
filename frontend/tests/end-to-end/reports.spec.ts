/** The report form in a real browser, at 320, 360, 768 and 1024 px. Requirements: US-08, FR-20, FR-21, NFR-07, NFR-10.
 * Spec: specs/2026-10-20-reports/ (plan Task 5). It needs the site and the API running (see playwright.config.ts) with the seed data.
 * The POST /reports call is answered by the test (`page.route`), so no report is stored and the rate limit of the real API is not used.
 */
import { expect, test, type Page } from "@playwright/test";

const WIDTHS = [
  { width: 320, height: 640 },
  { width: 360, height: 740 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
];
const SLUG = "demo-24-hour-pharmacy-ogui";

async function allIsInsideTheScreen(page: Page, width: number): Promise<void> {
  const overflow = await page.evaluate(() => (document.querySelector("main")?.scrollWidth ?? 0) - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  for (const control of await page.locator("main h1, main label, main button, main a, main input, main textarea").all()) {
    const box = await control.boundingBox();
    if (!box) continue;
    expect(box.x).toBeGreaterThanOrEqual(-0.5);
    expect(box.x + box.width).toBeLessThanOrEqual(width + 0.5);
  }
}

for (const { width, height } of WIDTHS) {
  test.describe(`report form at ${width} px`, () => {
    test.use({ viewport: { width, height } });

    test("opens from the listing page, fits the screen, has big targets and sends in two taps", async ({ page }) => {
      const sent: unknown[] = [];
      await page.route("http://localhost:8000/reports", async (route) => {
        sent.push(route.request().postDataJSON());
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          headers: { "access-control-allow-origin": "*" },
          body: JSON.stringify({ id: 1, message: "Thank you. We will check this listing." }),
        });
      });
      await page.goto(`/listing/${SLUG}`, { waitUntil: "load" });
      await page.getByRole("link", { name: "Report a problem with this listing" }).click({ timeout: 60_000 });

      await expect(page).toHaveURL(new RegExp(`/report/${SLUG}$`), { timeout: 60_000 }); // the dev site compiles the page on its first visit
      await expect(page.getByRole("heading", { level: 1, name: /^Report a problem with / })).toBeVisible({ timeout: 60_000 });
      const radios = page.getByRole("radio");
      await expect(radios).toHaveCount(6);
      for (const label of await page.locator("main fieldset label").all()) { // the radio rows (the field captions are text, not targets)
        const box = await label.boundingBox();
        if (box) expect(box.height).toBeGreaterThanOrEqual(47.5);
      }
      const send = page.getByRole("button", { name: "Send report" });
      expect((await send.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(47.5);
      await expect(send).toBeDisabled();
      const smallText = await page.evaluate(() =>
        [...document.querySelectorAll("main p, main h1, main label, main legend, main button, main a, main textarea, main input")]
          .filter((element) => (element.textContent ?? "").trim() !== "" || element.tagName === "TEXTAREA" || element.tagName === "INPUT")
          .filter((element) => parseFloat(getComputedStyle(element).fontSize) < 16)
          .map((element) => `${element.tagName}: ${element.textContent?.slice(0, 30)}`),
      );
      expect(smallText).toEqual([]);
      await allIsInsideTheScreen(page, width);

      await page.getByLabel("Facility closed").check();
      await expect(send).toBeEnabled();
      await send.click();

      await expect(page.getByText("Thank you. We'll check this listing.")).toBeVisible();
      expect(sent).toEqual([{ listing_id: expect.any(Number), reason: "closed" }]);
      await expect(page.getByRole("link", { name: "Back to the listing" })).toHaveAttribute("href", `/listing/${SLUG}`);
      await allIsInsideTheScreen(page, width);
    });

    test("the rate limit message shows and the form keeps the choice", async ({ page }) => {
      await page.route("http://localhost:8000/reports", async (route) => {
        await route.fulfill({
          status: 429,
          contentType: "application/json",
          headers: { "access-control-allow-origin": "*" },
          body: JSON.stringify({ detail: "You've sent several reports. Please try again later." }),
        });
      });
      await page.goto(`/report/${SLUG}`, { waitUntil: "load" });
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 60_000 });
      await page.getByLabel("Something else").check();
      await page.getByLabel(/Your phone number/).fill("0803 000 0000");

      await page.getByRole("button", { name: "Send report" }).click();

      await expect(page.getByText("You've sent several reports. Please try again later.")).toBeVisible();
      await expect(page.getByLabel("Something else")).toBeChecked();
      await expect(page.getByLabel(/Your phone number/)).toHaveValue("0803 000 0000");
      await allIsInsideTheScreen(page, width);
    });
  });
}

test("an unknown listing shows the not-found page, not the form", async ({ page }) => {
  await page.goto("/report/no-such-listing", { waitUntil: "load" });
  await expect(page.getByRole("heading", { name: "Listing not found" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("radio")).toHaveCount(0);
});
