/** The admin screens for approving staff, the account list and the activity log in a real browser, at 360 and 1280 px.
 * Requirements: FR-49, FR-55, US-18, NFR-10. Spec: specs/2026-10-23-accounts-and-facility-ownership/ (Phase 4b), UI spec 3.8 and 3.8b.
 * The API is faked with `page.route` (tests/helpers/browserApi.ts): no account is changed and nothing is written to the database.
 * The unit tests cover the rules; this one measures the real layout and the real flow in a browser. Every name here is fictional.
 */
import { expect, test } from "@playwright/test";

import { allIsInsideTheScreen, fakeApi, logInAs, targetsAndTextAreBigEnough, type FakeAnswer, type FakeRequest } from "../helpers/browserApi";

const WIDTHS = [
  { width: 360, height: 740 },
  { width: 1280, height: 800 },
];

function account(id: number, role: string, overrides: Record<string, unknown> = {}) {
  return {
    id, name: `Person ${id}`, email: `person${id}@example.com`, phone: "+2348030000001", role, is_active: true,
    two_factor_enabled: false, approval_status: "approved", last_login_at: "2026-10-12T14:05:00Z",
    created_at: "2026-10-01T09:00:00Z", email_verified_at: "2026-10-01T09:05:00Z", phone_verified_at: "2026-10-01T09:06:00Z",
    signup_note: null, ...overrides,
  };
}

const WAITING = account(10, "verifier", {
  name: "Bola Staff", email: "bola.staff@example.com", phone: "+2348030000456", approval_status: "pending", last_login_at: null,
  signup_note: "Verifier at the clinic in Ogui; Dr Eze can vouch for me.", created_at: "2026-10-20T10:30:00Z",
});
const NO_PHONE = account(11, "verifier", {
  name: "Chidi Waiting", email: "chidi@example.com", approval_status: "pending", last_login_at: null, phone_verified_at: null,
});

/** A fake API for these screens: the lists, the decisions, and the activity log. `seen` records the calls. */
function api(state: { waiting: unknown[] }) {
  return (request: FakeRequest): FakeAnswer => {
    const query = new URLSearchParams(request.search);
    if (request.method === "GET" && request.path === "/admin/users") {
      if (query.get("approval_status") === "pending") return { body: { items: state.waiting, total: state.waiting.length } };
      const items = [account(1, "admin"), account(2, "editor"), account(3, "verifier", { is_active: false }), ...state.waiting];
      return { body: { items, total: items.length } };
    }
    if (request.method === "POST" && /^\/admin\/users\/10\/approve$/.test(request.path)) {
      state.waiting = state.waiting.filter((user) => (user as { id: number }).id !== 10);
      return { body: { ...WAITING, approval_status: "approved", role: (request.body as { role: string }).role } };
    }
    if (request.method === "POST" && request.path === "/admin/users/11/confirm-phone-by-call") {
      state.waiting = state.waiting.map((user) => ((user as { id: number }).id === 11 ? { ...NO_PHONE, phone_verified_at: "2026-10-26T10:00:00Z" } : user));
      return { body: { phone_confirmed: true } };
    }
    if (request.method === "GET" && request.path === "/admin/activity") {
      return {
        body: {
          items: [
            { id: 2, at: "2026-10-26T09:00:00Z", user_id: 1, user_name: "Person 1", action: "user_approve", listing_id: null, listing_name: null, target_user_id: 10, target_user_name: "Bola Staff", field_changed: "approval_status", old_value: "pending", new_value: "approved" },
            { id: 1, at: "2026-10-25T09:00:00Z", user_id: 1, user_name: "Person 1", action: "update", listing_id: 5, listing_name: "Night Pharmacy A", target_user_id: null, target_user_name: null, field_changed: "phone", old_value: null, new_value: "changed" },
          ],
          total: 2,
        },
      };
    }
    return null;
  };
}

for (const { width, height } of WIDTHS) {
  test.describe(`admin accounts at ${width} px`, () => {
    test.use({ viewport: { width, height } });

    test("Waiting for approval: the cards fit, the phone call is recorded, and an approval takes the card out", async ({ page }) => {
      const state = { waiting: [WAITING, NO_PHONE] as unknown[] };
      const seen = await fakeApi(page, api(state));
      await logInAs(page, "admin", 1);
      await page.goto("/admin/staff", { waitUntil: "load" });

      await expect(page.getByRole("heading", { level: 1, name: "Staff and providers" })).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText("2 people are waiting for approval.")).toBeVisible();
      await page.getByRole("tab", { name: "Waiting for approval (2)" }).click();
      await expect(page.getByText("Bola Staff", { exact: true })).toBeVisible();
      await allIsInsideTheScreen(page, width);
      await targetsAndTextAreBigEnough(page);

      await expect(page.getByRole("button", { name: "Approve Chidi Waiting" })).toBeDisabled();
      await page.getByRole("button", { name: /^Phone confirmed by call/ }).click();
      await page.getByRole("button", { name: "Yes, I phoned them" }).click();
      await expect(page.getByRole("button", { name: "Approve Chidi Waiting" })).toBeEnabled();

      await page.getByLabel("Role for Bola Staff").selectOption("editor");
      await page.getByRole("button", { name: "Approve Bola Staff" }).click();
      await expect(page.getByText("Approve Bola Staff as an editor?")).toBeVisible();
      await allIsInsideTheScreen(page, width);
      await targetsAndTextAreBigEnough(page);
      await page.getByRole("button", { name: "Yes, approve" }).click();

      await expect(page.getByText("Bola Staff was approved as an editor.")).toBeVisible();
      await expect(page.getByRole("tab", { name: "Waiting for approval (1)" })).toBeVisible();
      const approve = seen.find((request) => request.path === "/admin/users/10/approve");
      expect(approve?.body).toEqual({ role: "editor" });
      expect(approve?.authorization).toBe("Bearer fake.token.value");
      expect(approve?.search).toBe(""); // nothing in the address
    });

    test("All accounts: the state, the last login, the filters and Suspend fit the screen", async ({ page }) => {
      await fakeApi(page, api({ waiting: [WAITING] }));
      await logInAs(page, "admin", 1);
      await page.goto("/admin/staff", { waitUntil: "load" });

      await expect(page.getByText("Person 2")).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText("Admin · Active")).toBeVisible();
      await expect(page.getByText("Verifier · Suspended")).toBeVisible();
      await expect(page.getByText("Last login: 12 Oct 2026, 15:05").first()).toBeVisible();
      await expect(page.getByRole("button", { name: "Suspend Person 2" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Suspend Person 1" })).toHaveCount(0); // not your own
      await allIsInsideTheScreen(page, width);
      await targetsAndTextAreBigEnough(page);

      await page.getByRole("button", { name: "Suspend Person 2" }).click();
      await expect(page.getByLabel("Reason for suspending Person 2")).toBeVisible();
      await allIsInsideTheScreen(page, width);
      await targetsAndTextAreBigEnough(page);
    });

    test("Activity: the log, the filters and the staff bar link fit the screen", async ({ page }) => {
      await fakeApi(page, api({ waiting: [] }));
      await logInAs(page, "admin", 1);
      await page.goto("/admin/activity", { waitUntil: "load" });

      await expect(page.getByRole("heading", { level: 1, name: "Activity" })).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText("Person 1 approved an account")).toBeVisible();
      await expect(page.getByText("About: Bola Staff")).toBeVisible();
      await expect(page.getByText("approval_status: pending → approved")).toBeVisible();
      await expect(page.getByText("Listing: Night Pharmacy A")).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Staff" }).getByRole("link", { name: "Activity" })).toHaveAttribute("href", "/admin/activity");
      await allIsInsideTheScreen(page, width);
      await targetsAndTextAreBigEnough(page);
    });
  });
}
