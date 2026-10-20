/** The import and export screen in a real browser, at 320, 360, 768 and 1024 px. Requirements: FR-39, FR-40, NFR-06, NFR-10.
 * Spec: specs/2026-10-20-launch-readiness/. The API is faked (tests/helpers/browserApi.ts): no listing is created.
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
  test.describe(`import and export at ${width} px`, () => {
    test.use({ viewport: { width, height } });

    test("fits the screen, imports a chosen file with the token and lists the skipped rows, and downloads a CSV", async ({ page }) => {
      await logInAs(page, "admin", 1);
      const seen = await fakeApi(page, (request) => {
        if (request.path === "/admin/import") return { body: { created: 2, errors: [{ row: 3, detail: "Unknown area" }] } };
        return null;
      });
      await page.route("http://localhost:8000/admin/export*", async (route) => {
        await route.fulfill({ status: 200, contentType: "text/csv", headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" }, body: "id,name\n1,Night Pharmacy\n" });
      });
      await page.goto("/admin/import-export", { waitUntil: "load" });

      await expect(page.getByRole("heading", { level: 1, name: "Import and export" })).toBeVisible({ timeout: 60_000 });
      await expect(page.getByRole("link", { name: "Import and export" })).toBeVisible(); // in the staff bar
      await allIsInsideTheScreen(page, width);
      await targetsAndTextAreBigEnough(page);

      await page.getByLabel("CSV file").setInputFiles({ name: "listings.csv", mimeType: "text/csv", buffer: Buffer.from("name,category\nA,pharmacy\n") });
      await page.getByRole("button", { name: "Import" }).click();
      await expect(page.getByText("2 listings were created as drafts.")).toBeVisible();
      await expect(page.getByText("Row 3: Unknown area")).toBeVisible();
      const imported = seen.find((request) => request.path === "/admin/import");
      expect(imported?.authorization).toBe("Bearer fake.token.value");
      await allIsInsideTheScreen(page, width);

      const downloading = page.waitForEvent("download");
      await page.getByRole("button", { name: "Download listings (CSV)" }).click();
      const file = await downloading;
      expect(file.suggestedFilename()).toBe("listings.csv");
    });

    test("is closed to an editor", async ({ page }) => {
      await logInAs(page, "editor");
      await fakeApi(page, () => null);
      await page.goto("/admin/import-export", { waitUntil: "load" });

      await expect(page.getByText("Your role cannot open this page.")).toBeVisible({ timeout: 60_000 });
      await expect(page.getByRole("button", { name: "Import" })).toHaveCount(0);
    });
  });
}
