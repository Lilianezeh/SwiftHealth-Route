/** The home page photo slider in a real browser, at 320, 360, 768 and 1024 px. Requirements: US-13, NFR-01, NFR-10, NFR-13.
 * Spec: specs/2026-10-22-home-photos/ (plan Task 5). It needs the site running (see playwright.config.ts); the home page makes no API request.
 * The unit tests read class names and drive fake timers; this one measures the real layout, the real fade, the real contrast of the
 * heading over every photo (sampled from the photo files with the overlay laid over them) and the layout shift.
 */
import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { join } from "node:path";

const WIDTHS = [
  { width: 320, height: 640 },
  { width: 360, height: 740 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
];

const SLIDE_NAMES = ["laboratory", "pharmacist", "stethoscope-capsules", "stethoscope", "pharmacy-counter", "consultation", "pharmacists", "nurse"];

/** The page's own part (`main`) does not run past the screen. The header is left out on purpose (a known width problem of this machine's
 * fallback font between 344 and 370 px, see LOG.md). */
async function allIsInsideTheScreen(page: Page, width: number): Promise<void> {
  const overflow = await page.evaluate(() => (document.querySelector("main")?.scrollWidth ?? 0) - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  for (const control of await page.locator("main h1, main h2, main button, main a, main input").all()) {
    const box = await control.boundingBox();
    if (!box) continue;
    expect(box.x).toBeGreaterThanOrEqual(-0.5);
    expect(box.x + box.width).toBeLessThanOrEqual(width + 0.5);
  }
}

/** The alt text of the photo that is shown now (the others have none). */
async function shownPhoto(page: Page): Promise<string> {
  return page.evaluate(() => [...document.querySelectorAll("[data-slide] img")].map((image) => (image as HTMLImageElement).alt).find((alt) => alt !== "") ?? "");
}

for (const { width, height } of WIDTHS) {
  test.describe(`the home hero at ${width} px`, () => {
    test.use({ viewport: { width, height } });

    test("shows the first photo, the heading, the search form and the credit inside the screen", async ({ page }) => {
      await page.goto("/", { waitUntil: "load" });

      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByRole("searchbox", { name: "Search by name" })).toBeVisible();
      await expect(page.getByRole("link", { name: /^Designed by Magnific/ })).toBeVisible();
      await expect(page.locator("[data-slide] img").first()).toHaveJSProperty("complete", true);
      await allIsInsideTheScreen(page, width);
    });

    test("every control is 48 px high and the credit is 16 px text", async ({ page }) => {
      await page.goto("/", { waitUntil: "load" });
      await expect(page.getByRole("button", { name: "Pause photos" })).toBeVisible();

      for (const control of [page.getByRole("button", { name: "Pause photos" }), page.getByRole("searchbox"), page.getByRole("button", { name: "Search" }),
        page.getByRole("link", { name: /^Designed by Magnific/ }), page.getByRole("link", { name: "Find care near me" })]) {
        expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(47.5);
      }
      for (const dot of await page.getByRole("group", { name: "Choose a photo" }).getByRole("button").all()) {
        const box = (await dot.boundingBox())!;
        expect(box.height).toBeGreaterThanOrEqual(47.5);
        expect(box.width).toBeGreaterThanOrEqual(24); // WCAG 2.2 target size
      }
      expect(await page.getByRole("link", { name: /^Designed by Magnific/ }).evaluate((link) => getComputedStyle(link).fontSize)).toBe("16px");
    });

    test("changes the photo with the fade, holds it on Pause and shows the one a dot picks (a fast clock)", async ({ page }) => {
      await page.clock.install();
      await page.goto("/", { waitUntil: "load" });
      await expect(page.getByRole("button", { name: "Pause photos" })).toBeVisible();
      const first = await shownPhoto(page);

      await page.clock.runFor(6_300);
      const second = await shownPhoto(page);
      expect(second).not.toBe(first);
      expect(second).not.toBe("");

      await page.getByRole("button", { name: "Pause photos" }).click();
      await page.clock.runFor(30_000);
      expect(await shownPhoto(page)).toBe(second);
      await page.getByRole("button", { name: "Play photos" }).click();

      await page.getByRole("button", { name: /^Show photo 5 of 8/ }).click();
      await expect(page.getByRole("button", { name: /^Show photo 5 of 8/ })).toHaveAttribute("aria-current", "true");
      expect(await shownPhoto(page)).toContain("smiling pharmacist");
    });

    test("reduce motion: one still photo, no Pause button, no dots, and the credit stays", async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce" });
      const page = await context.newPage();
      await page.goto("/", { waitUntil: "load" });
      await page.waitForTimeout(8_000);

      expect(await page.locator("[data-slide] img").count()).toBe(1);
      await expect(page.getByRole("button", { name: /Pause|Play|Show photo/ })).toHaveCount(0);
      await expect(page.getByRole("link", { name: /^Designed by Magnific/ })).toBeVisible();
      await context.close();
    });

    test("no layout shift while the photos load and change", async ({ page }) => {
      await page.addInitScript(() => {
        (window as unknown as { shift: number }).shift = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) {
            if (!entry.hadRecentInput) (window as unknown as { shift: number }).shift += entry.value;
          }
        }).observe({ type: "layout-shift", buffered: true });
      });
      await page.goto("/", { waitUntil: "load" });
      await page.waitForTimeout(8_000);

      expect(await page.evaluate(() => (window as unknown as { shift: number }).shift)).toBe(0);
    });
  });
}

test("a hidden tab stops the photos", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.clock.install();
  await page.goto("/", { waitUntil: "load" });
  await expect(page.getByRole("button", { name: "Pause photos" })).toBeVisible();
  const first = await shownPhoto(page);

  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.runFor(40_000);

  expect(await shownPhoto(page)).toBe(first);
});

// The heading is white on the overlay. From 1024 px the photo is behind the text, so every photo is sampled: the photo's pixels under the
// text column, with the overlay laid over them (80% pine-dark under the text), must give 4.5:1 at the lightest pixel. Under 1024 px the text
// is on the gradient and no photo is behind it, so the gradient's own ends are what count (checked in the unit tests).
test("white text is readable over every photo at 1024 px: even the lightest pixel under the text column gets 4.5:1", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/", { waitUntil: "load" });
  const column = (await page.getByRole("heading", { level: 1 }).evaluate((heading) => {
    const box = (heading.parentElement as HTMLElement).getBoundingClientRect();
    const hero = (heading.closest("section") as HTMLElement).getBoundingClientRect();
    return { left: box.left / hero.width, right: box.right / hero.width, top: (box.top - hero.top) / hero.height, bottom: (box.bottom - hero.top) / hero.height };
  }));
  const overlay = await page.evaluate(() => {
    const classes = [...document.querySelectorAll("section div")].map((element) => element.className).find((name) => String(name).includes("lg:from-pine-dark")) as string;
    return Number(/lg:from-pine-dark\/(\d+)/.exec(classes)![1]) / 100;
  });
  const pineDark = [0x13, 0x4f, 0x6a];
  const luminance = (rgb: number[]) => {
    const [r, g, b] = rgb.map((value) => { const c = value / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  for (const name of SLIDE_NAMES) {
    const file = join(process.cwd(), "public", "images", "hero", `hero-${name}-1280.webp`);
    const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
    let lightest = 0;
    // Only the left half of the photo carries the text (the column is at most half the hero), cut at the heading's top and bottom.
    for (let y = Math.floor(info.height * column.top); y < Math.min(info.height, Math.ceil(info.height * column.bottom)); y += 4) {
      for (let x = Math.floor(info.width * column.left); x < Math.ceil(info.width * column.right); x += 4) {
        const at = (y * info.width + x) * info.channels;
        const covered = [0, 1, 2].map((channel) => overlay * pineDark[channel] + (1 - overlay) * data[at + channel]);
        lightest = Math.max(lightest, luminance(covered));
      }
    }
    expect((1 + 0.05) / (lightest + 0.05), `${name}: ${((1.05) / (lightest + 0.05)).toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
  }
});

test("the search form goes to /search with the typed text", async ({ page }) => {
  await page.goto("/", { waitUntil: "load" });
  await page.getByRole("searchbox", { name: "Search by name" }).fill("pharmacy");
  await page.getByRole("button", { name: "Search" }).click();

  await expect(page).toHaveURL(/\/search\?q=pharmacy/);
  await expect(page.locator("main img, main picture, main figure")).toHaveCount(0);
});

test("the three feature cards open the Find, SwiftRescue and Blood pages", async ({ page }) => {
  for (const [name, path] of [["Find care", "/find"], ["SwiftRescue emergency numbers", "/emergency"], ["Find blood", "/blood"]] as const) {
    await page.goto("/", { waitUntil: "load" });
    await page.getByRole("link", { name }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
  }
});
