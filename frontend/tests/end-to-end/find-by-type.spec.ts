/** Find by type in a real browser, at 320, 360 and 768 px. Requirements: US-01, US-05, FR-03, FR-04, FR-05, NFR-04, NFR-07, NFR-10.
 * Spec: specs/2026-10-15-find-by-type/ (D2 to D5, D8, D9, D10); plan Task 7.
 * It needs the site and the API running (see playwright.config.ts) with the demo listings in the database. A few checks answer the search
 * themselves (`page.route`) to get a case the database cannot give: an empty answer, or one 24-hour place that is also the closest pharmacy.
 * The unit tests read class names; this one measures the real layout and watches the network for the visitor's position.
 */
import { expect, test, type Page, type Request } from "@playwright/test";

const WIDTHS = [
  { width: 320, height: 640 },
  { width: 360, height: 740 },
  { width: 768, height: 1024 },
];

const PHARMACY = {
  id: 90, slug: "test-always-open-pharmacy", name: "Test Always Open Pharmacy", category: { slug: "pharmacy", name: "Pharmacy" },
  area: "Ogui", address: "1 Example Road", latitude: 6.45, longitude: 7.5, distance_km: null, is_open_now: true, is_24_hours: true,
  primary_phone: "+2340000000990", last_verified_at: new Date().toISOString(), verification_due: false, sponsored: false, hours_note: null,
};

/** The page's own part (`main`) does not run past the screen. The header is left out on purpose: with this machine's wide fallback font it is
 * a few pixels too wide between 344 and 370 px on every page (LOG.md, "The layout checks depend on the browser's fallback font"). The row of
 * category shortcuts scrolls inside itself by design, so its links are left out too. */
async function allIsInsideTheScreen(page: Page, width: number): Promise<void> {
  const overflow = await page.evaluate(() => (document.querySelector("main")?.scrollWidth ?? 0) - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  for (const control of await page.locator("main h1, main button, main a, main input").all()) {
    if (await control.evaluate((element) => element.closest("nav") !== null)) continue; // the shortcuts scroll inside their own row
    const box = await control.boundingBox();
    if (!box) continue; // hidden (screen-reader text)
    expect(box.x).toBeGreaterThanOrEqual(-0.5);
    expect(box.x + box.width).toBeLessThanOrEqual(width + 0.5);
  }
}

for (const { width, height } of WIDTHS) {
  test.describe(`find by type at ${width} px`, () => {
    test.use({ viewport: { width, height } });

    test("a tile gives the type's heading, the chip and only that type, and the chip removes it", async ({ page }) => {
      await page.goto("/", { waitUntil: "load" });
      await page.getByRole("link", { name: "Pharmacy", exact: true }).click();

      await expect(page).toHaveURL(/\/search\?category=pharmacy$/);
      // No position was shared in this browser, so the heading does not say "near you".
      await expect(page.getByRole("heading", { level: 1, name: "Pharmacies" })).toBeVisible({ timeout: 60_000 });
      const chip = page.getByRole("button", { name: "Remove the Pharmacy filter" });
      await expect(chip).toBeVisible();
      await expect(page.getByRole("article").first()).toBeVisible({ timeout: 60_000 });
      for (const article of await page.getByRole("article").all()) await expect(article).toContainText("Pharmacy");
      expect((await chip.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(48);
      await allIsInsideTheScreen(page, width);

      await chip.click();

      await expect(page).toHaveURL(/\/search$/);
      await expect(page.getByRole("heading", { level: 1, name: "Search results" })).toBeFocused();
      await expect(chip).toHaveCount(0);
      await expect(page.getByRole("status").filter({ hasText: "Pharmacy filter removed" })).toHaveCount(1);
    });

    test("a typed type word gives the same page, with an empty search box", async ({ page }) => {
      await page.goto("/find", { waitUntil: "load" });
      await page.getByRole("searchbox").fill("chemist");
      await page.getByRole("button", { name: "Search", exact: true }).click();

      await expect(page).toHaveURL(/\/search\?category=pharmacy$/, { timeout: 60_000 });
      await expect(page.getByRole("heading", { level: 1, name: "Pharmacies" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Remove the Pharmacy filter" })).toBeVisible();
      await expect(page.getByRole("searchbox")).toHaveValue("");
      await allIsInsideTheScreen(page, width);
    });

    test("a name is still a text search: 'pharmacy ogui' sets no type", async ({ page }) => {
      await page.goto("/search?q=pharmacy+ogui", { waitUntil: "load" });

      await expect(page.getByRole("heading", { level: 1, name: "Search results" })).toBeVisible({ timeout: 60_000 });
      await expect(page.getByRole("button", { name: /^Remove the/ })).toHaveCount(0);
      await expect(page.getByRole("searchbox")).toHaveValue("pharmacy ogui");
    });

    test("says No matches with a filter on, and No places found with none, then where the first city is", async ({ page }) => {
      await page.goto("/search?q=zzzqqqxx", { waitUntil: "load" });
      await expect(page.getByText("No matches. Try removing a filter or widening the distance.")).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText("We're starting in Enugu and adding more places soon.")).toBeVisible();
      await allIsInsideTheScreen(page, width);

      await page.route("**/search?**", (route) => route.fulfill({ json: { items: [], total: 0 } }));
      await page.goto("/search", { waitUntil: "load" });
      await expect(page.getByText("No places found near you yet.")).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText("We're starting in Enugu and adding more places soon.")).toBeVisible();
    });

    test("the Pharmacy page shows its banner under the heading, then the credit, the search box and the chip; only that photo downloads", async ({ page }) => {
      const photos: string[] = [];
      page.on("request", (request) => {
        if (new URL(request.url()).pathname.startsWith("/images/types/")) photos.push(new URL(request.url()).pathname);
      });
      await page.goto("/search?category=pharmacy", { waitUntil: "load" });

      const heading = page.getByRole("heading", { level: 1, name: "Pharmacies" });
      const banner = page.getByRole("img", { name: /pharmacist in a white coat/ });
      const credit = page.getByRole("link", { name: /^Designed by Magnific/ });
      await expect(banner).toBeVisible({ timeout: 60_000 });
      await expect(credit).toHaveAttribute("href", "https://www.magnific.com");
      const [headingBox, bannerBox, creditBox, searchBox, chipBox] = await Promise.all([
        heading.boundingBox(),
        banner.boundingBox(),
        credit.boundingBox(),
        page.getByRole("searchbox").boundingBox(),
        page.getByRole("button", { name: "Remove the Pharmacy filter" }).boundingBox(),
      ]);
      // Heading, banner, credit, search box, chip: each below the one before.
      expect(bannerBox!.y).toBeGreaterThan(headingBox!.y);
      expect(creditBox!.y).toBeGreaterThanOrEqual(bannerBox!.y + bannerBox!.height - 1);
      expect(searchBox!.y).toBeGreaterThan(creditBox!.y);
      expect(chipBox!.y).toBeGreaterThan(searchBox!.y);
      // A real 3:1 picture that fits the screen, and a credit that is a tap target.
      expect(bannerBox!.x + bannerBox!.width).toBeLessThanOrEqual(width + 0.5);
      expect(bannerBox!.width / bannerBox!.height).toBeCloseTo(3, 1);
      expect(creditBox!.height).toBeGreaterThanOrEqual(48);
      expect(photos).toEqual(["/images/types/banner-pharmacy-1.webp"]); // one file, not one for each type
    });

    test("the Hospital page has its heading and chip but no banner and no credit (no approved photo yet)", async ({ page }) => {
      await page.goto("/search?category=hospital", { waitUntil: "load" });

      await expect(page.getByRole("heading", { level: 1, name: "Hospitals" })).toBeVisible({ timeout: 60_000 });
      await expect(page.getByRole("button", { name: "Remove the Hospital filter" })).toBeVisible();
      await expect(page.locator("main img[src^='/images/types/']")).toHaveCount(0);
      await expect(page.getByRole("link", { name: /Magnific/ })).toHaveCount(0);
    });

    test("Near you shows one card with both labels when the closest pharmacy is also the only 24-hour place", async ({ page }) => {
      await page.addInitScript(() => window.sessionStorage.setItem("swifthealth.area", "Ogui"));
      await page.route("**/search?**", (route) => route.fulfill({ json: { items: [PHARMACY], total: 1 } }));
      await page.goto("/find", { waitUntil: "load" });

      const card = page.getByRole("region", { name: /Closest open pharmacy.*Closest open 24-hour place/ });
      await expect(card).toBeVisible({ timeout: 60_000 });
      await expect(card.getByRole("link", { name: "Test Always Open Pharmacy", exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: "Test Always Open Pharmacy", exact: true })).toHaveCount(1); // never twice
      await allIsInsideTheScreen(page, width);
    });
  });
}

test.describe("what the type pages send", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("a stored position is never in the address; one search for a typed word", async ({ page }) => {
    await page.addInitScript(() =>
      window.sessionStorage.setItem("swifthealth.position", JSON.stringify({ latitude: 6.101, longitude: 7.202 })),
    );
    const searches: Request[] = [];
    page.on("request", (request) => {
      // The API's searches only (they carry `limit`). The page itself is also at /search, and replacing its address makes the site fetch
      // /search?category=pharmacy&_rsc=... too; neither is a search of the API.
      const url = new URL(request.url());
      if (url.pathname === "/search" && url.searchParams.has("limit")) searches.push(request);
    });
    await page.goto("/search?q=pharmacies", { waitUntil: "load" });
    await expect(page.getByRole("heading", { level: 1, name: "Pharmacies near you" })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("button", { name: "Remove the Pharmacy filter" })).toBeVisible();

    await expect(page).toHaveURL(/\/search\?category=pharmacy$/); // the address is replaced a moment after the first paint
    expect(page.url()).not.toMatch(/lat=|lng=|6\.101|7\.202/);
    // The typed word was turned into the category before the first search: no request ever carried q=pharmacies.
    expect(searches.some((request) => request.url().includes("q=pharmacies"))).toBe(false);
    expect(searches.filter((request) => request.url().includes("category=pharmacy"))).toHaveLength(1);
  });
});
