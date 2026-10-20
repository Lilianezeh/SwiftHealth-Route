/** "List your facility" in a real browser, at 320, 360, 768 and 1024 px. Requirements: FR-37, NFR-06, NFR-07, NFR-10.
 * Spec: specs/2026-10-20-staff-screens/ (plan Task 14). The submission call is faked (tests/helpers/browserApi.ts): no draft is made in
 * the development database. GET /meta goes to the real API.
 */
import { expect, test } from "@playwright/test";

import { allIsInsideTheScreen, fakeApi, targetsAndTextAreBigEnough } from "../helpers/browserApi";

const WIDTHS = [
  { width: 320, height: 640 },
  { width: 360, height: 740 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
];

for (const { width, height } of WIDTHS) {
  test.describe(`List your facility at ${width} px`, () => {
    test.use({ viewport: { width, height } });

    test("the form fits the screen, has big fields, and sends what was typed", async ({ page }) => {
      const seen = await fakeApi(page, (request) =>
        request.path === "/facility-submissions" ? { status: 201, body: { message: "Thanks." } } : null,
      );
      await page.goto("/list-your-facility", { waitUntil: "load" });

      await expect(page.getByRole("heading", { level: 1, name: "List your facility" })).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText("Listing is free during our launch. Our team checks every listing before it goes live.")).toBeVisible();
      await expect(page.getByRole("option", { name: "Clinic" })).toBeAttached({ timeout: 60_000 });
      await allIsInsideTheScreen(page, width);
      await targetsAndTextAreBigEnough(page);

      await page.getByLabel("Facility name").fill("Example Clinic");
      await page.getByLabel("Category").selectOption("clinic");
      await page.getByLabel("Area").selectOption({ index: 1 });
      await page.getByLabel("Address").fill("4 Example Street");
      await page.getByLabel("Phone number").fill("0803 000 0000");
      await page.getByLabel("Your name").fill("Dr. Example");
      await page.getByLabel("Your email").fill("owner@example.com");
      await page.getByRole("button", { name: "Send" }).click();

      await expect(page.getByText("Thanks. We'll verify your facility before it's listed.")).toBeVisible();
      const post = seen.find((request) => request.path === "/facility-submissions");
      expect(post?.body).toMatchObject({ facility_name: "Example Clinic", category: "clinic", phone: "0803 000 0000", contact_email: "owner@example.com" });
      expect(post?.search).toBe("");
      await expect(page.getByLabel("Your email")).toHaveCount(0); // the personal details are gone from the page
      await allIsInsideTheScreen(page, width);
    });

    test("a wrong phone number and email are named in words and nothing is sent", async ({ page }) => {
      const seen = await fakeApi(page, () => null);
      await page.goto("/list-your-facility", { waitUntil: "load" });
      await expect(page.getByRole("option", { name: "Clinic" })).toBeAttached({ timeout: 60_000 });
      await page.getByLabel("Phone number").fill("12345");
      await page.getByLabel("Your email").fill("not-an-email");

      await page.getByRole("button", { name: "Send" }).click();

      const problems = page.locator("main [role=alert]"); // not Next.js's own route announcer, which is also an alert
      await expect(problems).toContainText("Check the phone number. It should look like 0803 123 4567.");
      await expect(problems).toContainText("Check the email address.");
      expect(seen.filter((request) => request.path === "/facility-submissions")).toHaveLength(0);
      await allIsInsideTheScreen(page, width);
    });

    test("the rate limit message shows and the form keeps what was typed", async ({ page }) => {
      await fakeApi(page, (request) =>
        request.path === "/facility-submissions" ? { status: 429, body: { detail: "x" } } : null,
      );
      await page.goto("/list-your-facility", { waitUntil: "load" });
      await expect(page.getByRole("option", { name: "Clinic" })).toBeAttached({ timeout: 60_000 });
      await page.getByLabel("Facility name").fill("Example Clinic");
      await page.getByLabel("Category").selectOption("clinic");
      await page.getByLabel("Area").selectOption({ index: 1 });
      await page.getByLabel("Address").fill("4 Example Street");
      await page.getByLabel("Phone number").fill("0803 000 0000");
      await page.getByLabel("Your name").fill("Dr. Example");
      await page.getByLabel("Your email").fill("owner@example.com");

      await page.getByRole("button", { name: "Send" }).click();

      await expect(page.getByText("You've sent several submissions. Please try again tomorrow.")).toBeVisible();
      await expect(page.getByLabel("Facility name")).toHaveValue("Example Clinic");
    });
  });
}
