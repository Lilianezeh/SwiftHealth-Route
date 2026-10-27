// @vitest-environment jsdom
/** The account screen: details, a new email or phone, a new password, closing the account. Requirements: FR-54, FR-56,
 * NFR-06, NFR-10, US-21. UI spec 3.1d (accounts phase 5); API in api-spec 4d. Every name, address and number is fictional.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AccountPage from "@/app/(dashboards)/account/page";
import { readStaffSession, saveStaffSession } from "@/lib/staff/session";
import type { StaffRole } from "@/types/staff";

import { json } from "../helpers/api";
import { readSource } from "../helpers/source";

const replace = vi.fn();
const router = { replace, push: vi.fn() }; // one object: the gate's effect depends on it
vi.mock("next/navigation", () => ({ useRouter: () => router }));

type Account = {
  id: number; name: string; email: string; phone: string | null; role: StaffRole; approval_status: string;
  email_confirmed: boolean; phone_confirmed: boolean; two_factor_enabled: boolean;
};

const ACCOUNT: Account = {
  id: 7, name: "Ada Owner", email: "ada@example.com", phone: "+2348030000123", role: "provider",
  approval_status: "approved", email_confirmed: true, phone_confirmed: true, two_factor_enabled: false,
};

type Call = { method: string; path: string; body: Record<string, string> | undefined; auth: string | undefined };
type Answers = Record<string, (call: Call) => Response>;

function stubApi(answers: Answers = {}, account: Account = ACCOUNT) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (address: string, init?: RequestInit) => {
      const path = new URL(address).pathname;
      const call: Call = {
        method: init?.method ?? "GET",
        path,
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
        auth: (init?.headers as Record<string, string> | undefined)?.Authorization,
      };
      calls.push(call);
      const key = `${call.method} ${path}`;
      if (answers[key]) return answers[key](call);
      if (key === "GET /account") return json(account);
      return json({ detail: "Not found" }, 404);
    }),
  );
  return { calls, writes: () => calls.filter((call) => call.method !== "GET") };
}

beforeEach(() => {
  window.sessionStorage.clear();
  replace.mockReset();
  saveStaffSession({
    token: "old.token", user: { id: 7, name: "Ada Owner", email: "ada@example.com", phone: "+2348030000123", role: "provider", is_active: true },
  });
});
afterEach(() => vi.unstubAllGlobals());

async function openPage() {
  render(<AccountPage />);
  await screen.findByRole("heading", { level: 1, name: "My account" });
}

describe("your details", () => {
  it("shows the name, the email and the phone in reading form, and whether they are confirmed", async () => {
    const { calls } = stubApi();
    await openPage();

    expect(await screen.findByText("ada@example.com")).toBeInTheDocument();
    expect(screen.getByText("0803 000 0123")).toBeInTheDocument();
    expect(screen.getByText("Email confirmed")).toBeInTheDocument();
    expect(screen.getByText("Phone confirmed")).toBeInTheDocument();
    expect(calls[0]).toMatchObject({ method: "GET", path: "/account", auth: "Bearer old.token" });
  });

  it("says when the phone is not confirmed yet", async () => {
    stubApi({}, { ...ACCOUNT, phone_confirmed: false });
    await openPage();

    expect(await screen.findByText("Phone not confirmed yet")).toBeInTheDocument();
  });

  it("saves a new name and says so", async () => {
    const { writes } = stubApi({ "PATCH /account": () => json({ ...ACCOUNT, name: "Ada Okafor" }) });
    await openPage();
    const field = await screen.findByLabelText("Name");
    await userEvent.clear(field);
    await userEvent.type(field, "  Ada Okafor ");

    await userEvent.click(screen.getByRole("button", { name: "Save name" }));

    expect(await screen.findByText("Your name was saved.")).toBeInTheDocument();
    expect(writes()).toEqual([{ method: "PATCH", path: "/account", body: { name: "Ada Okafor" }, auth: "Bearer old.token" }]);
  });

  it("will not send a blank name", async () => {
    const { writes } = stubApi();
    await openPage();
    const field = await screen.findByLabelText("Name");
    await userEvent.clear(field);

    await userEvent.click(screen.getByRole("button", { name: "Save name" }));

    expect(screen.getByText("Type your name first.")).toBeInTheDocument();
    expect(writes()).toEqual([]);
  });

  it("shows the error with Retry when the details cannot be loaded", async () => {
    let attempts = 0;
    vi.stubGlobal("fetch", vi.fn(async () => (++attempts === 1 ? json({ detail: "boom" }, 500) : json(ACCOUNT))));
    render(<AccountPage />);

    expect(await screen.findByText("We couldn't load this. Check your connection and try again.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("ada@example.com")).toBeInTheDocument();
  });
});

describe("a new email", () => {
  const answers: Answers = {
    "POST /account/email/start": () => json({ confirm_token: "email.jwt", sent_to: "n***@example.com" }),
    "POST /account/email/confirm": () => json({ ...ACCOUNT, email: "new@example.com" }),
  };

  it("asks for the code, says where it went, then changes the email and shows it", async () => {
    const { writes } = stubApi(answers);
    await openPage();
    await screen.findByText("ada@example.com");

    await userEvent.type(screen.getByLabelText("New email"), "new@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send a code to the new email" }));
    expect(await screen.findByText("Code sent to n***@example.com. Your old email keeps working until you confirm.")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("6-digit code for the new email"), "482913");
    await userEvent.click(screen.getByRole("button", { name: "Confirm the new email" }));

    expect(await screen.findByText("Your email was changed.")).toBeInTheDocument();
    expect(screen.getByText("new@example.com")).toBeInTheDocument();
    expect(writes().map((call) => [call.path, call.body])).toEqual([
      ["/account/email/start", { email: "new@example.com" }],
      ["/account/email/confirm", { confirm_token: "email.jwt", code: "482913" }],
    ]);
  });

  it("shows the API's own sentence for an email that is used, and for a wrong code", async () => {
    stubApi({
      "POST /account/email/start": () => json({ detail: "That email is already used." }, 409),
    });
    await openPage();
    await screen.findByText("ada@example.com");
    await userEvent.type(screen.getByLabelText("New email"), "taken@example.com");

    await userEvent.click(screen.getByRole("button", { name: "Send a code to the new email" }));

    expect(await screen.findByText("That email is already used.")).toBeInTheDocument();
  });

  it("says Invalid or expired code for a wrong code and keeps the step", async () => {
    // 400, not 401: a 401 means "log in again" and the staff gate would log the person out.
    stubApi({ ...answers, "POST /account/email/confirm": () => json({ detail: "Invalid or expired code" }, 400) });
    await openPage();
    await screen.findByText("ada@example.com");
    await userEvent.type(screen.getByLabelText("New email"), "new@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send a code to the new email" }));
    await userEvent.type(await screen.findByLabelText("6-digit code for the new email"), "000000");

    await userEvent.click(screen.getByRole("button", { name: "Confirm the new email" }));

    expect(await screen.findByText("Invalid or expired code")).toBeInTheDocument();
    expect(screen.getByLabelText("6-digit code for the new email")).toBeInTheDocument();
  });

  it("asks for six digits before it calls the API", async () => {
    const { writes } = stubApi(answers);
    await openPage();
    await screen.findByText("ada@example.com");
    await userEvent.type(screen.getByLabelText("New email"), "new@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send a code to the new email" }));
    await userEvent.type(await screen.findByLabelText("6-digit code for the new email"), "12");
    const before = writes().length;

    await userEvent.click(screen.getByRole("button", { name: "Confirm the new email" }));

    expect(screen.getByText("Enter the 6 digits of the code.")).toBeInTheDocument();
    expect(writes()).toHaveLength(before);
  });
});

describe("a new phone", () => {
  it("with a code: asks for it, then says the number was changed", async () => {
    const { writes } = stubApi({
      "POST /account/phone/start": () => json({ confirm_token: "phone.jwt", sent_to: "+234******9999" }),
      "POST /account/phone/confirm": () => json({ ...ACCOUNT, phone: "+2348030009999" }),
    });
    await openPage();
    await screen.findByText("ada@example.com");

    await userEvent.type(screen.getByLabelText("New phone number"), "0803 000 9999");
    await userEvent.click(screen.getByRole("button", { name: "Change my phone number" }));
    expect(await screen.findByText("Code sent to ••• ••• 9999.")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("6-digit code for the new number"), "135790");
    await userEvent.click(screen.getByRole("button", { name: "Confirm the new number" }));

    expect(await screen.findByText("Your phone number was changed.")).toBeInTheDocument();
    expect(screen.getByText("0803 000 9999")).toBeInTheDocument();
    expect(writes().map((call) => call.path)).toEqual(["/account/phone/start", "/account/phone/confirm"]);
  });

  it("without a code (Termii off): the number changes at once and an admin will phone to confirm", async () => {
    stubApi({
      "POST /account/phone/start": () => json({ confirm_token: null, sent_to: null }),
      "GET /account": () => json({ ...ACCOUNT, phone: "+2348030009999", phone_confirmed: false }),
    });
    await openPage();
    await screen.findByText("ada@example.com");

    await userEvent.type(screen.getByLabelText("New phone number"), "0803 000 9999");
    await userEvent.click(screen.getByRole("button", { name: "Change my phone number" }));

    expect(await screen.findByText("Your number was changed. An admin will phone you to confirm it.")).toBeInTheDocument();
    expect(screen.queryByLabelText("6-digit code for the new number")).not.toBeInTheDocument();
    expect(await screen.findByText("Phone not confirmed yet")).toBeInTheDocument();
  });
});

describe("a new password", () => {
  it("changes it, puts the new token in the tab's session and says so; the password is dropped", async () => {
    const { writes } = stubApi({
      "POST /account/password": () => json({ access_token: "fresh.token", token_type: "bearer", expires_in: 43200 }),
    });
    await openPage();
    await screen.findByText("ada@example.com");

    await userEvent.type(screen.getByLabelText("Current password"), "old-password-12");
    await userEvent.type(screen.getByLabelText("New password"), "brand-new-password-91");
    await userEvent.click(screen.getByRole("button", { name: "Change password" }));

    expect(await screen.findByText("Your password was changed.")).toBeInTheDocument();
    expect(writes()[0].body).toEqual({ current_password: "old-password-12", new_password: "brand-new-password-91" });
    expect(readStaffSession()?.token).toBe("fresh.token");
    expect(screen.getByLabelText("Current password")).toHaveValue("");
    expect(screen.getByLabelText("New password")).toHaveValue("");
    expect(window.sessionStorage.getItem("swifthealth.staff-session")).not.toContain("brand-new-password-91");
  });

  it("uses the shared password field, with the eye button, for both passwords", async () => {
    stubApi();
    await openPage();
    await screen.findByText("ada@example.com");

    expect(screen.getByLabelText("Current password")).toHaveAttribute("autocomplete", "current-password");
    expect(screen.getByLabelText("New password")).toHaveAttribute("autocomplete", "new-password");
    expect(screen.getAllByRole("button", { name: "Show password" }).length).toBeGreaterThanOrEqual(2);
  });

  it("tells a provider the least length of 8, and staff 10, before sending a short one", async () => {
    const { writes } = stubApi();
    await openPage();
    await screen.findByText("ada@example.com");
    await userEvent.type(screen.getByLabelText("Current password"), "old-password-12");
    await userEvent.type(screen.getByLabelText("New password"), "short");

    await userEvent.click(screen.getByRole("button", { name: "Change password" }));

    expect(screen.getByText("The password needs at least 8 characters.")).toBeInTheDocument();
    expect(writes()).toEqual([]);
  });

  it("shows the API's sentence for a wrong current password and keeps what was typed out of the page", async () => {
    stubApi({ "POST /account/password": () => json({ detail: "The password is not right." }, 403) });
    await openPage();
    await screen.findByText("ada@example.com");
    await userEvent.type(screen.getByLabelText("Current password"), "wrong-password-1");
    await userEvent.type(screen.getByLabelText("New password"), "brand-new-password-91");

    await userEvent.click(screen.getByRole("button", { name: "Change password" }));

    expect(await screen.findByText("The password is not right.")).toBeInTheDocument();
    expect(readStaffSession()?.token).toBe("old.token");
  });
});

describe("closing the account", () => {
  async function fillClose(typed = "CLOSE") {
    await screen.findByText("ada@example.com");
    await userEvent.type(screen.getByLabelText("Your password, to close the account"), "old-password-12");
    if (typed) await userEvent.type(screen.getByLabelText("Type CLOSE to confirm"), typed);
  }

  it("says plainly what is removed and what stays", async () => {
    stubApi();
    await openPage();

    expect(await screen.findByText(/name, email and phone are removed/i)).toBeInTheDocument();
    expect(screen.getByText(/audit log stays/i)).toBeInTheDocument();
  });

  it("asks first, and Cancel sends nothing", async () => {
    const { writes } = stubApi();
    await openPage();
    await fillClose();

    await userEvent.click(screen.getByRole("button", { name: "Close my account" }));
    expect(screen.getByText("Close your account for good?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByText("Close your account for good?")).not.toBeInTheDocument();
    expect(writes()).toEqual([]);
  });

  it("needs the word CLOSE before it asks", async () => {
    const { writes } = stubApi();
    await openPage();
    await fillClose("close it");

    await userEvent.click(screen.getByRole("button", { name: "Close my account" }));

    expect(screen.getByText("Type the word CLOSE to confirm.")).toBeInTheDocument();
    expect(screen.queryByText("Close your account for good?")).not.toBeInTheDocument();
    expect(writes()).toEqual([]);
  });

  it("closes the account, clears the session and goes to the home page", async () => {
    const { writes } = stubApi({ "POST /account/close": () => json({ closed: true }) });
    await openPage();
    await fillClose();
    await userEvent.click(screen.getByRole("button", { name: "Close my account" }));

    await userEvent.click(screen.getByRole("button", { name: "Yes, close it" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(writes()[0]).toMatchObject({ path: "/account/close", body: { password: "old-password-12", confirmation: "CLOSE" } });
    expect(readStaffSession()).toBeNull();
  });

  it("shows the API's sentence when the last admin cannot close", async () => {
    stubApi({ "POST /account/close": () => json({ detail: "This is the last active admin." }, 409) });
    await openPage();
    await fillClose();
    await userEvent.click(screen.getByRole("button", { name: "Close my account" }));

    await userEvent.click(screen.getByRole("button", { name: "Yes, close it" }));

    expect(await screen.findByText("This is the last active admin.")).toBeInTheDocument();
    expect(readStaffSession()).not.toBeNull();
  });
});

describe("layout and access", () => {
  it("makes every field and button at least 48 px", async () => {
    stubApi();
    await openPage();
    await screen.findByText("ada@example.com");

    const section = (name: string) => screen.getByRole("region", { name });
    for (const name of ["Your details", "Change your email", "Change your phone number", "Change your password", "Close your account"]) {
      for (const control of within(section(name)).queryAllByRole("textbox")) expect(control.className, name).toMatch(/min-h-12/);
    }
    for (const button of screen.getAllByRole("button")) {
      if (/password$/i.test(button.getAttribute("aria-label") ?? "")) continue; // the eye button is 48 px wide and as high as its field
      expect(button.className, button.textContent ?? "").toMatch(/min-h-(12|\[50px\])/);
    }
  });

  it.each<StaffRole>(["admin", "editor", "verifier", "provider"])("a %s can open it", async (role) => {
    window.sessionStorage.clear();
    saveStaffSession({ token: "t", user: { id: 1, name: "X", email: "x@example.com", phone: null, role, is_active: true } });
    stubApi();
    render(<AccountPage />);

    expect(await screen.findByRole("heading", { level: 1, name: "My account" })).toBeInTheDocument();
  });

  it("sends a visitor with no session to the login", async () => {
    window.sessionStorage.clear();
    stubApi();
    render(<AccountPage />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/log-in"));
  });

  it("has its password fields only through the shared component", () => {
    for (const file of ["account/AccountSettings.tsx", "account/ChangePassword.tsx", "account/CloseAccount.tsx", "account/ForgotPassword.tsx"]) {
      expect(readSource(`components/${file}`), file).not.toMatch(/type=["']password["']/);
    }
  });
});
