/** The photos in the sections of the home page, in a real browser, at 320, 360, 768 and 1024 px. Requirements: US-13, NFR-01, NFR-10, NFR-13.
 * Spec: specs/2026-10-22-home-photos/ (requirements parts 2 to 5; plan, Task 4). It needs the site running (see playwright.config.ts); the home
 * page makes no API request. The unit tests read class names; this one measures the real layout, the real requests, the real layout shift and the
 * real movement. Lazy loading needs a real scroll: the checks scroll the page like a visitor.
 */
import { expect, test, type Page } from "@playwright/test";

const WIDTHS = [
  { width: 320, height: 640 },
  { width: 360, height: 740 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
];

const PHOTO_SELECTOR = 'main img[src^="/images/sections/"], main img[src^="/images/emergency/"]';

/** The page's own part (`main`) does not run past the screen (the header is left out on purpose: LOG.md, the fallback font between 344 and 370 px). */
async function allIsInsideTheScreen(page: Page, width: number): Promise<void> {
  const overflow = await page.evaluate(() => (document.querySelector("main")?.scrollWidth ?? 0) - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  for (const control of await page.locator("main h1, main h2, main a, main img").all()) {
    const box = await control.boundingBox();
    if (!box) continue;
    expect(box.x).toBeGreaterThanOrEqual(-0.5);
    expect(box.x + box.width).toBeLessThanOrEqual(width + 0.5);
  }
}

/** Scrolls to the bottom in steps, as a visitor would, so the lazy photos load and the observer fires. */
async function scrollThrough(page: Page): Promise<void> {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let top = 0; top < height; top += 300) {
    await page.evaluate((y) => window.scrollTo(0, y), top);
    await page.waitForTimeout(120);
  }
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(1200);
}

// A browser's own lazy loading starts a download a good way BEFORE the photo is on the screen (Chrome: about 1250 px on a fast connection), so
// the photos just under the hero are asked for at load. What native lazy loading guarantees is that the ones far down are NOT: the photos of the
// owners part and of the SwiftRescue part wait until the visitor scrolls near them.
test("the photos far down the page (SwiftRescue and the owners part) are not requested before the visitor scrolls", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  const images: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "image") images.push(new URL(request.url()).pathname);
  });

  await page.goto("/", { waitUntil: "load" });
  await page.waitForTimeout(1500);

  const farDown = ["/images/emergency/ambulance.webp", "/images/emergency/fire.webp", "/images/sections/pharmacy-counter-800.webp"];
  for (const path of farDown) expect(images, path).not.toContain(path);
  expect(images.some((path) => path.startsWith("/images/home/hero3"))).toBe(true);
});

test("the photos load as the visitor scrolls: all ten, each once", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  const images: string[] = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (request.resourceType() === "image" && (path.startsWith("/images/sections/") || path.startsWith("/images/emergency/"))) images.push(path);
  });
  await page.goto("/", { waitUntil: "load" });

  await scrollThrough(page);

  expect(new Set(images).size).toBe(8 + 2 - 0 - 0); // eight section photos and the two SwiftRescue photos
  expect(images).toHaveLength(new Set(images).size); // no file twice
});

for (const { width, height } of WIDTHS) {
  test.describe(`the home sections at ${width} px`, () => {
    test.use({ viewport: { width, height } });

    test("fit the screen, with every photo at its fixed ratio, the five credits at 16 px and 48 px, and nothing wider than the screen", async ({ page }) => {
      await page.goto("/", { waitUntil: "load" });
      await scrollThrough(page);

      await allIsInsideTheScreen(page, width);
      const photos = await page.locator(PHOTO_SELECTOR).all();
      expect(photos).toHaveLength(10);
      for (const photo of photos) {
        const box = (await photo.boundingBox())!;
        const ratio = box.width / box.height;
        const expected = (await photo.getAttribute("src"))!.includes("/emergency/") ? 8 / 3 : 3 / 2;
        expect(ratio, (await photo.getAttribute("src"))!).toBeCloseTo(expected, 1);
        expect(await photo.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0); // loaded, not broken
      }
      const credits = await page.getByRole("link", { name: /^Designed by Magnific/ }).all();
      expect(credits).toHaveLength(5);
      for (const credit of credits) {
        expect((await credit.boundingBox())!.height).toBeGreaterThanOrEqual(47.5);
        expect(await credit.evaluate((link) => getComputedStyle(link).fontSize)).toBe("16px");
      }
    });

    test("have the credit directly under hero2 and nothing under hero3 in How we verify", async ({ page }) => {
      await page.goto("/", { waitUntil: "load" });
      await scrollThrough(page);

      const section = page.locator("section", { has: page.getByRole("heading", { level: 2, name: "How we verify" }) });
      const pharmacists = section.locator('img[src*="pharmacists-screen"]');
      const stethoscope = section.locator('img[src*="stethoscope-800"]');
      const credit = section.getByRole("link", { name: /^Designed by Magnific/ });
      const [pharmacistsBox, stethoscopeBox, creditBox] = [await pharmacists.boundingBox(), await stethoscope.boundingBox(), await credit.boundingBox()];

      expect(creditBox!.y).toBeGreaterThanOrEqual(pharmacistsBox!.y + pharmacistsBox!.height - 1); // under hero2
      expect(creditBox!.x).toBeLessThan(pharmacistsBox!.x + pharmacistsBox!.width); // in hero2's column
      const horizontalOverlapWithHero3 = Math.min(creditBox!.x + creditBox!.width, stethoscopeBox!.x + stethoscopeBox!.width) - Math.max(creditBox!.x, stethoscopeBox!.x);
      const isUnderHero3 = creditBox!.y >= stethoscopeBox!.y + stethoscopeBox!.height - 1 && horizontalOverlapWithHero3 > 0;
      expect(isUnderHero3).toBe(false); // never under hero3
    });

    test("have no layout shift while the photos load and move into place (CLS 0)", async ({ page }) => {
      await page.addInitScript(() => {
        (window as unknown as { shift: number }).shift = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) {
            if (!entry.hadRecentInput) (window as unknown as { shift: number }).shift += entry.value;
          }
        }).observe({ type: "layout-shift", buffered: true });
      });
      await page.goto("/", { waitUntil: "load" });

      await scrollThrough(page);

      expect(await page.evaluate(() => (window as unknown as { shift: number }).shift)).toBe(0);
    });

    test("move into place when scrolled to, and with reduce motion nothing moves at all", async ({ page, browser }) => {
      await page.goto("/", { waitUntil: "load" });
      const photo = page.locator('main img[src*="pharmacy-counter"]');
      const wrapper = photo.locator("xpath=ancestor::div[contains(@class,'photo-reveal')]");

      await expect(wrapper).toHaveAttribute("data-reveal", "hidden"); // below the fold: waiting
      expect(await wrapper.evaluate((element) => getComputedStyle(element).opacity)).toBe("0");
      await photo.scrollIntoViewIfNeeded();
      await expect(wrapper).toHaveAttribute("data-reveal", "revealed");
      await expect.poll(async () => wrapper.evaluate((element) => getComputedStyle(element).opacity), { timeout: 5000 }).toBe("1");

      const calm = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce" });
      const calmPage = await calm.newPage();
      await calmPage.goto("/", { waitUntil: "load" });
      const calmWrapper = calmPage.locator('main img[src*="pharmacy-counter"]').locator("xpath=ancestor::div[contains(@class,'photo-reveal')]");
      expect(await calmWrapper.getAttribute("data-reveal")).toBeNull(); // the script never marked it
      expect(await calmWrapper.evaluate((element) => getComputedStyle(element).opacity)).toBe("1"); // shown at once, before any scroll
      expect(await calmWrapper.evaluate((element) => getComputedStyle(element).transform)).toBe("none");
      expect(await calmWrapper.evaluate((element) => getComputedStyle(element).transitionDuration)).toMatch(/^0s$/);
      await calm.close();
    });
  });
}

test("the hero is as it was: the gradient, the photo, the one Find care near me link, no search box, no slider, no credit", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/", { waitUntil: "load" });

  const hero = page.locator("main section").first();
  await expect(hero.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(hero.getByRole("link", { name: "Find care near me" })).toHaveAttribute("href", "/find");
  await expect(hero.locator("form, input, [role='search']")).toHaveCount(0);
  await expect(hero.getByRole("button")).toHaveCount(0);
  await expect(hero.getByRole("link", { name: /magnific/i })).toHaveCount(0);
  await expect(hero.locator("img")).toHaveCount(1);
  await expect(hero.locator("img")).toHaveAttribute("src", "/images/home/hero3.webp");
});

test("the Open SwiftRescue and How we verify links go to their pages", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  for (const [name, path] of [["Open SwiftRescue", "/emergency"], ["How we verify", "/how-we-verify"]] as const) {
    await page.goto("/", { waitUntil: "load" });
    await page.getByRole("main").getByRole("link", { name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`), { timeout: 30_000 });
  }
});

test("/search and /find show no picture at all", async ({ page }) => {
  for (const path of ["/search", "/search?category=clinic", "/search?category=pharmacy", "/search?category=laboratory", "/find"]) {
    await page.goto(path, { waitUntil: "load" });
    await page.waitForTimeout(500);
    await expect(page.locator("main img, main picture, main figure"), path).toHaveCount(0);
    await expect(page.getByRole("link", { name: /magnific/i }), path).toHaveCount(0);
  }
});
