/** The sign-up pages and the header links in a real browser, at 320, 360, 768 and 1280 px. Requirements: FR-48, FR-49, FR-02, NFR-10.
 * Spec: specs/2026-10-23-accounts-and-facility-ownership/ (Phase 3b), UI spec 3.1c and "Layout". The API is faked with `page.route`
 * (tests/helpers/browserApi.ts): no account is made and nothing is written to the database. The unit tests cover the rules; this one
 * measures the real layout and the real flow in a browser.
 */
import { expect, test } from "@playwright/test";

import {
  allIsInsideTheScreen, fakeApi, logInAs, targetsAndTextAreBigEnough, type FakeAnswer, type FakeRequest,
} from "../helpers/browserApi";

const WIDTHS = [
  { width: 320, height: 640 },
  { width: 360, height: 740 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
];
const FROM_TABLET = 768;

/** A fake GET /meta that says whether sign-up is open (the header and the login page read it); everything else goes to the API. */
function signUpIs(open: boolean) {
  return (request: FakeRequest): FakeAnswer =>
    request.path === "/meta"
      ? {
          body: {
            areas: ["GRA"], categories: [], services: [], blood_groups: [], report_reasons: [], service_catalogue: [],
            signup_open: open,
          },
        }
      : null;
}

for (const { width, height } of WIDTHS) {
  test.describe(`sign-up at ${width} px`, () => {
    test.use({ viewport: { width, height } });

    test("staff: the choice, the form and the code fit the screen, and the road ends on the waiting page (no Termii)", async ({ page }) => {
      const seen = await fakeApi(page, (request) => {
        if (request.path === "/auth/signup") return { body: { confirm_token: "email.jwt", sent_to: "b***@example.com" } };
        if (request.path === "/auth/confirm-email") return { body: { status: "waiting_for_approval" } };
        return null;
      });
      await page.goto("/sign-up", { waitUntil: "load" });
      await expect(page.getByRole("heading", { level: 1, name: "Sign up" })).toBeVisible({ timeout: 60_000 });
      await allIsInsideTheScreen(page, width);
      await targetsAndTextAreBigEnough(page);

      await page.getByRole("button", { name: /^Staff/ }).click();
      await page.getByLabel("Name").fill("Bola Staff");
      await page.getByLabel("Email").fill("bola.staff@example.com");
      await page.getByLabel("Phone number").fill("0803 000 0456");
      await page.getByLabel("Password", { exact: true }).fill("river-bed-77");
      await page.getByLabel("Who are you, and who can say so?").fill("Verifier at the clinic in Ogui.");
      await allIsInsideTheScreen(page, width);
      await targetsAndTextAreBigEnough(page);
      await page.getByRole("button", { name: "Send me a code" }).click();

      await expect(page.getByText("Code sent to b***@example.com")).toBeVisible({ timeout: 30_000 });
      await expect(page).toHaveURL(/\/sign-up\/confirm$/);
      await allIsInsideTheScreen(page, width);
      await targetsAndTextAreBigEnough(page);
      await page.getByLabel("6-digit code").fill("482913");
      await page.getByRole("button", { name: "Confirm email" }).click();

      await expect(page.getByRole("heading", { level: 1, name: "Thank you. Your request is with an admin." })).toBeVisible({ timeout: 30_000 });
      await allIsInsideTheScreen(page, width);
      await targetsAndTextAreBigEnough(page);
      const signUp = seen.find((request) => request.path === "/auth/signup");
      expect(signUp?.authorization).toBeUndefined();
      expect(signUp?.search).toBe("");
      expect(signUp?.body).toMatchObject({ account_type: "staff", note: "Verifier at the clinic in Ogui." });
    });

    test("facility owner with Termii live: the email code, then the phone code, then the account is ready", async ({ page }) => {
      await fakeApi(page, (request) => {
        if (request.path === "/auth/signup") return { body: { confirm_token: "email.jwt", sent_to: "a***@example.com" } };
        if (request.path === "/auth/confirm-email") return { body: { status: "phone_code_sent", confirm_token: "phone.jwt", sent_to: "+234******0123" } };
        if (request.path === "/auth/confirm-phone") return { body: { status: "active" } };
        return null;
      });
      await page.goto("/sign-up", { waitUntil: "load" });
      await page.getByRole("button", { name: /^Facility owner/ }).click();
      await page.getByLabel("Name").fill("Ada Owner");
      await page.getByLabel("Email").fill("ada.owner@example.com");
      await page.getByLabel("Phone number").fill("0803 000 0123");
      await page.getByLabel("Password", { exact: true }).fill("river78!");
      await page.getByRole("button", { name: "Send me a code" }).click();
      await expect(page.getByText("Code sent to a***@example.com")).toBeVisible({ timeout: 30_000 });
      await page.getByLabel("6-digit code").fill("482913");
      await page.getByRole("button", { name: "Confirm email" }).click();

      await expect(page.getByText("Code sent to ••• ••• 0123")).toBeVisible({ timeout: 30_000 });
      await allIsInsideTheScreen(page, width);
      await targetsAndTextAreBigEnough(page);
      await page.getByLabel("6-digit code").fill("135790");
      await page.getByRole("button", { name: "Confirm phone" }).click();

      await expect(page.getByText("Your account is ready.")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("link", { name: "Log in" }).last()).toHaveAttribute("href", "/log-in");
      await allIsInsideTheScreen(page, width);
    });

    test("/log-in is the login form with a link to sign up while sign-up is open, and fits the screen", async ({ page }) => {
      await fakeApi(page, signUpIs(true));
      await page.goto("/log-in", { waitUntil: "load" });

      await expect(page.getByRole("heading", { level: 1, name: "Log in" })).toBeVisible({ timeout: 60_000 });
      await expect(page.getByRole("link", { name: "Sign up" }).last()).toHaveAttribute("href", "/sign-up");
      await allIsInsideTheScreen(page, width);
      await targetsAndTextAreBigEnough(page);
    });

    test("the header: Log in and Sign up in the bar from tablet width, in the Menu on a phone; SwiftRescue stays red and outside it", async ({ page }) => {
      await fakeApi(page, signUpIs(true));
      await page.goto("/find", { waitUntil: "load" });
      const rescue = page.getByRole("banner").getByRole("link", { name: "SwiftRescue" });
      await expect(rescue).toBeVisible({ timeout: 60_000 });

      if (width >= FROM_TABLET) {
        const bar = page.getByRole("banner");
        await expect(bar.getByRole("link", { name: "Log in" })).toBeVisible();
        await expect(bar.getByRole("link", { name: "Sign up" })).toBeVisible();
        for (const name of ["Log in", "Sign up"]) {
          const box = await bar.getByRole("link", { name }).boundingBox();
          expect(box?.height ?? 0).toBeGreaterThanOrEqual(47.5);
        }
      } else {
        await expect(page.getByRole("banner").getByRole("link", { name: "Log in" })).toBeHidden();
        await page.getByRole("button", { name: "Menu" }).click();
        const menu = page.getByRole("navigation", { name: "Menu links" });
        await expect(menu.getByRole("link", { name: "Log in" })).toBeVisible();
        await expect(menu.getByRole("link", { name: "Sign up" })).toBeVisible();
        await expect(menu.getByRole("link", { name: "SwiftRescue" })).toHaveCount(0);
      }
      await expect(rescue).toHaveCSS("background-color", /^rgb\((2[0-9][0-9]|1[5-9][0-9]), ?\d+, ?\d+\)$/); // the red, and only SwiftRescue
    });

    test("the header: while sign-up is closed there is Log in and no Sign up, in the bar and in the Menu, and nothing is wider than the screen", async ({ page }) => {
      await fakeApi(page, signUpIs(false));
      await page.goto("/find", { waitUntil: "load" });
      const bar = page.getByRole("banner");
      await expect(bar.getByRole("link", { name: "SwiftRescue" })).toBeVisible({ timeout: 60_000 });
      await page.waitForResponse((response) => response.url().endsWith("/meta"));

      await expect(bar.getByRole("link", { name: "Sign up" })).toHaveCount(0);
      if (width >= FROM_TABLET) {
        await expect(bar.getByRole("link", { name: "Log in" })).toBeVisible();
      } else {
        await page.getByRole("button", { name: "Menu" }).click();
        const menu = page.getByRole("navigation", { name: "Menu links" });
        await expect(menu.getByRole("link", { name: "Log in" })).toBeVisible();
        await expect(menu.getByRole("link", { name: "Sign up" })).toHaveCount(0);
      }
      await page.goto("/log-in", { waitUntil: "load" });
      await expect(page.getByRole("heading", { level: 1, name: "Log in" })).toBeVisible({ timeout: 60_000 });
      await expect(page.getByRole("link", { name: "Sign up" })).toHaveCount(0);
    });

    test("the header: a session turns Log in and Sign up into My account, and nothing in the bar moves", async ({ page }) => {
      await fakeApi(page, signUpIs(true));
      await page.goto("/find", { waitUntil: "load" });
      const bar = page.getByRole("banner");
      const rescue = bar.getByRole("link", { name: "SwiftRescue" });
      await expect(rescue).toBeVisible({ timeout: 60_000 });
      // On a phone only SwiftRescue is in the bar (For facilities is in the Menu); from tablet width both are.
      const watched = width >= FROM_TABLET ? ["SwiftRescue", "For facilities"] : ["SwiftRescue"];
      const before = await Promise.all(watched.map((name) => bar.getByRole("link", { name }).boundingBox()));

      await page.evaluate(() => {
        const user = { id: 3, name: "Ada Staff", email: "ada@example.com", phone: "+2340000000001", role: "provider", is_active: true };
        window.sessionStorage.setItem("swifthealth.staff-session", JSON.stringify({ token: "fake.token.value", user }));
        window.dispatchEvent(new Event("swifthealth:staff-session-changed"));
      });

      if (width >= FROM_TABLET) {
        await expect(bar.getByRole("link", { name: "My account" })).toHaveAttribute("href", "/provider");
        await expect(bar.getByRole("link", { name: "Log in" })).toHaveCount(0); // hidden from the accessibility tree
      }
      // Measured before the Menu is opened: opening it moves the bar a little on its own (a known width quirk of this machine's
      // fallback font between 344 and 370 px, see LOG.md), which has nothing to do with the swap.
      const after = await Promise.all(watched.map((name) => bar.getByRole("link", { name }).boundingBox()));
      expect(after).toEqual(before); // the swap moved nothing
      if (width < FROM_TABLET) {
        await page.getByRole("button", { name: "Menu" }).click();
        await expect(page.getByRole("navigation", { name: "Menu links" }).getByRole("link", { name: "My account" })).toBeVisible();
      }
    });
  });
}

test.describe("the old login address", () => {
  test("/admin/login redirects to /log-in with a permanent redirect, and a browser lands on the login", async ({ page, request }) => {
    const answer = await request.get("/admin/login", { maxRedirects: 0 });
    expect(answer.status()).toBe(308);
    expect(new URL(answer.headers()["location"], "http://localhost").pathname).toBe("/log-in"); // the address may be relative

    await page.goto("/admin/login", { waitUntil: "load" });
    await expect(page).toHaveURL(/\/log-in$/);
    await expect(page.getByRole("heading", { level: 1, name: "Log in" })).toBeVisible({ timeout: 60_000 });
  });
});

test.describe("the pages need no account where they never did", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test("SwiftRescue and /find open with no session", async ({ page }) => {
    await fakeApi(page, () => null);
    for (const [address, heading] of [["/emergency", /SwiftRescue/], ["/find", /./]] as const) {
      await page.goto(address, { waitUntil: "load" });
      await expect(page.getByRole("heading", { level: 1 }).first()).toContainText(heading, { timeout: 60_000 });
      expect(page.url()).toContain(address);
    }
  });

  test("a logged-in provider sees My account in the Menu on the home page too", async ({ page }) => {
    await fakeApi(page, () => null);
    await logInAs(page, "provider");
    await page.goto("/", { waitUntil: "load" });
    await page.getByRole("button", { name: "Menu" }).click();

    await expect(page.getByRole("navigation", { name: "Menu links" }).getByRole("link", { name: "My account" })).toBeVisible({ timeout: 60_000 });
  });
});
