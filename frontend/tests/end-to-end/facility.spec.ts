/** "List your facility" in a real browser, at 320, 360, 768 and 1024 px. Requirements: FR-50, FR-51, NFR-06, NFR-07, NFR-10.
 * Spec: specs/2026-10-23-accounts-and-facility-ownership/ (plan, Phase 7). The registration and claim calls are faked
 * (tests/helpers/browserApi.ts): no draft or link is made in the development database. GET /meta goes to the real API.
 */
import { expect, test } from "@playwright/test";

import { allIsInsideTheScreen, fakeApi, logInAs, targetsAndTextAreBigEnough } from "../helpers/browserApi";

const WIDTHS = [
  { width: 320, height: 640 },
  { width: 360, height: 740 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
];

for (const { width, height } of WIDTHS) {
  test.describe(`List your facility at ${width} px`, () => {
    test.use({ viewport: { width, height } });

    test("a visitor is asked to log in, and the page fits the screen", async ({ page }) => {
      const seen = await fakeApi(page, () => null);
      await page.goto("/list-your-facility", { waitUntil: "load" });

      await expect(page.getByRole("heading", { level: 1, name: "List your facility" })).toBeVisible({ timeout: 60_000 });
      await expect(page.getByRole("link", { name: "Log in" }).last()).toHaveAttribute("href", "/log-in?next=/list-your-facility");
      await expect(page.getByLabel("Facility name", { exact: true })).toHaveCount(0);
      await allIsInsideTheScreen(page, width);
      await targetsAndTextAreBigEnough(page);
      expect(seen.filter((request) => request.path.startsWith("/provider"))).toHaveLength(0);
    });

    test("a provider sees the form, big fields, and sends what was typed with the token", async ({ page }) => {
      await logInAs(page, "provider");
      const seen = await fakeApi(page, (request) =>
        request.path === "/provider/facilities" ? { status: 201, body: { message: "Thanks.", listing_id: 7, link_id: 8, status: "awaiting_payment", fee_naira: "10000.00" } } : null,
      );
      await page.goto("/list-your-facility", { waitUntil: "load" });

      await expect(page.getByRole("heading", { level: 2, name: "Register a new facility" })).toBeVisible({ timeout: 60_000 });
      await expect(page.getByRole("option", { name: "Clinic" })).toBeAttached({ timeout: 60_000 });
      await allIsInsideTheScreen(page, width);
      await targetsAndTextAreBigEnough(page);

      await page.getByLabel("Facility name", { exact: true }).fill("Example Clinic");
      await page.getByLabel("Category").selectOption("clinic");
      await page.getByLabel("Area", { exact: true }).selectOption({ index: 1 });
      await page.getByLabel("Address").fill("4 Example Street");
      await page.getByLabel("Phone number of the facility").fill("0803 000 0000");
      await page.getByRole("button", { name: "Send", exact: true }).click();

      await expect(page.getByText(/Pay the first month \(₦10,000\) and we'll verify your facility before it's listed\./)).toBeVisible();
      await expect(page.getByRole("button", { name: "Pay ₦10,000 to send your request" })).toBeVisible();
      const post = seen.find((request) => request.path === "/provider/facilities");
      expect(post?.body).toMatchObject({ facility_name: "Example Clinic", category: "clinic", phone: "0803 000 0000", role: "owner" });
      expect(post?.authorization).toMatch(/^Bearer /);
      expect(post?.search).toBe("");
      await allIsInsideTheScreen(page, width);
    });

    test("a wrong phone number is named in words and nothing is sent", async ({ page }) => {
      await logInAs(page, "provider");
      const seen = await fakeApi(page, () => null);
      await page.goto("/list-your-facility", { waitUntil: "load" });
      await expect(page.getByRole("option", { name: "Clinic" })).toBeAttached({ timeout: 60_000 });
      await page.getByLabel("Phone number of the facility").fill("12345");

      await page.getByRole("button", { name: "Send", exact: true }).click();

      const problems = page.locator("main [role=alert]"); // not Next.js's own route announcer, which is also an alert
      await expect(problems).toContainText("Check the phone number. It should look like 0803 123 4567.");
      expect(seen.filter((request) => request.path === "/provider/facilities")).toHaveLength(0);
      await allIsInsideTheScreen(page, width);
    });

    test("a similar facility is offered for claiming, and the claim is sent", async ({ page }) => {
      await logInAs(page, "provider");
      const seen = await fakeApi(page, (request) => {
        if (request.path === "/provider/facilities") {
          return { status: 409, body: { detail: { message: "A facility like this is already listed. You can ask to manage it instead.", listing_id: 41 } } };
        }
        if (request.path === "/provider/claims") return { status: 201, body: { message: "Thanks. Pay the first month and our team will phone the facility to check.", link_id: 9, status: "awaiting_payment", fee_naira: "10000.00" } };
        return null;
      });
      await page.goto("/list-your-facility", { waitUntil: "load" });
      await expect(page.getByRole("option", { name: "Clinic" })).toBeAttached({ timeout: 60_000 });
      await page.getByLabel("Facility name", { exact: true }).fill("Example Clinic");
      await page.getByLabel("Category").selectOption("clinic");
      await page.getByLabel("Area", { exact: true }).selectOption({ index: 1 });
      await page.getByLabel("Address").fill("4 Example Street");
      await page.getByLabel("Phone number of the facility").fill("0803 000 0000");
      await page.getByRole("button", { name: "Send", exact: true }).click();

      await page.getByRole("button", { name: "Ask to manage it" }).click();
      await page.getByLabel("How are you connected to this facility?").fill("I run the front desk.");
      await page.getByRole("button", { name: "Send request" }).click();

      await expect(page.getByText("Thanks. Pay the first month (₦10,000) and our team will phone the facility to check.")).toBeVisible();
      const claim = seen.find((request) => request.path === "/provider/claims");
      expect(claim?.body).toMatchObject({ listing_id: 41, role: "owner", reason: "I run the front desk." });
      await allIsInsideTheScreen(page, width);
    });

    test("the rate limit message shows and the form keeps what was typed", async ({ page }) => {
      await logInAs(page, "provider");
      await fakeApi(page, (request) =>
        request.path === "/provider/facilities" ? { status: 429, body: { detail: "x" } } : null,
      );
      await page.goto("/list-your-facility", { waitUntil: "load" });
      await expect(page.getByRole("option", { name: "Clinic" })).toBeAttached({ timeout: 60_000 });
      await page.getByLabel("Facility name", { exact: true }).fill("Example Clinic");
      await page.getByLabel("Category").selectOption("clinic");
      await page.getByLabel("Area", { exact: true }).selectOption({ index: 1 });
      await page.getByLabel("Address").fill("4 Example Street");
      await page.getByLabel("Phone number of the facility").fill("0803 000 0000");

      await page.getByRole("button", { name: "Send", exact: true }).click();

      await expect(page.getByText("You've sent several submissions. Please try again tomorrow.")).toBeVisible();
      await expect(page.getByLabel("Facility name", { exact: true })).toHaveValue("Example Clinic");
    });
  });
}
