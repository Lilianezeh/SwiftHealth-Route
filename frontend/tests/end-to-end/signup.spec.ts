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
            featured_price_naira: "5000.00", // For facilities shows the price
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

    test("the header has no Log in and no Sign up (owner, 2026-11-02), in the bar or in the Menu; SwiftRescue stays red and outside the Menu", async ({ page }) => {
      await fakeApi(page, signUpIs(true));
      await page.goto("/find", { waitUntil: "load" });
      const bar = page.getByRole("banner");
      const rescue = bar.getByRole("link", { name: "SwiftRescue" });
      await expect(rescue).toBeVisible({ timeout: 60_000 });

      await expect(bar.getByRole("link", { name: /log in|sign up|my account/i })).toHaveCount(0);
      if (width < FROM_TABLET) {
        await page.getByRole("button", { name: "Menu" }).click();
        const menu = page.getByRole("navigation", { name: "Menu links" });
        await expect(menu.getByRole("link")).toHaveText(["Find care", "For facilities"]);
        await expect(menu.getByRole("link", { name: "SwiftRescue" })).toHaveCount(0);
      }
      await expect(rescue).toHaveCSS("background-color", /^rgb\((2[0-9][0-9]|1[5-9][0-9]), ?\d+, ?\d+\)$/); // the red, and only SwiftRescue
      await allIsInsideTheScreen(page, width);
    });

    test("the header: a session shows My account, in the bar from tablet width and in the Menu on a phone", async ({ page }) => {
      await fakeApi(page, signUpIs(true));
      await page.goto("/find", { waitUntil: "load" });
      const bar = page.getByRole("banner");
      await expect(bar.getByRole("link", { name: "SwiftRescue" })).toBeVisible({ timeout: 60_000 });

      await page.evaluate(() => {
        const user = { id: 3, name: "Ada Staff", email: "ada@example.com", phone: "+2340000000001", role: "provider", is_active: true };
        window.sessionStorage.setItem("swifthealth.staff-session", JSON.stringify({ token: "fake.token.value", user }));
        window.dispatchEvent(new Event("swifthealth:staff-session-changed"));
      });

      if (width >= FROM_TABLET) {
        await expect(bar.getByRole("link", { name: "My account" })).toHaveAttribute("href", "/provider");
      } else {
        await page.getByRole("button", { name: "Menu" }).click();
        await expect(page.getByRole("navigation", { name: "Menu links" }).getByRole("link", { name: "My account" })).toBeVisible();
      }
    });

    test("For facilities has Sign up as a facility owner and Log in once, near the top (owner, 2026-11-03), and Sign up opens with Facility owner chosen", async ({ page }) => {
      await fakeApi(page, signUpIs(true));
      await page.goto("/for-facilities", { waitUntil: "load" });

      const signUps = page.getByRole("link", { name: "Sign up as a facility owner" });
      await expect(signUps).toHaveCount(1, { timeout: 60_000 });
      await expect(page.getByRole("link", { name: "Log in", exact: true })).toHaveCount(1);
      expect((await signUps.boundingBox())?.y ?? 99_999).toBeLessThan(page.viewportSize()!.height * 1.5); // near the top of the page
      await allIsInsideTheScreen(page, width);
      await targetsAndTextAreBigEnough(page);
      await signUps.first().click();

      await expect(page).toHaveURL(/\/sign-up\?as=owner$/);
      await expect(page.getByText("Signing up as: Facility owner")).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText("What do you want to sign up as?")).toHaveCount(0);
    });

    test("For facilities shows no sign-up button while sign-up is closed, and keeps Log in", async ({ page }) => {
      await fakeApi(page, signUpIs(false));
      await page.goto("/for-facilities", { waitUntil: "load" });

      await expect(page.getByText("Sign-up is not open yet.")).toHaveCount(1, { timeout: 60_000 });
      await expect(page.getByRole("link", { name: "Sign up as a facility owner" })).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Log in", exact: true })).toHaveCount(1);
      await allIsInsideTheScreen(page, width);
    });

    test("the footer's Staff portal link leads to Log in and Sign up as staff, and Sign up opens with Staff chosen and the admin note", async ({ page }) => {
      await fakeApi(page, signUpIs(true));
      await page.goto("/find", { waitUntil: "load" });

      await page.getByRole("navigation", { name: "Footer" }).getByRole("link", { name: "Staff portal" }).click();
      await expect(page).toHaveURL(/\/staff-portal$/);
      await expect(page.getByRole("heading", { level: 1, name: "Staff portal" })).toBeVisible({ timeout: 60_000 });
      await expect(page.getByRole("link", { name: "Log in", exact: true })).toHaveAttribute("href", "/log-in");
      await allIsInsideTheScreen(page, width);
      await targetsAndTextAreBigEnough(page);
      await page.getByRole("link", { name: "Sign up as staff" }).click();

      await expect(page).toHaveURL(/\/sign-up\?as=staff$/);
      await expect(page.getByText("Signing up as: Staff")).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText("An admin must approve your staff sign-up before you can use it.")).toBeVisible();
    });

    test("/log-in keeps its address and still opens the login form", async ({ page }) => {
      await fakeApi(page, signUpIs(true));
      await page.goto("/log-in", { waitUntil: "load" });

      await expect(page.getByRole("heading", { level: 1, name: "Log in" })).toBeVisible({ timeout: 60_000 });
      await expect(page).toHaveURL(/\/log-in$/);
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
