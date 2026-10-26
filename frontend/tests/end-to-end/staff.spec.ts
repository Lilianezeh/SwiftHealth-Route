/** The staff screens in a real browser, at 320, 360, 768 and 1024 px. Requirements: FR-30 to FR-32, FR-41, FR-42, NFR-06, NFR-10.
 * Spec: specs/2026-10-20-staff-screens/ (plan Task 14). It needs the site (and the API for GET /meta) running (playwright.config.ts).
 * The staff calls are faked with `page.route` (tests/helpers/browserApi.ts): no staff password exists here and nothing is written to
 * the database. The unit tests cover the rules; this one measures the real layout and the real flow in a browser.
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

function summary(id: number, status: string) {
  return {
    id, slug: `place-${id}`, name: `Place ${id}`, category: { slug: "pharmacy", name: "Pharmacy" }, area: "Ogui", address: "1 Example Road",
    latitude: 6.45, longitude: 7.5, distance_km: null, is_open_now: true, is_24_hours: false, primary_phone: "+2340000000012",
    last_verified_at: null, verification_due: false, sponsored: false, hours_note: null, status, next_check_due: "2026-11-20T09:00:00Z", created_by: 3,
  };
}

function detail(status = "draft") {
  return {
    ...summary(12, status), landmark: "Opposite the market", description: "Demo data (fictional).", entrance_photo_url: null,
    phones: [
      { number: "+2340000000012", label: "Front desk", is_primary: true, is_whatsapp: false },
      { number: "+2340000000013", label: "Emergency", is_primary: false, is_whatsapp: true },
    ],
    opening_hours: WEEK,
    services: [{ name: "Consultation", fee_min_naira: "1500.00", fee_max_naira: "3000.00", fee_collected_at: "2026-09-28" }],
    recently_reported_not_working: false, disclaimer: "Directory only.", owner_id: null, featured_until: null,
    map_pin_is_default: true, submission_details: "Contact: Dr. Example, owner@example.com.",
    closed_at: null, closed_reason: null,
  };
}

const ADMIN_USERS = [1, 2, 3, 4].map((id) => ({ id, name: `Person ${id}`, email: `p${id}@example.com`, phone: "+2340000000001", role: ["admin", "editor", "verifier", "provider"][id - 1], is_active: id !== 3 }));

for (const { width, height } of WIDTHS) {
  test.describe(`staff screens at ${width} px`, () => {
    test.use({ viewport: { width, height } });

    test("login: both steps fit the screen, the fields are big, and the right role lands on its list", async ({ page }) => {
      const seen = await fakeApi(page, (request) => {
        if (request.path === "/auth/login") return { body: { challenge_token: "challenge.jwt", sent_to: "+234******0001" } };
        if (request.path === "/auth/verify-code") {
          return { body: { access_token: "access.jwt", token_type: "bearer", expires_in: 43200, user: { id: 3, name: "Ada Verifier", email: "a@b.co", phone: "+2340000000001", role: "verifier", is_active: true } } };
        }
        if (request.path === "/listings") return { body: { items: [], total: 0 } };
        return null;
      });
      await page.goto("/log-in", { waitUntil: "load" });
      await expect(page.getByRole("heading", { level: 1, name: "Log in" })).toBeVisible({ timeout: 60_000 });
      await allIsInsideTheScreen(page, width);
      await targetsAndTextAreBigEnough(page);

      await page.getByLabel("Email").fill("ada@example.com");
      await page.getByLabel("Password", { exact: true }).fill("a-long-password");
      await page.getByRole("button", { name: "Send me a code" }).click();
      await expect(page.getByText("Code sent to ••• ••• 0001")).toBeVisible();
      await expect(page.getByRole("button", { name: "Send a new code" })).toBeDisabled();
      await expect(page.getByRole("button", { name: "Start again" })).toBeVisible();
      await allIsInsideTheScreen(page, width);
      await targetsAndTextAreBigEnough(page);
      await page.getByLabel("6-digit code").fill("482913");
      await page.getByRole("button", { name: "Log in" }).click();

      await expect(page).toHaveURL(/\/admin\/listings\?mine=true$/, { timeout: 60_000 });
      await expect(page.getByRole("heading", { level: 1, name: "Listings" })).toBeVisible();
      const stored = await page.evaluate(() => ({ session: window.sessionStorage.getItem("swifthealth.staff-session"), local: window.localStorage.length }));
      expect(stored.session).toContain("access.jwt");
      expect(stored.local).toBe(0);
      expect(page.url()).not.toContain("access.jwt");
      expect(seen.find((request) => request.path === "/listings")?.authorization).toBe("Bearer access.jwt");
    });

    test("password eye: inside the field, 48 px or more, shows and hides, never sends the form, and the password is hidden after Send me a code", async ({ page }) => {
      const seen = await fakeApi(page, (request) => {
        if (request.path === "/auth/login") return { body: { challenge_token: "challenge.jwt", sent_to: "+234******0001", method: "sms", can_use_sms: false } };
        return null;
      });
      await page.goto("/log-in", { waitUntil: "load" });
      await expect(page.getByRole("heading", { level: 1, name: "Log in" })).toBeVisible({ timeout: 60_000 });
      const field = page.getByLabel("Password", { exact: true });
      const eye = page.getByRole("button", { name: "Show password" });
      await field.fill("a-long-password");

      const fieldBox = (await field.boundingBox())!;
      const eyeBox = (await eye.boundingBox())!;
      expect(eyeBox.width).toBeGreaterThanOrEqual(48);
      expect(eyeBox.height).toBeGreaterThanOrEqual(48);
      expect(eyeBox.x).toBeGreaterThanOrEqual(fieldBox.x); // inside the field, at its right edge
      expect(eyeBox.x + eyeBox.width).toBeLessThanOrEqual(fieldBox.x + fieldBox.width + 1);
      await allIsInsideTheScreen(page, width);
      const textPaddingRight = await field.evaluate((input) => parseFloat(getComputedStyle(input).paddingRight));
      expect(textPaddingRight).toBeGreaterThanOrEqual(48); // the typed text never runs under the button

      await eye.click();
      await expect(field).toHaveAttribute("type", "text");
      await expect(page.getByRole("button", { name: "Hide password" })).toHaveAttribute("aria-pressed", "true");
      expect(seen.filter((request) => request.path === "/auth/login")).toHaveLength(0); // the eye did not send the form
      await page.keyboard.press("Tab"); // the eye keeps its place in the tab order: the next stop is the send button
      await page.getByLabel("Email").fill("ada@example.com");
      await page.getByRole("button", { name: "Send me a code" }).click();
      await expect(page.getByLabel("6-digit code")).toBeVisible();
      await page.getByRole("button", { name: "Start again" }).click();
      await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "password");
    });

    test("login: a new code after 60 seconds (no password sent again), and Start again goes back to the email", async ({ page }) => {
      await page.clock.install();
      const seen = await fakeApi(page, (request) => {
        if (request.path === "/auth/login") return { body: { challenge_token: "challenge.jwt", sent_to: "+234******4567" } };
        if (request.path === "/auth/resend-code") return { body: { challenge_token: "challenge2.jwt", sent_to: "+234******4567" } };
        return null;
      });
      await page.goto("/log-in", { waitUntil: "load" });
      await expect(page.getByRole("heading", { level: 1, name: "Log in" })).toBeVisible({ timeout: 60_000 });
      await page.getByLabel("Email").fill("ada@example.com");
      await page.getByLabel("Password", { exact: true }).fill("a-long-password");
      await page.getByRole("button", { name: "Send me a code" }).click();

      await expect(page.getByText("Code sent to ••• ••• 4567")).toBeVisible();
      await expect(page.getByText("You can ask for a new code in 60 seconds.")).toBeVisible();
      await expect(page.getByRole("button", { name: "Send a new code" })).toBeDisabled();
      await allIsInsideTheScreen(page, width);
      await targetsAndTextAreBigEnough(page);
      await page.clock.runFor(30_000); // runFor fires every one-second timer of the countdown; fastForward fires each only once
      // The installed clock also runs in real time, so a slow machine adds the seconds it took to get here: the count is "about 30
      // or fewer", never more, and never zero yet (it was exactly 29 to 31 on a quick machine, and 23 on a very busy one).
      const hint = page.getByText(/You can ask for a new code in \d+ seconds?\./);
      await expect(hint).toBeVisible();
      const secondsLeft = Number(/in (\d+) second/.exec((await hint.textContent()) ?? "")?.[1]);
      expect(secondsLeft).toBeLessThanOrEqual(31);
      expect(secondsLeft).toBeGreaterThan(0);
      await page.clock.runFor(31_000);
      await expect(page.getByRole("button", { name: "Send a new code" })).toBeEnabled();
      await page.getByRole("button", { name: "Send a new code" }).click();

      await expect(page.getByText("A new code was sent.")).toBeVisible();
      expect(seen.filter((request) => request.path === "/auth/login")).toHaveLength(1); // the password went once
      expect(seen.find((request) => request.path === "/auth/resend-code")?.body).toEqual({ challenge_token: "challenge.jwt" });
      await page.getByRole("button", { name: "Start again" }).click();
      await expect(page.getByLabel("Email")).toHaveValue("ada@example.com");
      await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
      await expect(page.getByLabel("6-digit code")).toHaveCount(0);
      await allIsInsideTheScreen(page, width);
    });

    test("login with the authenticator app: nothing is sent, the code and the backup code fit the screen, and SMS is offered only when allowed", async ({ page }) => {
      const seen = await fakeApi(page, (request) => {
        if (request.path === "/auth/login") return { body: { challenge_token: "app.jwt", sent_to: null, method: "totp", can_use_sms: true } };
        if (request.path === "/auth/use-sms") return { body: { challenge_token: "sms.jwt", sent_to: "+234******4567", method: "sms", can_use_sms: false } };
        return null;
      });
      await page.goto("/log-in", { waitUntil: "load" });
      await expect(page.getByRole("heading", { level: 1, name: "Log in" })).toBeVisible({ timeout: 60_000 });
      await page.getByLabel("Email").fill("ada@example.com");
      await page.getByLabel("Password", { exact: true }).fill("a-long-password");
      await page.getByRole("button", { name: "Send me a code" }).click();

      await expect(page.getByLabel("Code from your app")).toBeVisible();
      await expect(page.getByText("Nothing is sent to your phone.")).toBeVisible();
      await expect(page.getByRole("button", { name: "Send a new code" })).toHaveCount(0);
      await allIsInsideTheScreen(page, width);
      await targetsAndTextAreBigEnough(page);
      await page.getByRole("button", { name: "Use a backup code" }).click();
      await expect(page.getByLabel("Backup code")).toBeVisible();
      await allIsInsideTheScreen(page, width);
      await page.getByRole("button", { name: "Use SMS instead" }).click();

      await expect(page.getByText("Code sent to ••• ••• 4567")).toBeVisible();
      await expect(page.getByRole("button", { name: "Send a new code" })).toBeDisabled();
      expect(seen.find((request) => request.path === "/auth/use-sms")?.body).toEqual({ challenge_token: "app.jwt" });
      await allIsInsideTheScreen(page, width);
    });

    test("security: set up the authenticator app with a real QR code, see the backup codes once, and switch it off", async ({ page }) => {
      await logInAs(page, "editor");
      const secret = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";
      const codes = ["ABCDE23456", "FGHJK23457", "LMNPQ23458", "RSTUV23459", "WXYZA23467", "BCDEF23468", "GHJKL23469", "MNPQR23478", "STUVW23479", "XYZAB23489"];
      let enabled = false;
      const seen = await fakeApi(page, (request) => {
        if (request.path === "/account/two-factor" && request.method === "GET") return { body: { enabled, backup_codes_left: enabled ? 10 : 0, available: true } };
        if (request.path === "/account/two-factor/start") return { body: { secret, otpauth_uri: `otpauth://totp/SwiftHealth%20Route:ada%40example.com?secret=${secret}&issuer=SwiftHealth%20Route` } };
        if (request.path === "/account/two-factor/confirm") {
          enabled = true;
          return { body: { backup_codes: codes } };
        }
        if (request.path === "/account/two-factor/disable") {
          enabled = false;
          return { body: { enabled: false } };
        }
        return null;
      });
      await page.goto("/admin/security", { waitUntil: "load" });
      await expect(page.getByRole("heading", { level: 1, name: "Security" })).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText("The authenticator app is off.")).toBeVisible();
      await allIsInsideTheScreen(page, width);
      await targetsAndTextAreBigEnough(page);

      await page.getByRole("button", { name: "Set up the authenticator app" }).click();
      await page.getByLabel("Your password").fill("my-password");
      await page.getByRole("button", { name: "Show the QR code" }).click();
      const picture = page.getByAltText("QR code to scan with your authenticator app");
      await expect(picture).toBeVisible({ timeout: 60_000 }); // the QR package is loaded now, and a cold dev server compiles it first
      expect(await picture.evaluate((image: HTMLImageElement) => image.naturalWidth > 100 && image.currentSrc.startsWith("data:image/"))).toBe(true);
      await expect(page.getByText("JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP")).toBeVisible();
      await allIsInsideTheScreen(page, width);
      await targetsAndTextAreBigEnough(page);

      await page.getByLabel("6-digit code from the app").fill("482913");
      await page.getByRole("button", { name: "Switch it on" }).click();
      await expect(page.getByRole("heading", { name: "Your backup codes" })).toBeVisible();
      await expect(page.getByRole("listitem")).toHaveCount(10);
      await allIsInsideTheScreen(page, width);
      expect(await page.evaluate(() => JSON.stringify({ ...window.sessionStorage }) + JSON.stringify({ ...window.localStorage }))).not.toContain("ABCDE23456");
      await page.getByRole("button", { name: "I have saved them" }).click();
      await expect(page.getByText("The authenticator app is on.")).toBeVisible();
      await expect(page.getByText("ABCDE23456")).toHaveCount(0);

      await page.getByRole("button", { name: "Switch it off" }).click();
      await page.getByLabel("Your password").fill("my-password");
      await page.getByLabel("A code from your app, or a backup code").fill("482913");
      await page.getByRole("button", { name: "Yes, switch it off" }).click();
      await expect(page.getByText("The authenticator app is off.")).toBeVisible();
      expect(seen.find((request) => request.path === "/account/two-factor/start")?.body).toEqual({ password: "my-password" });
      expect(seen.find((request) => request.path === "/account/two-factor/start")?.authorization).toBe("Bearer fake.token.value");
    });

    test("listings: the staff bar and the cards fit, and a filter reaches the API", async ({ page }) => {
      await logInAs(page, "admin");
      const seen = await fakeApi(page, (request) => {
        if (request.path === "/listings") return { body: { items: [summary(1, "draft"), summary(2, "published"), summary(3, "hidden")], total: 3 } };
        return null;
      });
      await page.goto("/admin/listings", { waitUntil: "load" });

      await expect(page.getByRole("heading", { level: 1, name: "Listings" })).toBeVisible({ timeout: 60_000 });
      await expect(page.getByRole("article")).toHaveCount(3);
      await expect(page.getByRole("link", { name: "Staff" })).toBeVisible(); // the admin sees the Staff link
      await allIsInsideTheScreen(page, width);
      await targetsAndTextAreBigEnough(page);

      await page.getByLabel("Status").selectOption("draft");
      await expect.poll(() => seen.filter((request) => request.path === "/listings").at(-1)?.search ?? "").toContain("status=draft");
    });

    test("editor: every section fits, the fields are big, the warning shows and Save sends only the change", async ({ page }) => {
      await logInAs(page, "editor");
      const seen = await fakeApi(page, (request: FakeRequest) => {
        if (request.path === "/listings/id/12") return { body: detail() };
        if (request.path === "/listings/12" && request.method === "PATCH") return { body: { ...detail(), ...(request.body as object) } };
        return null;
      });
      await page.goto("/admin/listings/12", { waitUntil: "load" });

      await expect(page.getByRole("heading", { level: 1, name: "Place 12" })).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText("The map pin is still the default. Set the real position before you submit.")).toBeVisible();
      await expect(page.getByRole("heading", { level: 2, name: "Submission details" })).toBeVisible();
      for (const heading of ["Basics", "Location", "Phones", "Opening hours", "Services and fees", "Description"]) {
        await expect(page.getByRole("heading", { level: 2, name: heading })).toBeVisible();
      }
      await allIsInsideTheScreen(page, width);
      await targetsAndTextAreBigEnough(page);

      await page.getByLabel("Landmark").fill("By the church");
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page.getByText("Saved.")).toBeVisible();
      const patch = seen.find((request) => request.method === "PATCH");
      expect(patch?.body).toEqual({ landmark: "By the church" });
      expect(patch?.authorization).toBe("Bearer fake.token.value");
      await allIsInsideTheScreen(page, width);
    });

    test("editor: Hide asks for a reason and the status button row fits", async ({ page }) => {
      await logInAs(page, "editor");
      await fakeApi(page, (request) => {
        if (request.path === "/listings/id/12") return { body: detail("published") };
        if (request.path === "/listings/12/hide") return { body: detail("hidden") };
        return null;
      });
      await page.goto("/admin/listings/12", { waitUntil: "load" });
      await expect(page.getByRole("heading", { level: 1, name: "Place 12" })).toBeVisible({ timeout: 60_000 });

      await page.getByRole("button", { name: "Hide", exact: true }).click();
      await expect(page.getByLabel("Why is it hidden?")).toBeVisible();
      await allIsInsideTheScreen(page, width);
      await page.getByLabel("Why is it hidden?").fill("Facility closed");
      await page.getByRole("button", { name: "Hide this listing" }).click();

      await expect(page.getByText("Now: Hidden.")).toBeVisible();
      await expect(page.getByRole("button", { name: "Reopen" })).toBeVisible();
    });

    test("verification log: the form and the history fit, the radios are big, a check is saved in two taps", async ({ page }) => {
      await logInAs(page, "verifier");
      const seen = await fakeApi(page, (request) => {
        if (request.path === "/listings/id/12") return { body: detail() };
        if (request.path === "/listings/12/checks" && request.method === "POST") {
          return { status: 201, body: { id: 5, ...(request.body as object), checked_at: "2026-10-06T10:00:00Z", staff_id: 3, staff_name: "Ada Staff" } };
        }
        if (request.path === "/listings/12/checks") {
          return { body: { total: 1, items: [{ id: 1, method: "call", result: "pass", person_reached: "Pharmacist", notes: "Hours confirmed", photo_url: null, checked_at: "2026-10-05T10:30:00Z", staff_id: 3, staff_name: "Ada Staff" }] } };
        }
        return null;
      });
      await page.goto("/admin/listings/12/checks", { waitUntil: "load" });

      await expect(page.getByRole("heading", { level: 1, name: "Verification log: Place 12" })).toBeVisible({ timeout: 60_000 });
      await expect(page.getByRole("listitem")).toHaveCount(1);
      await allIsInsideTheScreen(page, width);
      for (const label of ["Call", "Visit", "Pass", "Fail"]) {
        const row = page.locator("label", { hasText: new RegExp(`^${label}$`) });
        expect((await row.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(47.5);
      }

      await page.getByLabel("Call").check();
      await page.getByLabel("Pass").check();
      await page.getByRole("button", { name: "Save check" }).click();

      await expect(page.getByText("Check saved.")).toBeVisible();
      expect(seen.find((request) => request.method === "POST" && request.path === "/listings/12/checks")?.body).toEqual({
        method: "call", result: "pass", person_reached: null, notes: null, photo_url: null,
      });
      await allIsInsideTheScreen(page, width);
    });

    test("staff accounts: the list and the add form fit, and the admin cannot deactivate themselves", async ({ page }) => {
      await logInAs(page, "admin", 1);
      await fakeApi(page, (request) => (request.path === "/admin/users" ? { body: { items: ADMIN_USERS, total: 4 } } : null));
      await page.goto("/admin/staff", { waitUntil: "load" });

      await expect(page.getByRole("heading", { level: 1, name: "Staff and providers" })).toBeVisible({ timeout: 60_000 });
      await expect(page.getByRole("listitem")).toHaveCount(4);
      await allIsInsideTheScreen(page, width);
      await page.getByRole("button", { name: "Edit Person 1" }).click();
      await expect(page.getByLabel("Person 1 is active")).toBeDisabled();
      await page.getByRole("button", { name: "Add user" }).click();
      await expect(page.getByLabel("Password (at least 10 characters)")).toBeVisible();
      await allIsInsideTheScreen(page, width);
      await targetsAndTextAreBigEnough(page);
    });

    test("a role that may not open a page is told so, and a visitor with no session goes to the login", async ({ page }) => {
      await logInAs(page, "verifier");
      await fakeApi(page, () => null);
      await page.goto("/admin/staff", { waitUntil: "load" });
      await expect(page.getByText("Your role cannot open this page.")).toBeVisible({ timeout: 60_000 });
      await expect(page.getByRole("button", { name: "Add user" })).toHaveCount(0);

      const bare = await page.context().browser()?.newContext({ viewport: { width, height } });
      const visitor = await bare?.newPage();
      await visitor?.goto("http://localhost:3000/admin/listings", { waitUntil: "load" });
      await expect(visitor as NonNullable<typeof visitor>).toHaveURL(/\/log-in$/, { timeout: 60_000 });
      await bare?.close();
    });
  });
}
