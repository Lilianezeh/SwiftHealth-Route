/** The faint background slideshow behind "Find by type", in a real browser, at 320, 360, 768 and 1024 px. Requirements: US-13, NFR-01, NFR-10,
 * NFR-13. Spec: specs/2026-10-22-home-photos/ (revision 4; plan, Task 3). It needs the site running (see playwright.config.ts); the home page makes
 * no API request. The unit tests read class names and drive fake timers; this one measures the real layout, the real requests, the real layout
 * shift, the real fade and the real pixels of the photos.
 */
import { expect, test, type Page } from "@playwright/test";
import { join } from "node:path";
import sharp from "sharp";

const WIDTHS = [
  { width: 320, height: 640 },
  { width: 360, height: 740 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
];

const BACKDROP_FILES = ["nurse-corridor", "doctor-and-patient", "consultation", "laboratory", "pharmacist-customer"];
const PINE_50 = [0xee, 0xf6, 0xfa]; // --color-pine-50
const PINE_DARK = [0x13, 0x4f, 0x6a]; // --color-pine-dark

/** The page's own part (`main`) does not run past the screen (the header is left out on purpose: LOG.md, the fallback font between 344 and 370 px). */
async function allIsInsideTheScreen(page: Page, width: number): Promise<void> {
  const overflow = await page.evaluate(() => (document.querySelector("main")?.scrollWidth ?? 0) - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  for (const control of await page.locator("main h1, main h2, main button, main a").all()) {
    const box = await control.boundingBox();
    if (!box) continue;
    expect(box.x).toBeGreaterThanOrEqual(-0.5);
    expect(box.x + box.width).toBeLessThanOrEqual(width + 0.5);
  }
}

const slideshowSection = (page: Page) => page.locator("section", { has: page.getByRole("heading", { level: 2, name: "Find by type" }) });

/** The index of the photo that is shown now (the slide with full opacity), among the slides in the page. */
async function shownPhoto(page: Page): Promise<string> {
  return page.evaluate(() => {
    const slides = [...document.querySelectorAll("[data-backdrop-slide]")] as HTMLElement[];
    const shown = slides.find((slide) => Number(getComputedStyle(slide).opacity) > 0.5 && /\bopacity-100\b/.test(slide.className));
    return shown?.querySelector("img")?.getAttribute("src") ?? "";
  });
}

async function scrollToSlideshow(page: Page): Promise<void> {
  await slideshowSection(page).scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
}

test("the slideshow's photos are not requested before the section is near the screen (a phone, no scroll)", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  const images: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "image") images.push(new URL(request.url()).pathname);
  });

  await page.goto("/", { waitUntil: "load" });
  await page.waitForTimeout(1500);

  expect(images.filter((path) => path.startsWith("/images/backdrop/"))).toEqual([]);
  expect(images.some((path) => path.startsWith("/images/home/hero3"))).toBe(true);
});

test("near the section, only the first photo is asked for; the others come later, one ahead, and none twice", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  const images: string[] = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (request.resourceType() === "image" && path.startsWith("/images/backdrop/")) images.push(path);
  });
  await page.goto("/", { waitUntil: "load" });

  await scrollToSlideshow(page);

  expect(images[0]).toBe("/images/backdrop/nurse-corridor-960.webp");
  expect(images.length).toBeLessThanOrEqual(2); // the first, and at most the second (added once the first has loaded)
  expect(new Set(images).size).toBe(images.length);
});

for (const { width, height } of WIDTHS) {
  test.describe(`the slideshow at ${width} px`, () => {
    test.use({ viewport: { width, height } });

    test("fits the screen, is faint and behind the tiles, with the Pause button and the credit at 48 px high and 16 px text", async ({ page }) => {
      await page.goto("/", { waitUntil: "load" });
      await scrollToSlideshow(page);

      await allIsInsideTheScreen(page, width);
      const section = slideshowSection(page);
      const layer = section.locator("[data-backdrop]");
      expect(await layer.evaluate((element) => getComputedStyle(element).opacity)).toBe("0.18");
      expect(await layer.evaluate((element) => getComputedStyle(element).pointerEvents)).toBe("none");
      const layerBox = (await layer.boundingBox())!;
      const sectionBox = (await section.boundingBox())!;
      expect(Math.abs(layerBox.width - sectionBox.width)).toBeLessThan(1);
      expect(Math.abs(layerBox.height - sectionBox.height)).toBeLessThan(1); // it covers the whole section, behind the content
      const pause = section.getByRole("button", { name: "Pause photos" });
      const credit = section.getByRole("link", { name: /^Designed by Magnific/ });
      await expect(pause).toBeVisible();
      for (const control of [pause, credit]) {
        expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(47.5);
        expect(await control.evaluate((element) => getComputedStyle(element).fontSize)).toBe("16px");
      }
      const tilesBox = (await section.getByRole("link", { name: "Clinic" }).boundingBox())!;
      expect(tilesBox.y).toBeLessThan((await pause.boundingBox())!.y); // the controls are after the tiles
    });

    test("changes photo with a 1.5 s fade, holds on Pause, and a hidden tab stops it (a fast clock)", async ({ page }) => {
      await page.clock.install();
      await page.goto("/", { waitUntil: "load" });
      await scrollToSlideshow(page);
      const pause = page.getByRole("button", { name: "Pause photos" });
      await expect(pause).toBeVisible();
      await page.clock.pauseAt(new Date(Date.now() + 2000));
      await page.clock.runFor(1000);
      const first = await shownPhoto(page);
      expect(first).toContain("nurse-corridor");

      await page.clock.runFor(8000);
      const second = await shownPhoto(page);
      expect(second).toContain("doctor-and-patient");

      await pause.click();
      await page.clock.runFor(30_000);
      expect(await shownPhoto(page)).toBe(second);
      await page.getByRole("button", { name: "Play photos" }).click();

      await page.evaluate(() => {
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await page.clock.runFor(30_000);
      expect(await shownPhoto(page)).toBe(second);
    });

    test("with reduce motion: one still faint photo, no other photo in the page, no Pause button, the credit stays", async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce" });
      const page = await context.newPage();
      await page.goto("/", { waitUntil: "load" });
      await scrollToSlideshow(page);
      await page.waitForTimeout(9000);

      expect(await slideshowSection(page).locator("[data-backdrop] img").count()).toBe(1);
      expect(await shownPhoto(page)).toContain("nurse-corridor");
      await expect(page.getByRole("button", { name: /Pause|Play/ })).toHaveCount(0);
      await expect(page.getByRole("link", { name: /^Designed by Magnific/ })).toBeVisible();
      await context.close();
    });

    test("has no layout shift while the photos load and change (CLS 0)", async ({ page }) => {
      await page.addInitScript(() => {
        (window as unknown as { shift: number }).shift = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) {
            if (!entry.hadRecentInput) (window as unknown as { shift: number }).shift += entry.value;
          }
        }).observe({ type: "layout-shift", buffered: true });
      });
      await page.goto("/", { waitUntil: "load" });

      await scrollToSlideshow(page);
      await page.waitForTimeout(9000);
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(500);

      expect(await page.evaluate(() => (window as unknown as { shift: number }).shift)).toBe(0);
    });
  });
}

test("the heading and credit pass AA over every photo, even its darkest pixel, at 18% over the section's light blue", async () => {
  const luminance = (rgb: number[]) => {
    const [r, g, b] = rgb.map((value) => {
      const channel = value / 255;
      return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  for (const name of BACKDROP_FILES) {
    const { data, info } = await sharp(join(process.cwd(), "public", "images", "backdrop", `${name}-960.webp`)).raw().toBuffer({ resolveWithObject: true });
    let darkest = 1;
    for (let at = 0; at < data.length; at += info.channels * 7) {
      const composite = [0, 1, 2].map((channel) => 0.18 * data[at + channel] + 0.82 * PINE_50[channel]);
      darkest = Math.min(darkest, luminance(composite));
    }
    const ratio = (darkest + 0.05) / (luminance(PINE_DARK) + 0.05);
    expect(ratio, `${name}: ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
  }
});

test("the hero and the owners part are as on main: hero3 in the hero, the hero4 portrait at the owners part, no other photo and one credit", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/", { waitUntil: "load" });

  const hero = page.locator("main section").first();
  await expect(hero.locator("img")).toHaveCount(1);
  await expect(hero.locator("img")).toHaveAttribute("src", "/images/home/hero3.webp");
  await expect(hero.getByRole("link", { name: "Find care near me" })).toHaveAttribute("href", "/find");
  await expect(hero.locator("form, input, button")).toHaveCount(0);
  await expect(page.locator('main img[src="/images/home/hero4-portrait.webp"]')).toHaveCount(1);
  const sources = await page.locator("main img").evaluateAll((images) => images.map((image) => image.getAttribute("src")));
  expect(sources.filter((source) => !source?.startsWith("/images/backdrop/")).sort()).toEqual(["/images/home/hero3.webp", "/images/home/hero4-portrait.webp"]);
  await expect(page.getByRole("link", { name: /magnific/i })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 2, name: /How we verify|SwiftRescue/ })).toHaveCount(0);
});

test("/search and /find show no picture at all", async ({ page }) => {
  for (const path of ["/search", "/search?category=clinic", "/search?category=pharmacy", "/search?category=laboratory", "/find"]) {
    await page.goto(path, { waitUntil: "load" });
    await page.waitForTimeout(500);
    await expect(page.locator("main img, main picture, main figure"), path).toHaveCount(0);
    await expect(page.getByRole("link", { name: /magnific/i }), path).toHaveCount(0);
  }
});
