/** The provider screens and the Sponsored label in a real browser, at 320, 360, 768 and 1024 px.
 * Requirements: FR-43, FR-44, FR-45, FR-46, NFR-10. Spec: specs/2026-10-20-providers-payments/ (plan Task 8).
 * The calls are faked with `page.route` (tests/helpers/browserApi.ts): no provider password exists here, Paystack is never called
 * and nothing is written to the database. The unit tests cover the rules; this one measures the real layout and flow.
 */
import { expect, test } from "@playwright/test";

import { allIsInsideTheScreen, fakeApi, logInAs, targetsAndTextAreBigEnough, type FakeRequest } from "../helpers/browserApi";

const WIDTHS = [
  { width: 320, height: 640 },
  { width: 360, height: 740 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
];

const WEEK = [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day_of_week: day, opens_at: day < 5 ? "08:00" : null, closes_at: day < 5 ? "17:00" : null, is_closed: day >= 5 }));

function mine(overrides: Record<string, unknown> = {}) {
  return {
    id: 12, slug: "demo-clinic", name: "Demo Clinic With A Rather Long Name For A Phone", category: { slug: "clinic", name: "Clinic" }, area: "Ogui",
    address: "1 Example Road", latitude: 6.45, longitude: 7.5, distance_km: null, is_open_now: true, is_24_hours: false,
    primary_phone: "+2340000000012", last_verified_at: "2026-10-01T10:00:00Z", verification_due: false, sponsored: false, hours_note: null,
    landmark: null, description: "Demo data (fictional).", entrance_photo_url: null,
    phones: [{ number: "+2340000000012", label: "Front desk", is_primary: true, is_whatsapp: false }],
    opening_hours: WEEK,
    services: [{ name: "Consultation", fee_min_naira: "1500.00", fee_max_naira: "3000.00", fee_collected_at: "2026-09-28" }],
    recently_reported_not_working: false, disclaimer: "Directory only.", status: "published", next_check_due: "2026-11-20T09:00:00Z",
    owner_id: 3, created_by: null, featured_until: null, map_pin_is_default: false, submission_details: null, featured_price_naira: "5000.00",
    ...overrides,
  };
}

for (const { width, height } of WIDTHS) {
  test.describe(`provider screens at ${width} px`, () => {
    test.use({ viewport: { width, height } });

    test("my facility: the card, the status and both buttons fit the screen", async ({ page }) => {
      await logInAs(page, "provider");
      await fakeApi(page, (request) => (request.path === "/provider/listing" ? { body: mine({ featured_until: "2026-11-06T09:00:00Z" }) } : null));
      await page.goto("/provider", { waitUntil: "load" });
      await expect(page.getByRole("heading", { level: 1, name: "My facility" })).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText("Featured until 6 Nov 2026")).toBeVisible({ timeout: 60_000 });

      const bar = page.getByRole("navigation", { name: "Staff" });
      for (const name of ["Dashboard", "Edit my facility", "Get featured"]) await expect(bar.getByRole("link", { name })).toBeVisible();
      await expect(page.getByRole("link", { name: "Staff", exact: true })).toHaveCount(0); // none of the staff links
      await allIsInsideTheScreen(page, width);
      await targetsAndTextAreBigEnough(page);
    });

    test("edit: only the four sections, Save sends only the change with the token", async ({ page }) => {
      await logInAs(page, "provider");
      const patches: FakeRequest[] = [];
      await fakeApi(page, (request) => {
        if (request.path === "/provider/listing" && request.method === "PATCH") {
          patches.push(request);
          return { body: mine({ description: (request.body as { description: string }).description }) };
        }
        return request.path === "/provider/listing" ? { body: mine() } : null;
      });
      await page.goto("/provider/edit", { waitUntil: "load" });
      await expect(page.getByRole("heading", { level: 1, name: "Edit my facility" })).toBeVisible({ timeout: 60_000 });
      await expect(page.getByLabel("Description (shown to the public)")).toBeVisible({ timeout: 60_000 });

      for (const name of ["Phones", "Opening hours", "Services and fees", "Description"]) {
        await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
      }
      await expect(page.getByRole("heading", { level: 2, name: "Basics" })).toHaveCount(0);
      await expect(page.getByLabel("Latitude")).toHaveCount(0);
      await allIsInsideTheScreen(page, width);
      await targetsAndTextAreBigEnough(page);

      await page.getByLabel("Description (shown to the public)").fill("Open every weekday.");
      await page.getByRole("button", { name: "Save" }).click();

      await expect(page.getByText("Saved.")).toBeVisible();
      expect(patches).toHaveLength(1);
      expect(patches[0].body).toEqual({ description: "Open every weekday." });
      expect(patches[0].authorization).toBe("Bearer fake.token.value");
      await allIsInsideTheScreen(page, width);
    });

    test("get featured: the price, the Paystack button, and a refusal shown in words (Paystack is never called)", async ({ page }) => {
      await logInAs(page, "provider");
      const started: FakeRequest[] = [];
      await fakeApi(page, (request) => {
        if (request.path === "/provider/listing") return { body: mine() };
        if (request.path === "/payments/featured") {
          started.push(request);
          return { status: 503, body: { detail: "Payments are not set up yet." } };
        }
        return null;
      });
      await page.goto("/provider/featured", { waitUntil: "load" });
      await expect(page.getByRole("heading", { level: 1, name: "Get featured" })).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText("Price: ₦5,000 for 30 days")).toBeVisible({ timeout: 60_000 });
      await allIsInsideTheScreen(page, width);
      await targetsAndTextAreBigEnough(page);

      await page.getByRole("button", { name: "Pay with Paystack" }).click();

      await expect(page.locator("main [role=alert]")).toContainText("Payments are not set up yet."); // not Next's route announcer
      expect(started).toHaveLength(1);
      expect(started[0].body).toEqual({ plan: "monthly" });
      expect(started[0].authorization).toBe("Bearer fake.token.value");
      expect(page.url()).toContain("/provider/featured"); // still here: nothing sent the browser away
      await allIsInsideTheScreen(page, width);
    });

    test("get featured: an address that is not https is never followed", async ({ page }) => {
      await logInAs(page, "provider");
      await fakeApi(page, (request) => {
        if (request.path === "/provider/listing") return { body: mine() };
        if (request.path === "/payments/featured") {
          return { body: { authorization_url: "http://localhost:3000/find?paid=fictional", reference: "SH-12-1", amount_naira: "5000.00" } };
        }
        return null;
      });
      await page.goto("/provider/featured", { waitUntil: "load" });
      await expect(page.getByRole("button", { name: "Pay with Paystack" })).toBeVisible({ timeout: 60_000 });

      await page.getByRole("button", { name: "Pay with Paystack" }).click();

      // An http address is refused (only https is followed), so the browser stays and the sentence appears.
      await expect(page.locator("main [role=alert]")).toContainText("Could not start the payment. Try again.");
      expect(page.url()).toContain("/provider/featured");
    });

    test("payment complete: pending, then confirmed on a later ask; the status is in words", async ({ page }) => {
      await logInAs(page, "provider");
      let asks = 0;
      // The dev server runs effects twice at the start, so "pending" lasts for the first two asks.
      const seen = await fakeApi(page, (request) => {
        if (!request.path.startsWith("/payments/verify/")) return null;
        asks += 1;
        return { body: asks <= 2 ? { status: "pending", featured_until: null } : { status: "success", featured_until: "2026-11-06T09:00:00Z" } };
      });
      await page.goto("/provider/payment-complete?reference=SH-12-1730000000&trxref=SH-12-1730000000", { waitUntil: "load" });
      await expect(page.getByRole("heading", { level: 1, name: "Payment" })).toBeVisible({ timeout: 60_000 });
      await expect(page.getByRole("status")).toContainText("Confirming your payment");
      await allIsInsideTheScreen(page, width);

      await expect(page.getByText("Payment confirmed. Featured until 6 Nov 2026.")).toBeVisible({ timeout: 15_000 });

      expect(seen.filter((request) => request.path === "/payments/verify/SH-12-1730000000").length).toBeGreaterThanOrEqual(3);
      await expect(page.getByRole("link", { name: "Back to my facility" })).toBeVisible();
      await allIsInsideTheScreen(page, width);
      await targetsAndTextAreBigEnough(page);
    });

    test("a staff role cannot open the provider screens", async ({ page }) => {
      await logInAs(page, "editor");
      await fakeApi(page, () => null);
      for (const address of ["/provider", "/provider/edit", "/provider/featured"]) {
        await page.goto(address, { waitUntil: "load" });
        await expect(page.getByText("Your role cannot open this page.")).toBeVisible({ timeout: 60_000 });
      }
    });

    test("search: the one sponsored result is first with the label, and nothing else has it", async ({ page }) => {
      const item = (id: number, sponsored: boolean) => ({
        id, slug: `place-${id}`, name: `Demo Pharmacy Number ${id}`, category: { slug: "pharmacy", name: "Pharmacy" }, area: "Ogui",
        address: "1 Example Road", latitude: 6.45, longitude: 7.5, distance_km: id, is_open_now: true, is_24_hours: false,
        primary_phone: "+2340000000012", last_verified_at: new Date().toISOString(), verification_due: false, sponsored, hours_note: null,
      });
      await fakeApi(page, (request) =>
        request.path === "/search" ? { body: { items: [item(3, true), item(1, false), item(2, false)], total: 3 } } : null,
      );
      await page.goto("/search?lat=6.45&lng=7.5", { waitUntil: "load" });
      await expect(page.getByRole("article")).toHaveCount(3, { timeout: 60_000 });

      await expect(page.getByRole("article").first()).toContainText("Sponsored");
      await expect(page.getByText("Sponsored", { exact: true })).toHaveCount(1);
      await expect(page.getByRole("article").first()).toContainText("Demo Pharmacy Number 3");
      await allIsInsideTheScreen(page, width);
    });
  });
}
