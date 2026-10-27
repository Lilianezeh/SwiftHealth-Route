/** The information pages and the accessibility pass in a real browser, at 320, 360, 768 and 1024 px. Requirements: FR-23, NFR-10,
 * NFR-12, NFR-04. Spec: specs/2026-10-20-info-pages/ (plan Task 4). It needs the site running (playwright.config.ts); no API is needed.
 */
import { expect, test } from "@playwright/test";

import { allIsInsideTheScreen, targetsAndTextAreBigEnough } from "../helpers/browserApi";

const WIDTHS = [
  { width: 320, height: 640 },
  { width: 360, height: 740 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
];

const PAGES = [
  { path: "/about", h1: "About", title: "About | SwiftHealth Route" },
  { path: "/how-we-verify", h1: "How we verify", title: "How we verify | SwiftHealth Route" },
  { path: "/privacy", h1: "Privacy policy", title: "Privacy policy | SwiftHealth Route" },
  { path: "/terms", h1: "Terms of use", title: "Terms of use | SwiftHealth Route" },
  { path: "/contact", h1: "Contact us", title: "Contact us | SwiftHealth Route" },
  { path: "/for-facilities", h1: "For facilities", title: "For facilities | SwiftHealth Route" },
];

for (const { width, height } of WIDTHS) {
  test.describe(`information pages at ${width} px`, () => {
    test.use({ viewport: { width, height } });

    for (const { path, h1, title } of PAGES) {
      test(`${path}: one heading, the title, nothing sideways, readable text and big links`, async ({ page }) => {
        await page.goto(path, { waitUntil: "load" });

        await expect(page.getByRole("heading", { level: 1, name: h1 })).toBeVisible({ timeout: 60_000 });
        await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
        await expect(page).toHaveTitle(title);
        expect(await page.locator('meta[name="description"]').getAttribute("content")).toBeTruthy();
        await allIsInsideTheScreen(page, width);
        await targetsAndTextAreBigEnough(page);
      });
    }

    test("Privacy and Terms show the notice that no lawyer has reviewed them yet", async ({ page }) => {
      for (const path of ["/privacy", "/terms"]) {
        await page.goto(path, { waitUntil: "load" });
        await expect(page.getByRole("note")).toContainText("It has not yet been reviewed by a lawyer.", { timeout: 60_000 });
      }
    });

    test("the skip link is the first Tab stop, shows when focused, and moves focus to the main part", async ({ page }) => {
      await page.goto("/about", { waitUntil: "load" });
      await expect(page.getByRole("heading", { level: 1, name: "About" })).toBeVisible({ timeout: 60_000 });

      await page.keyboard.press("Tab");
      const skip = page.getByRole("link", { name: "Skip to main content" });
      await expect(skip).toBeFocused();
      const box = await skip.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(47.5);
      expect((box?.x ?? -1) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
      await page.keyboard.press("Enter");

      expect(await page.evaluate(() => document.activeElement?.id)).toBe("main");
    });
  });
}

test("robots.txt keeps the staff areas out, and sitemap.xml lists the static pages", async ({ request }) => {
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /admin/");
  expect(robots).toContain("Disallow: /provider/");
  expect(robots).toContain("Sitemap: https://swifthealth-ng.netlify.app/sitemap.xml");

  const sitemap = await (await request.get("/sitemap.xml")).text();
  for (const path of ["/about", "/how-we-verify", "/privacy", "/terms", "/contact", "/emergency", "/find", "/list-your-facility", "/for-facilities"]) {
    expect(sitemap).toContain(`https://swifthealth-ng.netlify.app${path}`);
  }
  expect(sitemap).not.toContain("/admin");
});

test("the staff pages say noindex", async ({ page }) => {
  await page.goto("/log-in", { waitUntil: "load" });
  expect(await page.locator('meta[name="robots"]').getAttribute("content")).toContain("noindex");
});
