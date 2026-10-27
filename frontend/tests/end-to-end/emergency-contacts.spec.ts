/** The SwiftRescue contacts screen in a real browser, at 320, 360, 768 and 1024 px. Requirements: FR-15, FR-31, FR-32, NFR-10.
 * Spec: specs/2026-10-27-emergency-contacts-admin/. The staff API is faked (tests/helpers/browserApi.ts), so nothing is hidden in the
 * development database. Every name and number is fictional.
 */
import { expect, test } from "@playwright/test";

import { allIsInsideTheScreen, fakeApi, logInAs, targetsAndTextAreBigEnough } from "../helpers/browserApi";

const WIDTHS = [
  { width: 320, height: 640 },
  { width: 360, height: 740 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
];

const GROUPS = [
  ["ambulance", "Ambulance"],
  ["fire", "Fire service"],
  ["police", "Police"],
  ["emergency-unit", "Hospital emergency (24 hours)"],
  ["roadside-assistance", "Road accidents"],
  ["security", "Security"],
  ["disaster-flooding", "Disaster and flooding"],
  ["gbv-support", "Sexual and gender-based violence support"],
  ["mental-health-crisis", "Mental health crisis support"],
];

function contact(id: number, name: string, status: string) {
  return {
    id, slug: `unit-${id}`, name, category: { slug: "ambulance", name: "Ambulance" }, area: "Ogui", address: "1 Example Road",
    latitude: 6.45, longitude: 7.5, distance_km: null, is_open_now: true, is_24_hours: true, primary_phone: "+2348030001234",
    last_verified_at: null, verification_due: false, sponsored: false, hours_note: null, status, next_check_due: null, created_by: null,
  };
}

const ANSWER = {
  groups: GROUPS.map(([slug, name]) => ({
    category: { slug, name },
    contacts: slug === "ambulance" ? [contact(1, "Alpha Ambulance", "published"), contact(2, "Old Ambulance", "hidden")] : [],
    total: slug === "ambulance" ? 2 : 0,
  })),
};

for (const { width, height } of WIDTHS) {
  test.describe(`SwiftRescue contacts at ${width} px`, () => {
    test.use({ viewport: { width, height } });

    test("shows the nine groups, big targets, and nothing runs off the screen", async ({ page }) => {
      await logInAs(page, "editor");
      await fakeApi(page, (request) => (request.path === "/staff/emergency-contacts" ? { status: 200, body: ANSWER } : null));
      await page.goto("/admin/emergency-contacts", { waitUntil: "load" });

      await expect(page.getByRole("heading", { level: 1, name: "SwiftRescue contacts" })).toBeVisible({ timeout: 60_000 });
      await expect(page.getByRole("heading", { level: 2 })).toHaveCount(9);
      await expect(page.getByRole("link", { name: "Add a contact to Police" })).toHaveAttribute("href", "/admin/listings/new?category=police");
      await expect(page.getByRole("button", { name: "Remove Alpha Ambulance" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Remove Old Ambulance" })).toHaveCount(0); // already hidden
      await allIsInsideTheScreen(page, width);
      await targetsAndTextAreBigEnough(page);
    });

    test("removing asks first and then hides the contact with the reason", async ({ page }) => {
      await logInAs(page, "editor");
      const seen = await fakeApi(page, (request) => {
        if (request.path === "/staff/emergency-contacts") return { status: 200, body: ANSWER };
        if (request.path === "/listings/1/hide") return { status: 200, body: { id: 1, status: "hidden" } };
        return null;
      });
      await page.goto("/admin/emergency-contacts", { waitUntil: "load" });
      await page.getByRole("button", { name: "Remove Alpha Ambulance" }).click({ timeout: 60_000 });
      await page.getByLabel("Why is it removed?").fill("No longer runs");
      await page.getByRole("button", { name: "Remove from SwiftRescue" }).click();
      await expect(page.getByText("Remove Alpha Ambulance from SwiftRescue? It will be hidden, not deleted.")).toBeVisible();
      expect(seen.filter((request) => request.method === "POST")).toHaveLength(0);

      await page.getByRole("button", { name: "Yes, remove" }).click();

      await expect(page.getByText("Alpha Ambulance was removed from SwiftRescue. It is hidden, not deleted.")).toBeVisible();
      const post = seen.find((request) => request.path === "/listings/1/hide");
      expect(post?.body).toMatchObject({ reason: "No longer runs" });
      expect(post?.authorization).toMatch(/^Bearer /);
      await allIsInsideTheScreen(page, width);
    });
  });
}
