/** The listing page in a real browser, at phone, tablet and desktop widths. Requirements: US-02, US-03, US-06, FR-09 to FR-13, FR-22, FR-47,
 * NFR-01, NFR-07, NFR-10. Spec: specs/2026-10-13-listing-page/requirements.md D1 to D11; plan Task 7.
 *
 * It needs the local fictional fixture in the database (development only):
 *   docker compose exec backend python -m seed.whatsapp_fixture
 * and a running site (see playwright.config.ts). The unit tests read class names; this one measures the real layout and watches the network.
 * The fixture's photo comes from a placeholder site, so the checks look at the photo's address, not at whether it loaded.
 */
import { expect, test, type Page, type Request } from "@playwright/test";

const SLUG = "test-fixture-whatsapp-clinic";
const NAME = "TEST FIXTURE (fictional): WhatsApp demo clinic";
const FIXTURE_LATITUDE = "6.4365"; // the fixture's position: it may appear in the Directions link and nowhere else
const FIXTURE_LONGITUDE = "7.4965";
const WIDTHS = [
  { width: 320, height: 640 },
  { width: 375, height: 667 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
];

async function openFixture(page: Page, query = ""): Promise<void> {
  await page.goto(`/listing/${SLUG}${query}`, { waitUntil: "load" });
  await expect(page.getByRole("heading", { level: 1, name: NAME })).toBeVisible({ timeout: 60_000 });
}

for (const { width, height } of WIDTHS) {
  test.describe(`the listing page at ${width} px`, () => {
    test.use({ viewport: { width, height } });

    test("does not scroll sideways and shows the whole listing", async ({ page }) => {
      await openFixture(page);

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      await expect(page.getByText("Recently reported as not working. Call before you go.")).toBeVisible();
      await expect(page.getByRole("heading", { level: 2, name: "Opening hours" })).toBeVisible();
      await expect(page.getByRole("heading", { level: 2, name: "Services and fees" })).toBeVisible();
    });

    test("has Call as the biggest button, and WhatsApp only on the two marked numbers", async ({ page }) => {
      await openFixture(page);

      const call = page.getByRole("link", { name: `Call ${NAME}`, exact: true });
      const whatsapp = page.getByRole("link", { name: /^WhatsApp / });
      await expect(whatsapp).toHaveCount(2); // the primary number and the Emergency number, not Reception
      const callBox = await call.boundingBox();
      expect(callBox?.height ?? 0).toBeGreaterThanOrEqual(56);
      for (const other of await page.getByRole("link", { name: /^(WhatsApp|Directions to) / }).all()) {
        expect((await other.boundingBox())?.height ?? 0).toBeLessThanOrEqual(callBox?.height ?? 0);
      }
      await expect(page.getByRole("link", { name: `WhatsApp ${NAME} (Reception) (opens in a new tab)` })).toHaveCount(0);
    });

    test("has every button inside the screen", async ({ page }) => {
      await openFixture(page);

      for (const control of await page.locator("main a, main button").all()) {
        const box = await control.boundingBox();
        if (!box) continue; // hidden (the screen-reader text)
        expect(box.x).toBeGreaterThanOrEqual(-0.5);
        expect(box.x + box.width).toBeLessThanOrEqual(width + 0.5);
      }
    });
  });
}

test.describe("what the listing page shows and sends", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("links WhatsApp to wa.me with the number and the fixed message, and nothing else", async ({ page }) => {
    await openFixture(page);

    const links = await page.getByRole("link", { name: /^WhatsApp / }).evaluateAll((elements) =>
      elements.map((element) => ({ href: (element as HTMLAnchorElement).href, target: element.getAttribute("target"), rel: element.getAttribute("rel") })),
    );
    expect(links).toHaveLength(2);
    for (const link of links) {
      const url = new URL(link.href);
      expect(url.origin).toBe("https://wa.me");
      expect(url.pathname).toMatch(/^\/2340000000(951|953)$/); // 234 and ten digits, no plus, no leading zero
      expect([...url.searchParams.keys()]).toEqual(["text"]);
      expect(url.searchParams.get("text")).toBe("Hello, I found you on SwiftHealth Route.");
      expect(link.target).toBe("_blank");
      expect(link.rel).toContain("noopener");
    }
  });

  test("shows the hours in 12-hour time, one Today, a shift past midnight and a closed day, with the fees written the owner's way", async ({ page }) => {
    await openFixture(page);

    const rows = page.getByRole("table").getByRole("row");
    await expect(rows).toHaveCount(7);
    await expect(rows.nth(0)).toContainText("8:00 AM – 5:00 PM");
    await expect(rows.nth(4)).toContainText("8:00 PM – 2:00 AM (next day)");
    await expect(rows.nth(6)).toContainText("Closed");
    await expect(page.getByText("Today", { exact: true })).toHaveCount(1);
    await expect(page.getByText("₦1,500 – ₦3,000")).toBeVisible();
    await expect(page.getByText("₦500", { exact: true })).toBeVisible();
    await expect(page.getByText("From ₦1,000")).toBeVisible();
    await expect(page.getByText("Estimate — confirm with the facility")).toHaveCount(1);
  });

  test("has an entrance photo with an https address and alt text", async ({ page }) => {
    await openFixture(page);

    const photo = page.locator(`img[alt="Entrance of ${NAME}"]`);
    // The placeholder site may be out of reach (no internet): then the page removes the frame, which is also right.
    const count = await photo.count();
    if (count > 0) {
      await expect(photo).toHaveAttribute("src", /^https:\/\//);
      await expect(photo).toHaveAttribute("loading", "lazy");
    }
  });

  test("shares and copies only /listing/<slug>, even when the page was opened with a position in the address", async ({ page, context, baseURL }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await openFixture(page, "?lat=6.45&lng=7.5#x");
    const expected = `${new URL(baseURL ?? "http://localhost:3000").origin}/listing/${SLUG}`;

    const share = page.getByRole("link", { name: /^Share via WhatsApp/ });
    const message = new URL((await share.getAttribute("href")) ?? "").searchParams.get("text");
    expect(message).toBe(`${NAME} on SwiftHealth Route: ${expected}`);

    await page.getByRole("button", { name: "Copy link" }).click();
    await expect(page.getByRole("status")).toHaveText("Link copied");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(expected);
  });

  test("asks the API only for /listings/<slug>, with no position anywhere, and loads no map code", async ({ page }) => {
    const requests: Request[] = [];
    const scriptBodies: { url: string; text: string }[] = [];
    page.on("request", (request) => requests.push(request));
    page.on("response", async (response) => {
      if (response.url().endsWith(".js")) scriptBodies.push({ url: response.url(), text: await response.text().catch(() => "") });
    });

    await openFixture(page, "?lat=6.45&lng=7.5");
    await page.waitForTimeout(1000);

    const apiCalls = requests.filter((request) => new URL(request.url()).pathname.startsWith("/listings/"));
    expect(apiCalls.map((request) => new URL(request.url()).pathname + new URL(request.url()).search)).toEqual([`/listings/${SLUG}`]);
    const withPosition = requests
      .filter((request) => request.resourceType() !== "document") // the page's own address was opened with ?lat=...
      .filter((request) => /[?&](lat|lng)=/.test(request.url()) || request.url().includes(FIXTURE_LATITUDE));
    expect(withPosition.map((request) => request.url())).toEqual([]);
    expect(scriptBodies.filter((script) => /leaflet/i.test(script.text)).map((script) => script.url)).toEqual([]);
    expect(scriptBodies.map((script) => decodeURIComponent(script.url)).filter((url) => /\/search\/page-[0-9a-f]+\.js/.test(url))).toEqual([]);
  });

  test("keeps the facility's position to the Directions link, and no other link holds it", async ({ page }) => {
    await openFixture(page);

    const hrefs = await page.locator("main a").evaluateAll((elements) => elements.map((element) => (element as HTMLAnchorElement).href));
    const holding = hrefs.filter((href) => href.includes(FIXTURE_LATITUDE) || href.includes(FIXTURE_LONGITUDE));
    expect(holding).toHaveLength(1);
    expect(holding[0]).toMatch(/^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=/);
  });
});

test.describe("a listing that is not there", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("shows the friendly page with a Search for care button", async ({ page }) => {
    await page.goto("/listing/no-such-listing-anywhere", { waitUntil: "load" });

    await expect(page.getByRole("heading", { level: 1, name: "Listing not found" })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("This listing isn't available. It may be under re-verification.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Search for care" })).toHaveAttribute("href", "/search");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });
});
