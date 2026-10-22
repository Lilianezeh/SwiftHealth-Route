/** The footer's "Staff and provider login" link in a real browser, at 320, 360, 768 and 1024 px. Requirements: US-13, NFR-10, FR-30.
 * Owner's request of 2026-10-22; UI spec "Layout" (Footer). The login calls are faked with `page.route` (tests/helpers/browserApi.ts):
 * no password exists here and nothing is written to the database. It checks that the footer stays tidy (nothing wider than the
 * screen, every link 48 px high, text 16 px or more) and that each role lands where it should after the login.
 */
import { expect, test, type Page } from "@playwright/test";

import { fakeApi } from "../helpers/browserApi";

const WIDTHS = [
  { width: 320, height: 640 },
  { width: 360, height: 740 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
];

const STATS = {
  listings_by_status: { draft: 0, pending_review: 0, published: 4, recheck_due: 0, hidden: 0 },
  rechecks_due_this_week: 0, overdue_rechecks: 0, open_reports: 0, urgent_reports: 0,
  checks_last_30_days: Array.from({ length: 30 }, (_unused, index) => ({ date: `2026-10-${String(index + 1).padStart(2, "0")}`, passed: 0, failed: 0 })),
  featured_active: 0,
};

const PROVIDER_LISTING = {
  id: 12, slug: "demo-clinic", name: "Demo Clinic", category: { slug: "clinic", name: "Clinic" }, area: "Ogui", address: "1 Example Road",
  latitude: 6.45, longitude: 7.5, distance_km: null, is_open_now: true, is_24_hours: false, primary_phone: "+2340000000012",
  last_verified_at: null, verification_due: false, sponsored: false, hours_note: null, landmark: null, description: null,
  entrance_photo_url: null, phones: [], opening_hours: [], services: [], recently_reported_not_working: false, disclaimer: "Directory only.",
  status: "published", next_check_due: null, owner_id: 3, created_by: null, featured_until: null, map_pin_is_default: false,
  submission_details: null, featured_price_naira: "5000.00",
};

async function fakeLoginAs(page: Page, role: string) {
  await fakeApi(page, (request) => {
    if (request.path === "/auth/login") return { body: { challenge_token: "challenge.jwt", sent_to: "+234******0001" } };
    if (request.path === "/auth/verify-code") {
      return { body: { access_token: "access.jwt", token_type: "bearer", expires_in: 43200, user: { id: 3, name: "Ada", email: "a@b.co", phone: "+2340000000001", role, is_active: true } } };
    }
    if (request.path === "/provider/listing") return { body: PROVIDER_LISTING };
    if (request.path === "/dashboard/stats") return { body: STATS };
    if (request.path === "/listings") return { body: { items: [], total: 0 } };
    return null;
  });
}

async function logIn(page: Page) {
  await page.getByLabel("Email").fill("ada@example.com");
  await page.getByLabel("Password").fill("a-long-password");
  await page.getByRole("button", { name: "Send me a code" }).click();
  await page.getByLabel("6-digit code").fill("482913");
  await page.getByRole("button", { name: "Log in" }).click();
}

for (const { width, height } of WIDTHS) {
  test.describe(`footer login link at ${width} px`, () => {
    test.use({ viewport: { width, height } });

    test("the footer stays tidy: nothing wider than the screen, links 48 px high, text 16 px or more", async ({ page }) => {
      await page.goto("/privacy", { waitUntil: "load" });
      const footer = page.locator("footer");
      await expect(footer.getByRole("link", { name: "Staff and provider login" })).toBeVisible({ timeout: 60_000 });

      // The footer itself (not the header: it has a known width problem with this machine's fallback font between 344 and 370 px, see LOG.md).
      const overflow = await footer.evaluate((element) => element.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      for (const link of await footer.getByRole("link").all()) {
        const box = await link.boundingBox();
        expect(box?.height ?? 0, await link.innerText()).toBeGreaterThanOrEqual(47.5);
        expect(box!.x).toBeGreaterThanOrEqual(-0.5);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width + 0.5);
      }
      const small = await footer.evaluate((element) =>
        [element, ...element.querySelectorAll("*")]
          .filter((node) => (node.textContent ?? "").trim() !== "" && node.children.length === 0)
          .filter((node) => parseFloat(getComputedStyle(node).fontSize) < 16)
          .map((node) => node.textContent),
      );
      expect(small).toEqual([]);
      // The login link has its own line, under the information links and above the © line.
      const login = await footer.getByRole("link", { name: "Staff and provider login" }).boundingBox();
      const lastInfo = await footer.getByRole("link", { name: "List your facility" }).boundingBox();
      const copyright = await footer.getByText("© 2026 SwiftHealth Route").boundingBox();
      expect(login!.y).toBeGreaterThanOrEqual(lastInfo!.y + lastInfo!.height - 1);
      expect(copyright!.y).toBeGreaterThanOrEqual(login!.y + login!.height - 1);
    });

    test("from the footer to the login page", async ({ page }) => {
      await page.goto("/privacy", { waitUntil: "load" });

      await page.locator("footer").getByRole("link", { name: "Staff and provider login" }).click();

      await expect(page).toHaveURL(/\/admin\/login$/, { timeout: 60_000 });
      await expect(page.getByRole("heading", { level: 1, name: "Staff login" })).toBeVisible();
    });

    test("a provider who logs in there ends up at /provider", async ({ page }) => {
      await fakeLoginAs(page, "provider");
      await page.goto("/", { waitUntil: "load" });
      await page.locator("footer").getByRole("link", { name: "Staff and provider login" }).click();
      await expect(page.getByRole("heading", { level: 1, name: "Staff login" })).toBeVisible({ timeout: 60_000 });

      await logIn(page);

      await expect(page).toHaveURL(/\/provider$/, { timeout: 60_000 });
      await expect(page.getByRole("heading", { level: 1, name: "My facility" })).toBeVisible();
    });

    test("an editor ends up at the dashboard and a verifier at their own drafts", async ({ page }) => {
      for (const [role, address, heading] of [
        ["editor", /\/admin$/, "Dashboard"],
        ["verifier", /\/admin\/listings\?mine=true$/, "Listings"],
      ] as const) {
        await fakeLoginAs(page, role);
        await page.goto("/admin/login", { waitUntil: "load" });
        await logIn(page);
        await expect(page).toHaveURL(address, { timeout: 60_000 });
        await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
        await page.evaluate(() => window.sessionStorage.clear());
        await page.unroute(/localhost:8000/).catch(() => {});
      }
    });
  });
}
