/** The hero photo slideshow, the footer credit and the plain "Find by type" section, in a real browser, at 320, 360, 768 and 1280 px.
 * Requirements: US-13, NFR-01, NFR-10, NFR-13, WCAG 2.2.2. Spec: specs/2026-10-28-hero-slideshow/. It needs the site running (see playwright.config.ts);
 * the home page makes no API request. The unit tests read class names and drive fake timers; this one measures the real layout, the real requests,
 * the real layout shift and the real pixels of the photos in Light and in Dark.
 */
import { expect, test, type Page } from "@playwright/test";

const WIDTHS = [
  { width: 320, height: 640 },
  { width: 360, height: 740 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
];
const COUNT = 6; // the stethoscope and the five
const FOCUS = [
  { narrow: "25% 7%", wide: "10% 50%" },
  { narrow: "100% 17%", wide: "98% 50%" },
  { narrow: "50% 13%", wide: "32% 50%" },
  { narrow: "50% 30%", wide: "16% 50%" },
  { narrow: "50% 29%", wide: "50% 50%" },
];

async function openHome(page: Page, mode: "light" | "dark" = "light"): Promise<void> {
  await page.addInitScript((kept) => window.localStorage.setItem("swifthealth.theme", kept), mode);
  await page.goto("/", { waitUntil: "load" });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 60_000 });
  // The page is ready when React has taken over the buttons (it marks a DOM node it manages with a __reactProps property): a fast clock that runs
  // before that would run before the page has set its timers.
  await page.waitForFunction(
    () => {
      const button = document.querySelector("[data-hero-controls] button");
      return button !== null && Object.keys(button).some((key) => key.startsWith("__reactProps"));
    },
    undefined,
    { timeout: 60_000 },
  );
  await page.waitForTimeout(150);
}

/** The index (0 to 5) of the photo on show: the slide with full opacity. */
async function shownIndex(page: Page): Promise<number> {
  return page.evaluate(() => {
    const slide = [...document.querySelectorAll<HTMLElement>("[data-hero-slide]")].find((candidate) => /\bopacity-100\b/.test(candidate.className));
    return slide ? Number(slide.getAttribute("data-index")) : -1;
  });
}

/** Waits until every photo that is in the page has loaded. */
async function photosAreLoaded(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => [...document.querySelectorAll<HTMLImageElement>("[data-hero-slide] img")].every((image) => image.complete && image.naturalWidth > 0)), { timeout: 30_000 })
    .toBe(true);
}

/** True once photo `index` is in the page and has loaded. */
async function photoIsLoaded(page: Page, index: number): Promise<boolean> {
  return page.evaluate((wanted) => {
    const image = document.querySelector<HTMLImageElement>(`[data-hero-slide][data-index="${wanted}"] img`);
    return image !== null && image.complete && image.naturalWidth > 0;
  }, index);
}

/** Shows photo `index` with its dot, and waits until it is on show and its fade (1.2 s) is over. */
async function showPhoto(page: Page, index: number): Promise<void> {
  await page.getByRole("button", { name: `Photo ${index + 1} of ${COUNT}` }).click();
  await expect.poll(() => shownIndex(page), { timeout: 30_000 }).toBe(index);
  await photosAreLoaded(page);
  await page.waitForTimeout(1500);
}

/** How different two pictures of the same size are: the largest and the mean difference of a colour channel (0 to 255). */
async function difference(page: Page, first: Buffer, second: Buffer): Promise<{ largest: number; mean: number; pixels: number }> {
  const blank = await page.context().newPage();
  try {
    return await blank.evaluate(
      async ({ one, two }) => {
        const read = async (base64: string) => {
          const image = new Image();
          image.src = `data:image/png;base64,${base64}`;
          await image.decode();
          const canvas = document.createElement("canvas");
          canvas.width = image.width;
          canvas.height = image.height;
          const context = canvas.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D;
          context.drawImage(image, 0, 0);
          return context.getImageData(0, 0, image.width, image.height).data;
        };
        const [left, right] = [await read(one), await read(two)];
        let largest = 0;
        let total = 0;
        for (let index = 0; index < left.length; index += 4) {
          for (let channel = 0; channel < 3; channel++) {
            const gap = Math.abs(left[index + channel] - right[index + channel]);
            largest = Math.max(largest, gap);
            total += gap;
          }
        }
        return { largest, mean: total / ((left.length / 4) * 3), pixels: left.length / 4 };
      },
      { one: first.toString("base64"), two: second.toString("base64") },
    );
  } finally {
    await blank.close();
  }
}

for (const { width, height } of WIDTHS) {
  test.describe(`the hero slideshow at ${width} px`, () => {
    test.use({ viewport: { width, height } });

    test("the band is the same box and shape as the stethoscope's was, and the stethoscope is the first photo, as before", async ({ page }) => {
      await openHome(page);

      const band = (await page.locator("[data-hero-band]").boundingBox())!;
      if (width >= 1024) {
        expect(band.x).toBeCloseTo(width / 2, 0); // the right half
        expect(band.width).toBeCloseTo(width / 2, 0);
        const section = (await page.locator('section[aria-labelledby="hero-heading"]').boundingBox())!;
        expect(band.height).toBeCloseTo(section.height, 0); // as high as the hero
        expect(band.y).toBeCloseTo(section.y, 0);
      } else {
        expect(band.x).toBe(0);
        expect(band.width).toBe(width); // the full width
        expect(band.height).toBe(width < 768 ? 256 : 288); // 16 rem, 18 rem from 768 px
      }
      const clip = await page.locator("[data-hero-frame]").evaluate((element) => getComputedStyle(element).clipPath);
      expect(clip).toContain("polygon"); // the slanted edge
      const first = page.locator('[data-hero-slide][data-index="0"] img');
      await expect(first).toHaveAttribute("fetchpriority", "high");
      await expect(first).toHaveAttribute("loading", "eager");
      const source = await first.evaluate((image: HTMLImageElement) => image.currentSrc);
      expect(source).toContain(width < 768 ? "/images/home/hero3-phone.webp" : "/images/home/hero3.webp"); // a phone takes the small file, as before
      expect(await shownIndex(page)).toBe(0);
    });

    test("asks for the stethoscope first and for no other photo before the page has loaded; the others come after, one ahead", async ({ page }) => {
      const requests: { path: string; afterLoad: boolean }[] = [];
      let loaded = false;
      page.on("request", (request) => {
        const path = new URL(request.url()).pathname;
        if (path.startsWith("/images/backdrop/") || path.startsWith("/images/home/hero3")) requests.push({ path, afterLoad: loaded });
      });
      page.on("load", () => {
        loaded = true;
      });
      await openHome(page);
      await expect.poll(() => requests.filter((request) => request.path.startsWith("/images/backdrop/")).length, { timeout: 30_000 }).toBeGreaterThanOrEqual(1);
      await page.waitForTimeout(1500);

      expect(requests[0].path).toContain("/images/home/hero3"); // the stethoscope is the first photo the page asks for
      const others = requests.filter((request) => request.path.startsWith("/images/backdrop/"));
      expect(others.every((request) => request.afterLoad)).toBe(true); // none before the page has loaded
      expect(others.length).toBeLessThanOrEqual(2); // the next one, ahead of its turn (not all five at once)
      expect(new Set(others.map((request) => request.path)).size).toBe(others.length); // none twice
    });

    test("changes every 6 seconds with a fade, through all six photos and round to the stethoscope (a fast clock)", async ({ page }) => {
      await page.clock.install();
      await openHome(page);
      await page.clock.pauseAt(new Date(Date.now() + 2000));
      for (let step = 1; step <= COUNT; step++) {
        await page.clock.runFor(400); // the page is idle: the next photo is added
        await expect.poll(() => photoIsLoaded(page, step % COUNT), { message: `photo ${(step % COUNT) + 1} is in the page and loaded`, timeout: 30_000 }).toBe(true);
        await page.waitForTimeout(300); // real time: lets the page note the load and set its 6 second timer before the fast clock runs
        await page.clock.runFor(6100);
        await expect.poll(() => shownIndex(page), { message: `after ${step} changes`, timeout: 10_000 }).toBe(step % COUNT); // the page draws in real time
      }
    });

    test("has Previous, Next and six dots, each at least 48 px, inside the screen, below the faces' band and clear of the heading", async ({ page }) => {
      await openHome(page);
      await photosAreLoaded(page);

      const buttons = [
        page.getByRole("button", { name: "Previous photo" }),
        page.getByRole("button", { name: "Next photo" }),
        page.getByRole("button", { name: "Pause photos" }),
        ...Array.from({ length: COUNT }, (_, index) => page.getByRole("button", { name: `Photo ${index + 1} of ${COUNT}` })),
      ];
      const band = (await page.locator("[data-hero-band]").boundingBox())!;
      const heading = (await page.getByRole("heading", { level: 1 }).boundingBox())!;
      for (const button of buttons) {
        const box = (await button.boundingBox())!;
        expect(box.width, await button.getAttribute("aria-label")).toBeGreaterThanOrEqual(47.5);
        expect(box.height, await button.getAttribute("aria-label")).toBeGreaterThanOrEqual(47.5);
        expect(box.x).toBeGreaterThanOrEqual(-0.5);
        expect(box.x + box.width).toBeLessThanOrEqual(width + 0.5);
        if (width < 1024) expect(box.y + box.height).toBeLessThanOrEqual(heading.y - 4); // never over the heading
        expect(box.y).toBeGreaterThanOrEqual(band.y); // not above the band
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(width < 380 ? 12 : 0); // the known 360 px header width, nothing more
    });

    test("works by hand: Next, Previous, a dot, from the keyboard, with the focus kept and a spoken change", async ({ page }) => {
      await openHome(page);
      await photosAreLoaded(page);

      await page.getByRole("button", { name: "Next photo" }).focus();
      await page.keyboard.press("Enter");
      await expect.poll(() => shownIndex(page), { timeout: 30_000 }).toBe(1);
      await expect(page.locator("[data-hero-announcement]")).toHaveText(`Photo 2 of ${COUNT}`);
      await page.keyboard.press("Enter");
      await photosAreLoaded(page);
      await expect.poll(() => shownIndex(page), { timeout: 30_000 }).toBe(2);

      await page.getByRole("button", { name: "Previous photo" }).click();
      await expect.poll(() => shownIndex(page), { timeout: 30_000 }).toBe(1);
      await showPhoto(page, 4);
      await expect(page.getByRole("button", { name: `Photo 5 of ${COUNT}` })).toHaveAttribute("aria-current", "true");
      await page.getByRole("button", { name: "Previous photo" }).click();
      await showPhoto(page, 3).catch(() => undefined); // already on the way to photo 4
      await expect.poll(() => shownIndex(page), { timeout: 30_000 }).toBe(3);
      await page.getByRole("button", { name: `Photo 1 of ${COUNT}` }).click();
      await expect.poll(() => shownIndex(page), { timeout: 30_000 }).toBe(0);
    });

    test("holds on Pause and says Play, a hidden tab stops it, and Play starts it again (a fast clock)", async ({ page }) => {
      await page.clock.install();
      await openHome(page);
      await page.clock.pauseAt(new Date(Date.now() + 2000));
      await page.clock.runFor(400);
      await expect.poll(() => photoIsLoaded(page, 1), { timeout: 30_000 }).toBe(true);
      await page.waitForTimeout(300);

      await page.getByRole("button", { name: "Pause photos" }).click();
      await page.clock.runFor(30_000);
      await page.waitForTimeout(500);
      expect(await shownIndex(page)).toBe(0);
      await page.getByRole("button", { name: "Play photos" }).click();

      await page.evaluate(() => {
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await page.waitForTimeout(300);
      await page.clock.runFor(30_000);
      await page.waitForTimeout(500);
      expect(await shownIndex(page)).toBe(0);

      await page.evaluate(() => {
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await page.waitForTimeout(300);
      await page.clock.runFor(6100);
      await expect.poll(() => shownIndex(page), { timeout: 10_000 }).toBe(1);
    });


    test("with reduce motion: nothing changes by itself, no Pause button, and Next, Previous and the dots still work", async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce" });
      const page = await context.newPage();
      await openHome(page);
      await page.waitForTimeout(8000);

      expect(await shownIndex(page)).toBe(0);
      expect(await page.locator("[data-hero-slide]").count()).toBe(1); // no other photo was asked for
      await expect(page.getByRole("button", { name: /Pause photos|Play photos/ })).toHaveCount(0);
      await page.getByRole("button", { name: "Next photo" }).click();
      await expect.poll(() => shownIndex(page), { timeout: 30_000 }).toBe(1);
      await page.waitForTimeout(8000);
      expect(await shownIndex(page)).toBe(1); // and nothing else by itself
      await context.close();
    });

    test("has no layout shift while the photos load and change (CLS 0), and the heading does not move", async ({ page }) => {
      await page.addInitScript(() => {
        (window as unknown as { shift: number }).shift = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) {
            if (!entry.hadRecentInput) (window as unknown as { shift: number }).shift += entry.value;
          }
        }).observe({ type: "layout-shift", buffered: true });
      });
      await openHome(page);
      const before = (await page.getByRole("heading", { level: 1 }).boundingBox())!;

      for (let index = 1; index < COUNT; index++) await showPhoto(page, index);
      await showPhoto(page, 0);

      const after = (await page.getByRole("heading", { level: 1 }).boundingBox())!;
      expect(after).toEqual(before);
      expect(await page.evaluate(() => (window as unknown as { shift: number }).shift)).toBe(0);
    });

    test("gives each photo its focus point for this width (the narrow one under 1024 px, the wide one from it)", async ({ page }) => {
      await openHome(page);
      for (let index = 1; index < COUNT; index++) await showPhoto(page, index);

      for (let index = 1; index < COUNT; index++) {
        const position = await page.locator(`[data-hero-slide][data-index="${index}"] img`).evaluate((image) => getComputedStyle(image).objectPosition);
        const expected = (width >= 1024 ? FOCUS[index - 1].wide : FOCUS[index - 1].narrow).split(" ");
        // the browser writes the position in pixels or percent; a percentage stays a percentage
        expect(position, `photo ${index + 1}`).toBe(expected.join(" "));
      }
    });

    test("shows every photo as bright in the dark mode as in the light mode: the same pixels, no wash, tint or filter", async ({ browser }) => {
      const pictures: Record<"light" | "dark", Buffer[]> = { light: [], dark: [] };
      let helper: Page | undefined;
      for (const mode of ["light", "dark"] as const) {
        const context = await browser.newContext({ viewport: { width, height } });
        const page = await context.newPage();
        helper ??= await (await browser.newContext()).newPage();
        await openHome(page, mode);
        for (let index = 0; index < COUNT; index++) {
          if (index > 0) await showPhoto(page, index);
          await page.waitForTimeout(1500);
          const box = (await page.locator("[data-hero-frame]").boundingBox())!;
          // the middle of the band: below the shade under the header (96 px), above the controls, and right of the slanted edge
          const clip =
            width >= 1024
              ? { x: box.x + box.width * 0.3, y: box.y + 150, width: box.width * 0.5, height: 300 }
              : { x: box.x, y: box.y + 100, width: box.width, height: width < 768 ? 50 : 100 };
          pictures[mode].push(await page.screenshot({ clip, type: "png" }));
        }
        await context.close();
      }
      for (let index = 0; index < COUNT; index++) {
        const gap = await difference(helper!, pictures.light[index], pictures.dark[index]);
        expect(gap.pixels).toBeGreaterThan(4000);
        expect(gap.largest, `photo ${index + 1}: largest difference ${gap.largest} of 255, mean ${gap.mean.toFixed(2)}`).toBeLessThanOrEqual(2);
        expect(gap.mean).toBeLessThan(0.5);
      }
    });
  });
}

test.describe("the footer credit (one line, bottom right)", () => {
  for (const { width, height } of [WIDTHS[0], WIDTHS[3]]) {
    test(`is 'Photos: Designed by Magnific' at ${width} px: 16 px, 48 px to tap, at the right, inside the screen, in the link colour`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto("/emergency", { waitUntil: "load" });

      const credit = page.getByRole("link", { name: /^Photos: Designed by Magnific/ });
      await expect(credit).toHaveAttribute("href", "https://www.magnific.com");
      await expect(credit).toHaveAttribute("target", "_blank");
      const box = (await credit.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(47.5);
      expect(box.x).toBeGreaterThanOrEqual(15.5); // inside the 16 px gutter
      expect(box.x + box.width).toBeLessThanOrEqual(width - 15.5);
      const container = (await page.locator("footer > div").boundingBox())!;
      expect(box.x + box.width).toBeGreaterThan(container.x + container.width - 40); // at the right of the footer's container
      expect(await credit.evaluate((element) => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(width < 380 ? 12 : 0);
      await expect(page.getByRole("link", { name: /magnific/i })).toHaveCount(1); // not under the ambulance and fire photos any more
    });
  }

  for (const mode of ["light", "dark"] as const) {
    test(`is readable in the ${mode} mode: at least 4.5:1 against the page`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 640 });
      await page.addInitScript((kept) => window.localStorage.setItem("swifthealth.theme", kept), mode);
      await page.goto("/find", { waitUntil: "load" });

      const colours = await page.getByRole("link", { name: /^Photos: Designed by Magnific/ }).evaluate((element) => {
        const read = (css: string) => {
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = 1;
          const context = canvas.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D;
          context.fillStyle = css;
          context.fillRect(0, 0, 1, 1);
          return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
        };
        return { text: read(getComputedStyle(element).color), page: read(getComputedStyle(document.body).backgroundColor) };
      });
      const linear = (value: number) => ((value / 255 <= 0.03928 ? value / 255 / 12.92 : ((value / 255 + 0.055) / 1.055) ** 2.4));
      const luminance = ([red, green, blue]: number[]) => 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
      const [lighter, darker] = [luminance(colours.text), luminance(colours.page)].sort((first, second) => second - first);
      expect((lighter + 0.05) / (darker + 0.05)).toBeGreaterThanOrEqual(4.5);
    });
  }
});

test("the 'Find by type' section is plain again: no photo, no Pause button, no credit behind it, the five tiles as before", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/", { waitUntil: "load" });

  const section = page.locator("section", { has: page.getByRole("heading", { level: 2, name: "Find by type" }) });
  await expect(section.locator("img, picture, button")).toHaveCount(0);
  await expect(section.getByRole("link")).toHaveCount(5);
  await expect(section.getByRole("heading", { level: 2, name: "Find by type" })).toBeVisible();
  expect(await section.evaluate((element) => getComputedStyle(element).contentVisibility)).toBe("visible");
});

test("the address-bar colour (theme-color) is the header blue in Light and navy in Dark, and follows the Theme button", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const colour = () => page.locator('meta[name="theme-color"]').first().getAttribute("content");

  await page.goto("/find", { waitUntil: "load" });
  expect(await colour()).toBe("#1b6f93");

  const button = page.getByRole("button", { name: /^Colour theme:/ });
  await button.click(); // Light to Dark
  await expect.poll(colour).toBe("#0a1628");
  await button.click(); // Dark to System (the device is light here)
  await expect.poll(colour).toBe("#1b6f93");

  await page.addInitScript(() => window.localStorage.setItem("swifthealth.theme", "dark"));
  await page.goto("/find", { waitUntil: "load" });
  expect(await colour()).toBe("#0a1628"); // set before the page is drawn, from the stored choice
});

test("the hero and the owners part are as on main: the stethoscope first, the hero4 portrait at the owners part, and no photo credit on any photo", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/", { waitUntil: "load" });

  const hero = page.locator("main section").first();
  await expect(hero.locator("img").first()).toHaveAttribute("src", "/images/home/hero3.webp");
  await expect(hero.getByRole("link", { name: "Find care near me" })).toHaveAttribute("href", "/find");
  await expect(page.locator('main img[src="/images/home/hero4-portrait.webp"]')).toHaveCount(1);
  await expect(page.getByRole("link", { name: /magnific/i })).toHaveCount(1); // the footer's, and no other
  await expect(page.locator("main").getByRole("link", { name: /magnific/i })).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2, name: /How we verify|SwiftRescue/ })).toHaveCount(0);
});

test("/search and /find show no picture at all in their own part, and the credit is only in the footer", async ({ page }) => {
  for (const path of ["/search", "/search?category=clinic", "/search?category=pharmacy", "/search?category=laboratory", "/find"]) {
    await page.goto(path, { waitUntil: "load" });
    await page.waitForTimeout(500);
    await expect(page.locator("main img, main picture, main figure"), path).toHaveCount(0);
    await expect(page.locator("main").getByRole("link", { name: /magnific/i }), path).toHaveCount(0);
  }
});
