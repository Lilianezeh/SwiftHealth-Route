/** The installable app in a real browser. Requirements: NFR-03, NFR-04, NFR-10. Spec: specs/2026-11-02-installable-pwa/.
 * The unit tests (Vitest, jsdom) check the rules; this one opens the real pages: the manifest and the offline page are served, the
 * "Install app" row and the home card appear when the browser says the site can be installed, they sit beside the new header and footer
 * (no Log in or Sign up in the header, Staff portal in the footer), nothing scrolls sideways at 320 px, and Light and Dark both work.
 * The browser's own install event is sent by the test (a real Chrome only sends it on an installable HTTPS or localhost production
 * build); the service worker itself registers only in a production build, so it is checked by hand (validation.md).
 * Run: `npx playwright test pwa.spec.ts --workers=1` with the site running (see playwright.config.ts).
 */
import { expect, test, type Page } from "@playwright/test";

import { pinFont } from "../helpers/pinnedFont";

test.beforeEach(async ({ page }) => pinFont(page));

const WIDTHS = [320, 375];
const THEMES = ["light", "dark"] as const;

/** What Chrome sends when the site can be installed: an event with prompt() and userChoice. */
async function sendInstallEventUntilSeen(page: Page, isShown: () => Promise<void>) {
  // The page's listener is added once the page is interactive, so the event is sent again until the page shows its reaction.
  await expect(async () => {
    await page.evaluate(() => {
      const installEvent = new Event("beforeinstallprompt", { cancelable: true });
      Object.assign(installEvent, {
        prompt: async () => {
          (window as unknown as { installPromptCalls: number }).installPromptCalls =
            ((window as unknown as { installPromptCalls?: number }).installPromptCalls ?? 0) + 1;
        },
        userChoice: Promise.resolve({ outcome: "dismissed" }),
      });
      window.dispatchEvent(installEvent);
    });
    await isShown();
  }).toPass({ timeout: 30_000 });
}

async function noSidewaysScroll(page: Page) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
}

test.describe("the files", () => {
  test("the manifest names the app, starts at '/', and its icons and shortcuts open", async ({ request }) => {
    const response = await request.get("/manifest.webmanifest");
    expect(response.ok()).toBe(true);
    const manifest = await response.json();

    expect(manifest).toMatchObject({
      name: "SwiftHealth Route",
      short_name: "SwiftHealth",
      start_url: "/",
      scope: "/",
      display: "standalone",
      background_color: "#f6f3ec",
    });
    expect(manifest.icons.map((icon: { purpose: string; sizes: string }) => `${icon.sizes} ${icon.purpose}`).sort()).toEqual([
      "192x192 any",
      "192x192 maskable",
      "512x512 any",
      "512x512 maskable",
    ]);
    expect(manifest.shortcuts.map((shortcut: { name: string; url: string }) => [shortcut.name, shortcut.url])).toEqual([
      ["SwiftRescue", "/emergency"],
      ["Find care", "/find"],
    ]);
    for (const icon of manifest.icons) expect((await request.get(icon.src)).headers()["content-type"]).toContain("image/png");
    expect((await request.get("/apple-icon.png")).ok()).toBe(true);
    expect((await request.get("/sw.js")).ok()).toBe(true);
  });

  test("the offline page says the words and keeps 112 one tap away, with no sideways scroll at 320 px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto("/offline.html");

    await expect(page.getByText("You're offline. SwiftRescue still works: call 112.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Call 112" })).toHaveAttribute("href", "tel:112");
    await expect(page.getByRole("link", { name: "Open SwiftRescue" })).toHaveAttribute("href", "/emergency");
    const buttonHeight = (await page.getByRole("button", { name: "Try again" }).boundingBox())?.height ?? 0;
    expect(buttonHeight).toBeGreaterThanOrEqual(48);
    await noSidewaysScroll(page);
  });
});

for (const theme of THEMES) {
  for (const width of WIDTHS) {
    test.describe(`${theme}, ${width} px`, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width, height: 700 });
        await page.addInitScript((chosen) => window.localStorage.setItem("swifthealth.theme", chosen), theme);
      });

      test("the Menu has Install app before the Theme row; the header has no Log in or Sign up; the footer has Staff portal", async ({ page }) => {
        await page.goto("/about", { waitUntil: "load" });
        await page.getByRole("button", { name: "Menu" }).click(); // opened once; the row appears in the open panel when the event is heard
        await sendInstallEventUntilSeen(page, async () => {
          await expect(page.getByRole("button", { name: "Install app" })).toBeVisible({ timeout: 1_000 });
        });

        const menu = page.getByRole("navigation", { name: "Menu links" });
        await expect(menu.getByRole("link", { name: /^(Log in|Sign up)$/ })).toHaveCount(0);
        const rows = await menu.locator("li").allTextContents();
        expect(rows.at(-2)).toContain("Install app");
        const installHeight = (await menu.getByRole("button", { name: "Install app" }).boundingBox())?.height ?? 0;
        expect(installHeight).toBeGreaterThanOrEqual(48);
        await expect(page.getByRole("link", { name: "Staff portal" })).toBeVisible();
        await noSidewaysScroll(page);

        await menu.getByRole("button", { name: "Install app" }).click();
        await expect(menu).toHaveCount(0); // the Menu closes, so the browser's own question is not hidden behind it
        expect(await page.evaluate(() => (window as unknown as { installPromptCalls?: number }).installPromptCalls)).toBe(1);
      });

      test("the home page shows the install card once, below the content, and 'Not now' keeps it away after a reload", async ({ page }) => {
        await page.goto("/", { waitUntil: "load" });
        const card = page.getByRole("region", { name: "Install the app" });
        await sendInstallEventUntilSeen(page, async () => {
          await expect(card).toBeAttached({ timeout: 1_000 });
        });

        await card.scrollIntoViewIfNeeded();
        await expect(card.getByRole("button", { name: "Install app" })).toBeVisible();
        const position = await card.evaluate((element) => getComputedStyle(element).position);
        expect(position).toBe("static"); // part of the page: it covers nothing
        for (const name of ["Install app", "Not now"]) {
          const height = (await card.getByRole("button", { name }).boundingBox())?.height ?? 0;
          expect(height).toBeGreaterThanOrEqual(48);
        }
        await noSidewaysScroll(page);

        await card.getByRole("button", { name: "Not now" }).click();
        await expect(card).toHaveCount(0);
        await page.reload({ waitUntil: "load" });
        await page.waitForTimeout(1_500); // give the page time to hear the install event again, if it were going to show the card
        await page.evaluate(() => window.dispatchEvent(new Event("beforeinstallprompt", { cancelable: true })));
        await expect(card).toHaveCount(0);
      });
    });
  }
}

test.describe("iPhone Safari", () => {
  test.use({
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    viewport: { width: 375, height: 700 },
    hasTouch: true,
  });

  test("the Menu and the home card say 'Tap Share, then Add to Home Screen' instead of a button", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    const card = page.getByRole("region", { name: "Install the app" });
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(card).toContainText("Tap Share, then Add to Home Screen");
    await expect(card.getByRole("button", { name: "Install app" })).toHaveCount(0);

    await page.getByRole("button", { name: "Menu" }).click();
    await expect(page.getByRole("navigation", { name: "Menu links" })).toContainText("Tap Share, then Add to Home Screen");
  });
});
