/** The dashboard, the report queue and the re-check lists in a real browser, at 320, 360, 768 and 1024 px.
 * Requirements: US-11, US-12, FR-34, FR-35, NFR-07, NFR-10. Spec: specs/2026-10-20-reports-queue/ (plan Task 7).
 * The staff calls are faked with `page.route` (tests/helpers/browserApi.ts): no staff password exists here and nothing is written to
 * the database. The unit tests cover the rules; this one measures the real layout (and that the chart really draws) in a browser.
 */
import { expect, test } from "@playwright/test";

import { allIsInsideTheScreen, fakeApi, logInAs, targetsAndTextAreBigEnough, type FakeRequest } from "../helpers/browserApi";

const WIDTHS = [
  { width: 320, height: 640 },
  { width: 360, height: 740 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
];

const STATS = {
  listings_by_status: { draft: 12, pending_review: 4, published: 140, recheck_due: 6, hidden: 3 },
  rechecks_due_this_week: 18,
  overdue_rechecks: 2,
  open_reports: 5,
  urgent_reports: 1,
  checks_last_30_days: Array.from({ length: 30 }, (_unused, index) => ({
    date: new Date(Date.UTC(2026, 8, 7 + index)).toISOString().slice(0, 10),
    passed: (index * 7) % 5,
    failed: index % 6 === 0 ? 2 : 0,
  })),
  featured_active: 3,
};

function report(id: number, urgent: boolean) {
  return {
    id,
    listing: { id: 10 + id, slug: `place-${id}`, name: `Demo Clinic Number ${id} With A Long Name`, area: "Ogui", status: urgent ? "recheck_due" : "published" },
    reason: urgent ? "not_working" : "wrong_number",
    comment: "Rang twice, nobody answered. The gate was also locked when I walked past.",
    reporter_phone: urgent ? "+234******0000" : null,
    created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    status: "open",
    urgent,
    resolved_at: null,
  };
}

function dueItem(id: number) {
  return {
    id, slug: `place-${id}`, name: `Demo Pharmacy Number ${id} With A Long Name`, category: { slug: "pharmacy", name: "Pharmacy" }, area: "Ogui",
    address: "1 Example Road", latitude: 6.45, longitude: 7.5, distance_km: null, is_open_now: true, is_24_hours: false, primary_phone: "+2340000000012",
    last_verified_at: null, verification_due: true, sponsored: false, hours_note: null, status: id % 2 ? "published" : "recheck_due",
    next_check_due: "2026-10-05T09:00:00Z", created_by: 3,
  };
}

for (const { width, height } of WIDTHS) {
  test.describe(`queue screens at ${width} px`, () => {
    test.use({ viewport: { width, height } });

    test("dashboard: five cards, the chart really draws, the table is there, and all of it fits the screen", async ({ page }) => {
      await logInAs(page, "editor");
      await fakeApi(page, (request) => (request.path === "/dashboard/stats" ? { body: STATS } : null));
      await page.goto("/admin", { waitUntil: "load" });
      await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText("Published", { exact: true })).toBeVisible({ timeout: 60_000 });

      await expect(page.getByRole("link", { name: /Open reports/ })).toContainText("1 urgent");
      for (const label of ["Published", "Pending review", "Due this week", "Overdue", "Open reports"]) {
        await expect(page.getByRole("link", { name: new RegExp(label) })).toBeVisible();
      }
      // The chart draws bars: the SVG has a size and rectangles in it.
      const surface = page.locator("main .recharts-surface");
      await expect(surface).toBeVisible();
      const box = await surface.boundingBox();
      expect(box?.width ?? 0).toBeGreaterThan(200);
      await expect(page.locator("main .recharts-bar-rectangle").first()).toBeAttached();

      await page.getByText("Show the numbers").click();
      await expect(page.getByRole("row")).toHaveCount(31);
      await allIsInsideTheScreen(page, width);
      await targetsAndTextAreBigEnough(page);
    });

    test("reports: urgent first, cards fit, Resolve sends the call with the token and removes the card", async ({ page }) => {
      await logInAs(page, "editor");
      const resolved: FakeRequest[] = [];
      await fakeApi(page, (request) => {
        if (request.path === "/reports" && request.method === "GET") return { body: { items: [report(1, true), report(2, false)], total: 2 } };
        if (request.path === "/reports/2" && request.method === "PATCH") {
          resolved.push(request);
          return { body: { ...report(2, false), status: "resolved", resolved_at: new Date().toISOString() } };
        }
        return null;
      });
      await page.goto("/admin/reports", { waitUntil: "load" });
      await expect(page.getByRole("heading", { level: 1, name: "Reports" })).toBeVisible({ timeout: 60_000 });
      await expect(page.getByRole("article")).toHaveCount(2, { timeout: 60_000 });

      await expect(page.getByRole("article").first()).toContainText("Urgent");
      await expect(page.getByRole("article").first()).toContainText("0*** *** 0000");
      await allIsInsideTheScreen(page, width);
      await targetsAndTextAreBigEnough(page);

      await page.getByRole("article").nth(1).getByRole("button", { name: "Resolve" }).click();

      await expect(page.getByRole("article")).toHaveCount(1);
      await expect(page.getByRole("status")).toContainText("Report resolved.");
      expect(resolved).toHaveLength(1);
      expect(resolved[0].body).toEqual({ status: "resolved" });
      expect(resolved[0].authorization).toBe("Bearer fake.token.value");
      await allIsInsideTheScreen(page, width);
    });

    test("re-checks: both tabs fit, each asks for its own list, and the rows lead to the verification log", async ({ page }) => {
      await logInAs(page, "admin");
      const seen = await fakeApi(page, (request) => {
        if (request.path !== "/listings") return null;
        const due = new URLSearchParams(request.search).get("due");
        return { body: { items: due === "overdue" ? [dueItem(1), dueItem(2)] : [dueItem(3)], total: due === "overdue" ? 2 : 1 } };
      });
      await page.goto("/admin/recheck", { waitUntil: "load" });
      await expect(page.getByRole("heading", { level: 1, name: "Re-checks" })).toBeVisible({ timeout: 60_000 });
      await expect(page.getByRole("article")).toHaveCount(2, { timeout: 60_000 });
      await allIsInsideTheScreen(page, width);
      await targetsAndTextAreBigEnough(page);

      await page.getByRole("link", { name: "Due this week" }).click();

      await expect(page).toHaveURL(/tab=this_week/);
      await expect(page.getByRole("article")).toHaveCount(1, { timeout: 60_000 });
      await expect(page.getByRole("article")).toContainText("Check due");
      expect(seen.some((request) => request.search.includes("due=this_week"))).toBe(true);
      await expect(page.getByRole("link", { name: "Open verification log" })).toHaveAttribute("href", "/admin/listings/3/checks");
      await allIsInsideTheScreen(page, width);
    });

    test("a verifier cannot open the three screens", async ({ page }) => {
      await logInAs(page, "verifier");
      await fakeApi(page, () => null);
      for (const address of ["/admin/reports", "/admin/recheck"]) {
        await page.goto(address, { waitUntil: "load" });
        await expect(page.getByText("Your role cannot open this page.")).toBeVisible({ timeout: 60_000 });
      }
      await page.goto("/admin", { waitUntil: "load" });
      await expect(page).toHaveURL(/\/admin\/listings\?mine=true$/, { timeout: 60_000 });
    });
  });
}
