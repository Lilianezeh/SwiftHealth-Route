/** Find blood and Donate blood in a real browser, at 320, 360, 768 and 1024 px. Requirements: US-15, US-16, FR-27, FR-28, FR-29,
 * FR-19, NFR-07, NFR-10. Spec: specs/2026-10-20-blood/ (plan Task 6).
 * Layout checks use a fake API (fixed data, nothing written anywhere); the last test of each group asks the real local API
 * (it needs the site and the API running with the seed data, see playwright.config.ts).
 */
import { expect, test } from "@playwright/test";

import { allIsInsideTheScreen, fakeApi, targetsAndTextAreBigEnough, type FakeRequest } from "../helpers/browserApi";

const WIDTHS = [
  { width: 320, height: 640 },
  { width: 360, height: 740 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
];

const LISTING = {
  category: { slug: "blood-bank", name: "Blood bank" },
  area: "Ogui",
  address: "1 Fictional Road, Ogui, Enugu",
  latitude: 6.45,
  longitude: 7.5,
  distance_km: null,
  is_open_now: true,
  is_24_hours: false,
  primary_phone: "+2340000000012",
  last_verified_at: new Date().toISOString(),
  verification_due: false,
  sponsored: false,
  hours_note: "Closes 9:00 PM",
};

const WEEK = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
  day_of_week: day,
  opens_at: day < 5 ? "08:00" : null,
  closes_at: day < 5 ? "17:00" : null,
  is_closed: day >= 5,
}));

function bank(id: number, groups: string[]) {
  return {
    ...LISTING,
    id,
    slug: `demo-bank-${id}`,
    name: `Demo Blood Bank Number ${id} With A Long Name`,
    blood_groups: groups,
    blood_groups_confirmed_at: "2026-10-01",
    stock_note: "Stock changes daily; call to confirm before you go.",
  };
}

function fakeBlood(request: FakeRequest) {
  if (request.path === "/blood/banks") {
    const group = new URLSearchParams(request.search).get("blood_group");
    const items = [bank(1, ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]), bank(2, ["O+"]), bank(3, [])];
    return { body: { items: group ? items.filter((item) => item.blood_groups.includes(group)) : items, total: 3 } };
  }
  if (request.path === "/blood/donation-centres") {
    return { body: { items: [{ ...bank(4, []), donation_hours: WEEK }], total: 1 } };
  }
  return null;
}

for (const { width, height } of WIDTHS) {
  test.describe(`Blood pages at ${width} px`, () => {
    test.use({ viewport: { width, height } });

    test("Find blood: tabs, nine chips, cards with groups, big targets, nothing wider than the screen", async ({ page }) => {
      const seen = await fakeApi(page, fakeBlood);
      await page.goto("/blood", { waitUntil: "load" });
      await expect(page.getByRole("heading", { level: 1, name: "Find blood" })).toBeVisible({ timeout: 60_000 });
      await expect(page.getByRole("article")).toHaveCount(3, { timeout: 60_000 });

      await expect(page.getByRole("navigation", { name: "Blood" }).locator('a[aria-current="page"]')).toHaveText("Find blood");
      await expect(page.getByRole("group", { name: "Blood group" }).getByRole("button")).toHaveCount(9);
      await expect(page.getByText("3 blood banks, A to Z")).toBeVisible();
      await expect(page.getByText("Sponsored")).toHaveCount(0);
      await allIsInsideTheScreen(page, width);
      await targetsAndTextAreBigEnough(page);

      await page.getByRole("button", { name: "O+", exact: true }).click();
      await expect(page.getByRole("article")).toHaveCount(2);
      expect(seen.some((request) => request.search.includes("blood_group=O%2B"))).toBe(true);
      expect(page.url()).not.toMatch(/blood_group|lat=|lng=/); // the choice and the position are never in the address
      await allIsInsideTheScreen(page, width);
    });

    test("Find blood: the position is asked only after the tap, sent as lat and lng, and never put in the address", async ({ page, context }) => {
      await context.grantPermissions(["geolocation"]);
      await context.setGeolocation({ latitude: 6.452, longitude: 7.51 });
      const seen = await fakeApi(page, fakeBlood);
      await page.goto("/blood", { waitUntil: "load" });
      await expect(page.getByRole("article")).toHaveCount(3, { timeout: 60_000 });
      expect(seen.some((request) => request.search.includes("lat="))).toBe(false);

      await page.getByRole("button", { name: "Show blood banks near me" }).click();

      await expect.poll(() => seen.some((request) => request.search.includes("lat=6.452"))).toBe(true);
      expect(page.url()).not.toMatch(/lat|lng|6\.452/);
    });

    test("Donate blood: the guidance placeholder, the closing sentence, a centre with its week of hours", async ({ page }) => {
      await fakeApi(page, fakeBlood);
      await page.goto("/blood/donate", { waitUntil: "load" });
      await expect(page.getByRole("heading", { level: 1, name: "Donate blood" })).toBeVisible({ timeout: 60_000 });
      await expect(page.getByRole("article")).toHaveCount(1, { timeout: 60_000 });

      await expect(page.getByText("Donor guidance is being prepared with our medical advisor.")).toBeVisible();
      await expect(page.getByText("The blood bank will confirm if you can donate.")).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Blood" }).locator('a[aria-current="page"]')).toHaveText("Donate blood");

      await expect(page.getByRole("row").first()).toBeHidden(); // the week of hours is closed until the visitor opens it
      await page.getByText("Donation hours").click();
      await expect(page.getByRole("row")).toHaveCount(7);
      await expect(page.getByText("Sponsored")).toHaveCount(0);
      await allIsInsideTheScreen(page, width);
      await targetsAndTextAreBigEnough(page);
    });

    test("both pages work with the real local API", async ({ page }) => {
      await page.goto("/blood", { waitUntil: "load" });
      await expect(page.getByRole("heading", { level: 1, name: "Find blood" })).toBeVisible({ timeout: 60_000 });
      await expect(page.getByRole("article").first()).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText("Sponsored")).toHaveCount(0);

      await page.getByRole("navigation", { name: "Blood" }).getByRole("link", { name: "Donate blood" }).click();
      await expect(page.getByRole("heading", { level: 1, name: "Donate blood" })).toBeVisible();
      await expect(page.getByRole("article").first()).toBeVisible({ timeout: 60_000 });
      await allIsInsideTheScreen(page, width);
    });
  });
}
