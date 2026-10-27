/** Dark mode in a real browser. Requirements: NFR-10, FR-02; the owner's request of 2026-10-26. Spec: ui-spec "Dark mode"
 * (specs/2026-10-27-dark-mode/). It follows the system by default, has no flash, the Theme button cycles Light, Dark, System and keeps
 * only Light and Dark, the 112 card stays clearly red, and nothing runs off the screen at 320, 360, 768 and 1024 px in the dark.
 * It needs the site running (playwright.config.ts); GET /meta goes to the real API.
 */
import { expect, test } from "@playwright/test";

import { allIsInsideTheScreen, fakeApi } from "../helpers/browserApi";

const WIDTHS = [
  { width: 320, height: 640 },
  { width: 360, height: 740 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
];
const MENU_BELOW = 768; // the Menu button replaces the bar links below this width

const background = (page: import("@playwright/test").Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const theme = (page: import("@playwright/test").Page) =>
  page.evaluate(() => document.documentElement.getAttribute("data-theme"));

test.describe("the system decides by default", () => {
  test.use({ colorScheme: "dark", viewport: { width: 1024, height: 768 } });

  test("a dark system gives a dark page, with the theme set before the page is drawn (no flash)", async ({ page }) => {
    await page.addInitScript(() => {
      document.addEventListener("DOMContentLoaded", () => {
        (window as unknown as { themeAtLoad: string | null }).themeAtLoad = document.documentElement.getAttribute("data-theme");
      });
    });
    await page.goto("/find", { waitUntil: "load" });

    expect(await page.evaluate(() => (window as unknown as { themeAtLoad: string | null }).themeAtLoad)).toBe("dark");
    expect(await theme(page)).toBe("dark");
    expect(await background(page)).toBe("rgb(11, 17, 16)");
    expect(await page.evaluate(() => window.localStorage.getItem("swifthealth.theme"))).toBeNull(); // nothing kept for a person who never chose
  });
});

test.describe("a light system", () => {
  test.use({ colorScheme: "light", viewport: { width: 1024, height: 768 } });

  test("gives the light page, unchanged", async ({ page }) => {
    await page.goto("/find", { waitUntil: "load" });

    expect(await theme(page)).toBe("light");
    expect(await background(page)).toBe("rgb(246, 243, 236)");
  });

  test("a kept Dark wins over the system, from the first paint of the next page", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("swifthealth.theme", "dark"));
    await page.goto("/find", { waitUntil: "load" });

    expect(await theme(page)).toBe("dark");
    expect(await background(page)).toBe("rgb(11, 17, 16)");
  });
});

test.describe("the Theme button in the bar (from tablet width)", () => {
  test.use({ colorScheme: "light", viewport: { width: 1024, height: 768 } });

  test("cycles Light, Dark, System, applies each at once, and keeps only Light and Dark", async ({ page }) => {
    await page.goto("/find", { waitUntil: "load" });
    const button = () => page.getByRole("button", { name: /^Colour theme:/ });
    await expect(button()).toHaveAccessibleName("Colour theme: System. Change to Light.", { timeout: 30_000 });

    await button().click();
    await expect(button()).toHaveAccessibleName("Colour theme: Light. Change to Dark.");
    expect(await theme(page)).toBe("light");
    expect(await page.evaluate(() => window.localStorage.getItem("swifthealth.theme"))).toBe("light");

    await button().click();
    await expect(button()).toHaveAccessibleName("Colour theme: Dark. Change to System.");
    expect(await theme(page)).toBe("dark");
    expect(await background(page)).toBe("rgb(11, 17, 16)");
    expect(await page.evaluate(() => window.localStorage.getItem("swifthealth.theme"))).toBe("dark");

    await page.reload({ waitUntil: "load" });
    expect(await theme(page)).toBe("dark");
    await expect(button()).toHaveAccessibleName("Colour theme: Dark. Change to System.", { timeout: 30_000 });

    await button().click();
    await expect(button()).toHaveAccessibleName("Colour theme: System. Change to Light.");
    expect(await theme(page)).toBe("light"); // the system is light here
    expect(await page.evaluate(() => window.localStorage.getItem("swifthealth.theme"))).toBeNull();
  });

  test("follows the system when it changes while System is chosen", async ({ page }) => {
    await page.goto("/find", { waitUntil: "load" });
    expect(await theme(page)).toBe("light");

    await page.emulateMedia({ colorScheme: "dark" });

    await expect.poll(() => theme(page)).toBe("dark");
  });
});

test.describe("the Theme button in the Menu (a phone)", () => {
  test.use({ colorScheme: "light", viewport: { width: 360, height: 740 } });

  test("is the last row of the Menu, with words, and works", async ({ page }) => {
    await page.goto("/find", { waitUntil: "load" });
    await page.getByRole("button", { name: "Menu" }).click({ timeout: 30_000 });

    const row = page.getByRole("button", { name: "Theme: System" });
    await expect(row).toBeVisible();
    const box = await row.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(48);
    await row.click();
    await expect(page.getByRole("button", { name: "Theme: Light" })).toBeVisible();
    await page.getByRole("button", { name: "Theme: Light" }).click();
    await expect(page.getByRole("button", { name: "Theme: Dark" })).toBeVisible();
    expect(await theme(page)).toBe("dark");
  });
});

test.describe("the 112 card stays clearly red", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  for (const scheme of ["light", "dark"] as const) {
    test(`in the ${scheme} mode: a red border and the red Call 112 button with white text`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/emergency", { waitUntil: "load" });

      const card = page.getByRole("region", { name: /National emergency number/ });
      const border = await card.evaluate((element) => getComputedStyle(element).borderTopColor);
      const [red, green, blue] = (border.match(/\d+/g) ?? []).map(Number);
      expect(red).toBeGreaterThan(green + 60);
      expect(red).toBeGreaterThan(blue + 60);
      const call = page.getByRole("link", { name: "Call 112" });
      expect(await call.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe("rgb(179, 38, 30)");
      expect(await call.evaluate((element) => getComputedStyle(element).color)).toBe("rgb(255, 255, 255)");
    });
  }
});

for (const { width, height } of WIDTHS) {
  test.describe(`the dark mode at ${width} px`, () => {
    test.use({ viewport: { width, height }, colorScheme: "dark" });

    for (const path of ["/", "/find", "/emergency", "/privacy", "/for-facilities", "/log-in"]) {
      test(`${path}: nothing runs off the screen and the text stays 16 px or more`, async ({ page }) => {
        await fakeApi(page, () => null);
        await page.goto(path, { waitUntil: "load" });
        await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({ timeout: 60_000 });

        expect(await theme(page)).toBe("dark");
        if (width >= MENU_BELOW || path !== "/") await allIsInsideTheScreen(page, width);
        const small = await page.evaluate(() => {
          const offenders: string[] = [];
          for (const element of document.querySelectorAll("main *, footer *")) {
            const own = [...element.childNodes].some((node) => node.nodeType === 3 && (node.textContent ?? "").trim() !== "");
            if (own && parseFloat(getComputedStyle(element).fontSize) < 16) offenders.push(element.tagName);
          }
          return offenders;
        });
        expect(small).toEqual([]);
      });
    }
  });
}
