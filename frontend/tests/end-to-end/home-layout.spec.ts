/** The home page in a real browser, at phone, tablet and desktop widths. Requirements: US-13, NFR-10, FR-02.
 * UI spec 2.1 and "Layout"; revisions R28 to R34 (2026-10-12) in specs/2026-10-11-home-redesign/requirements.md.
 * The unit tests (Vitest, jsdom) can only read class names; this one measures the real layout, so it catches a heading cut off
 * at the right edge, a header link or the Menu button pushed off the screen, and a page that scrolls sideways.
 * Run: `npm run test:e2e` with the site running (see playwright.config.ts).
 */
import { expect, test, type Page } from "@playwright/test";

// Width and a realistic window height: a window of that width on a laptop or the screen of a phone or a tablet.
const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 360, height: 740 },
  { width: 375, height: 667 },
  { width: 600, height: 800 },
  { width: 768, height: 700 },
  { width: 900, height: 700 },
  { width: 1024, height: 700 },
];
const STACKED_BELOW = 1024; // the side-by-side hero starts here
const MENU_BUTTON_BELOW = 768; // the header links are in the bar from here, the Menu button below
const WORDMARK_FROM = 360; // the full wordmark ("SwiftHealth" and "Route") is visible from here (R40)

type Measure = {
  scrollWidth: number;
  innerWidth: number;
  headingLines: { left: number; right: number; top: number }[];
  headingOverflow: number;
  header: { text: string; left: number; right: number; width: number }[];
  wordmark: { text: string; left: number; right: number; width: number }[]; // "SwiftHealth" and "Route" as drawn (width 0: hidden)
  headingBottom: number;
  buttonBottom: number;
};

/** Everything the checks need, measured in the page (positions in pixels from the top left of the window). */
async function measure(page: Page): Promise<Measure> {
  return page.evaluate(() => {
    const heading = document.querySelector("h1") as HTMLElement;
    const range = document.createRange();
    range.selectNodeContents(heading);
    const button = document.querySelector("main a[href='/find']") as HTMLElement;
    return {
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      headingLines: [...range.getClientRects()].map((rect) => ({ left: rect.left, right: rect.right, top: rect.top })),
      headingOverflow: heading.scrollWidth - heading.clientWidth,
      // The Menu button is an icon only: its name is its aria-label.
      header: [...document.querySelectorAll("header a, header button")].map((element) => {
        const box = element.getBoundingClientRect();
        const text = (element.textContent ?? "").trim() || (element.getAttribute("aria-label") ?? "");
        return { text, left: box.left, right: box.right, width: box.width };
      }),
      wordmark: [...document.querySelectorAll('header [role="img"] span')]
        .filter((element) => ["SwiftHealth", "Route"].includes((element.textContent ?? "").trim()) && element.children.length === 0)
        .map((element) => {
          const box = element.getBoundingClientRect();
          return { text: (element.textContent ?? "").trim(), left: box.left, right: box.right, width: box.width };
        }),
      headingBottom: heading.getBoundingClientRect().bottom,
      buttonBottom: button.getBoundingClientRect().bottom,
    };
  });
}

/** The things that must be true at any width: returns a list of what is wrong (empty when all is well). */
function problemsAt(width: number, result: Measure): string[] {
  const problems: string[] = [];
  const inside = (left: number, right: number) => left >= -0.5 && right <= result.innerWidth + 0.5;
  const item = (text: string) => result.header.find((entry) => entry.text === text && entry.width > 0);

  if (result.scrollWidth > result.innerWidth) problems.push(`the page scrolls sideways (${result.scrollWidth} > ${result.innerWidth})`);
  if (result.headingLines.some((line) => !inside(line.left, line.right))) problems.push("a line of the heading is outside the screen");
  if (result.headingOverflow > 1) problems.push("the heading is clipped by its own box");

  const logoLink = result.header[0];
  if (!logoLink || logoLink.width <= 0 || !inside(logoLink.left, logoLink.right)) problems.push("the logo is not inside the screen");
  // The wordmark: both words visible from 360 px; below that whatever is drawn must be inside the screen.
  for (const text of ["SwiftHealth", "Route"]) {
    const word = result.wordmark.find((entry) => entry.text === text);
    if (!word) problems.push(`the word ${text} of the logo is missing`);
    else if (width >= WORDMARK_FROM && word.width <= 0) problems.push(`the word ${text} of the logo is not visible at ${width} px`);
    else if (word.width > 0 && !inside(word.left, word.right)) problems.push(`the word ${text} of the logo is outside the screen`);
  }
  const rescue = item("SwiftRescue");
  if (!rescue || !inside(rescue.left, rescue.right)) problems.push("SwiftRescue is missing or outside the screen");
  const links = width >= MENU_BUTTON_BELOW ? item("For facilities") : item("Menu");
  if (!links || !inside(links.left, links.right)) {
    problems.push(`${width >= MENU_BUTTON_BELOW ? "the For facilities link" : "the Menu button"} is missing or outside the screen`);
  }
  return problems;
}

for (const { width, height } of VIEWPORTS) {
  test.describe(`the home page at ${width} px`, () => {
    test.use({ viewport: { width, height } });

    test.beforeEach(async ({ page }) => {
      await page.goto("/", { waitUntil: "load" });
    });

    test("fits the screen: no sideways scrolling, a heading that is not cut off, a header with the links or the Menu button", async ({ page }) => {
      expect(problemsAt(width, await measure(page))).toEqual([]);
    });

    test("shows both words of the logo, SwiftHealth and Route (from 360 px)", async ({ page }) => {
      test.skip(width < WORDMARK_FROM, "below 360 px the stacked ROUTE is hidden first, and if needed the whole wordmark (R40)");
      const header = page.locator("header");

      await expect(header.getByText("SwiftHealth", { exact: true })).toBeVisible();
      await expect(header.getByText("Route", { exact: true })).toBeVisible();
    });

    test("wraps the heading below 1024 px: it is not one long line past the edge", async ({ page }) => {
      test.skip(width >= STACKED_BELOW, "the side-by-side layout has its own column");
      const result = await measure(page);
      const widest = Math.max(...result.headingLines.map((line) => line.right));

      expect(widest).toBeLessThanOrEqual(result.innerWidth - 16 + 0.5); // inside the 16 px of space at the sides
    });

    test("shows the heading and Find care near me on the first screen", async ({ page }) => {
      const result = await measure(page);

      expect(result.headingBottom).toBeLessThanOrEqual(height);
      expect(result.buttonBottom).toBeLessThanOrEqual(height);
    });
  });
}

test("every 4th width from 320 to 1100 px: nothing cut off, nothing off the screen, no sideways scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.goto("/", { waitUntil: "load" });
  const failures: string[] = [];

  for (let width = 320; width <= 1100; width += 4) {
    await page.setViewportSize({ width, height: 900 });
    const problems = problemsAt(width, await measure(page));
    if (problems.length > 0) failures.push(`${width} px: ${problems.join("; ")}`);
  }

  expect(failures).toEqual([]);
});

test("is still fine with a heading much wider than usual (another font): it wraps, never clips", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto("/", { waitUntil: "load" });
  await page.addStyleTag({ content: "h1 { letter-spacing: 0.1em; }" }); // stands in for a wider system font

  expect(problemsAt(768, await measure(page))).toEqual([]);
});
