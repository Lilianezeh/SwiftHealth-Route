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
const FOREST = [0x1b, 0x6f, 0x93]; // --color-forest, the colour of the heading
const PINE_50 = [0xee, 0xf6, 0xfa]; // --color-pine-50, the section's colour
const PINE_100 = [0xdc, 0xec, 0xf4]; // --color-pine-100, the tint over the photos

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
    // The class says which one is shown (the fade is a CSS transition, which the fake clock does not drive).
    const shown = slides.find((slide) => /\bopacity-100\b/.test(slide.className));
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

  expect(images[0]).toBe("/images/backdrop/nurse-corridor-800.webp"); // a phone takes the 800 px file, never the 1600 px one
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
      expect(await layer.evaluate((element) => getComputedStyle(element).opacity)).toBe("0.45"); // the owner's choice
      expect(await layer.evaluate((element) => getComputedStyle(element).pointerEvents)).toBe("none");
      const frameBox = (await section.locator("[data-backdrop-frame]").boundingBox())!;
      const sectionBox = (await section.boundingBox())!;
      expect(Math.abs(frameBox.width - sectionBox.width)).toBeLessThan(1);
      // Under 1024 px the photos are a 3:2 band at the top (shown whole); from 1024 px they fill the whole section behind the cards.
      const bandHeight = width < 1024 ? (sectionBox.width * 2) / 3 : sectionBox.height;
      expect(Math.abs(frameBox.height - bandHeight)).toBeLessThan(1);
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

    test("has the heading and the cards in the lower part, the real height equal to the size kept for it (CLS 0), and everything inside it", async ({ page }) => {
      await page.goto("/", { waitUntil: "load" });
      await scrollToSlideshow(page);

      const section = slideshowSection(page);
      const sectionBox = (await section.boundingBox())!;
      // The kept size (globals.css): 51.67% of the width + 802 px under 768 px, + 564 px from 768 px, 760 px from 1024 px.
      const expected = width < 768 ? 0.5167 * width + 802 : width < 1024 ? 0.5167 * width + 564 : 760;
      expect(Math.abs(sectionBox.height - expected), `${width} px: ${sectionBox.height}`).toBeLessThanOrEqual(1.5);
      const pause = (await section.getByRole("button", { name: "Pause photos" }).boundingBox())!;
      const credit = (await section.getByRole("link", { name: /^Designed by Magnific/ }).boundingBox())!;
      const heading = (await section.getByRole("heading", { level: 2 }).boundingBox())!;
      const tiles = await section.getByRole("link", { name: /Hospital|Clinic|Maternity|Pharmacy|Laboratory/ }).all();
      expect(tiles).toHaveLength(5);
      const boxes = [pause, credit, heading, ...(await Promise.all(tiles.map(async (tile) => (await tile.boundingBox())!)))];
      for (const box of boxes) {
        expect(box.y).toBeGreaterThanOrEqual(sectionBox.y - 0.5);
        expect(box.y + box.height).toBeLessThanOrEqual(sectionBox.y + sectionBox.height + 0.5);
      }
      for (const tile of boxes.slice(3)) expect(Math.abs(tile.height - 190)).toBeLessThanOrEqual(1); // 190 px high cards
      if (width >= 768) expect(Math.abs(pause.y - credit.y)).toBeLessThan(4); // Pause and the credit share one row from 768 px
      else expect(credit.y).toBeGreaterThan(pause.y + pause.height - 1); // and are in two rows on a phone, whatever the width
      // The heading is in the lower part: from 1024 px at least 40% down the section, under 1024 px it starts 77% of the way down the photo band
      // (15% of the width above the band's end), so that the faces (in the upper part of each photo) are above it.
      const headingTop = heading.y - sectionBox.y;
      if (width >= 1024) expect(headingTop).toBeGreaterThanOrEqual(0.4 * sectionBox.height);
      else expect(headingTop).toBeGreaterThanOrEqual(0.75 * ((sectionBox.width * 2) / 3));
      if (width >= 1024) {
        const rowTops = new Set(boxes.slice(3).map((box) => Math.round(box.y)));
        expect(rowTops.size).toBe(1); // one row of five on a laptop
      } else if (width < 768) {
        const lastTile = boxes[boxes.length - 1];
        expect(Math.abs(lastTile.x + lastTile.width / 2 - (sectionBox.x + sectionBox.width / 2))).toBeLessThanOrEqual(2); // the last tile of a phone is in the middle
      } else {
        const [fourth, fifth] = boxes.slice(-2); // on a tablet the last row of two is in the middle
        expect(Math.abs((fourth.x + fifth.x + fifth.width) / 2 - (sectionBox.x + sectionBox.width / 2))).toBeLessThanOrEqual(2);
      }
    });

    test("puts the heading on a soft white backing and gives the first photo its focus point for this screen", async ({ page }) => {
      await page.goto("/", { waitUntil: "load" });
      await scrollToSlideshow(page);

      const section = slideshowSection(page);
      const heading = section.getByRole("heading", { level: 2, name: "Find by type" });
      // White at 90% (Chrome writes the colour of `bg-white/90` as oklab(0.99… / 0.9) or rgba(255, 255, 255, 0.9)).
      const backing = await heading.evaluate((element) => getComputedStyle(element).backgroundColor);
      expect(backing).toMatch(/^(oklab\(0\.99\d* [-0-9.e]+ [-0-9.e]+ \/ 0\.9\)|rgba\(255, 255, 255, 0\.9\))$/);
      expect(await heading.evaluate((element) => getComputedStyle(element).color)).toBe("rgb(27, 111, 147)"); // forest, as it was
      const image = section.locator("[data-backdrop] img").first();
      expect(await image.evaluate((element) => getComputedStyle(element).objectPosition)).toBe(width >= 1024 ? "50% 0%" : "50% 50%"); // the focus point is used where the photo is cropped
      // A phone and a tablet take the 800 px file, a wide screen the 1600 px one (srcset and sizes).
      expect(await image.evaluate((element) => (element as HTMLImageElement).currentSrc)).toContain(width >= 1024 ? "-1600.webp" : "-800.webp");
      // The tint over the photos is the light brand blue (pine-100 at 40%), the section's own colour is pine-50.
      expect(await section.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe("rgb(238, 246, 250)");
      expect(await section.locator("[data-backdrop-tint]").evaluate((element) => getComputedStyle(element).backgroundColor)).toMatch(/\/ 0\.4\)$|, 0\.4\)$/);
    });

    test("has cards of 190 px with 20 px names, a 16 px line, icons of 56 px (64 px from 768 px), a pause icon, and a gentle lift on hover", async ({ page }) => {
      await page.goto("/", { waitUntil: "load" });
      await scrollToSlideshow(page);

      const section = slideshowSection(page);
      const card = section.getByRole("link", { name: "Hospital" });
      const [name, line] = [card.locator("#type-name-hospital"), card.locator("#type-line-hospital")];
      expect(await name.evaluate((element) => getComputedStyle(element).fontSize)).toBe("20px");
      expect(await line.evaluate((element) => getComputedStyle(element).fontSize)).toBe("16px");
      expect(await line.textContent()).toBe("Admission, surgery and emergency care");
      const iconBox = (await card.locator("span").first().boundingBox())!;
      expect(Math.round(iconBox.width)).toBe(width >= 768 ? 64 : 56);
      // No label, line or card overflows (the longest words at 320 px).
      for (const element of await section.locator("li a, li a span").all()) {
        expect(await element.evaluate((node) => node.scrollWidth <= node.clientWidth + 1 && node.scrollHeight <= node.clientHeight + 1)).toBe(true);
      }
      await expect(section.getByRole("button", { name: "Pause photos" }).locator("svg")).toHaveCount(1);
      // Tailwind 4 lifts with the CSS `translate` property: "none" at rest, "0px -4px" (4 px up) on hover.
      const before = await card.evaluate((element) => getComputedStyle(element).translate);
      await card.hover();
      await page.waitForTimeout(400);
      const lifted = await card.evaluate((element) => getComputedStyle(element).translate);
      expect(before).toBe("none");
      expect(lifted).toBe("0px -4px");
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
      await page.waitForTimeout(300); // real time: lets the page draw again (and drop its timer) before the fast clock runs
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

test("the heading passes AA over every photo, even its darkest pixel, at 45% over the light blue, under the blue tint and its 90% white backing", async () => {
  const luminance = (rgb: number[]) => {
    const [r, g, b] = rgb.map((value) => {
      const channel = value / 255;
      return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  for (const name of BACKDROP_FILES) {
    const { data, info } = await sharp(join(process.cwd(), "public", "images", "backdrop", `${name}-800.webp`)).raw().toBuffer({ resolveWithObject: true });
    let darkest = 1;
    for (let at = 0; at < data.length; at += info.channels * 7) {
      const onBlue = [0, 1, 2].map((channel) => 0.45 * data[at + channel] + 0.55 * PINE_50[channel]); // the photo at 45% over the section's pine-50
      const tinted = onBlue.map((value, channel) => 0.4 * PINE_100[channel] + 0.6 * value); // the light brand-blue tint (pine-100 at 40%) over it
      const underHeading = tinted.map((value) => 0.9 * 255 + 0.1 * value); // the heading's soft white backing (90%) over it
      darkest = Math.min(darkest, luminance(underHeading));
    }
    const ratio = (darkest + 0.05) / (luminance(FOREST) + 0.05);
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
