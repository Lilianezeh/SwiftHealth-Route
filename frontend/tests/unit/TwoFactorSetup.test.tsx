// @vitest-environment jsdom
/** The "Security" screen: switch on the authenticator app, see the backup codes once, switch it off. Requirements: FR-58, NFR-06,
 * NFR-10. Spec: specs/2026-10-23-accounts-and-facility-ownership/ (Phase 2c; the owner's answers D17 to D19).
 *
 * The QR code is made in the browser by the `qrcode` package, loaded only on this screen (D17); it is mocked here. The secret and the
 * backup codes are shown once and are never kept in a storage.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AdminSecurityPage from "@/app/(dashboards)/admin/security/page";
import { readStaffSession, saveStaffSession } from "@/lib/staff/session";
import type { StaffRole, StaffUser } from "@/types/staff";

import { json } from "../helpers/api";
import { readSource } from "../helpers/source";

const replace = vi.fn();
const router = { replace, push: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const toDataURL = vi.fn(async (_text: string, _options?: object) => "data:image/png;base64,QRPICTURE");
vi.mock("qrcode", () => ({ default: { toDataURL: (text: string, options?: object) => toDataURL(text, options) } }));

const SECRET = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";
const URI = `otpauth://totp/SwiftHealth%20Route:ada%40example.com?secret=${SECRET}&issuer=SwiftHealth%20Route`;
const CODES = ["ABCDE23456", "FGHJK23457", "LMNPQ23458", "RSTUV23459", "WXYZA23467", "BCDEF23468", "GHJKL23469", "MNPQR23478", "STUVW23479", "XYZAB23489"];

function person(role: StaffRole = "editor", enabled = false): StaffUser {
  return { id: 3, name: "Ada Staff", email: "ada@example.com", phone: "+2340000000001", role, is_active: true, two_factor_enabled: enabled };
}

type Call = { method: string; path: string; body: unknown; authorization: string | undefined };

function stubApi(options: { status?: object; answer?: (call: Call) => Response | null } = {}) {
  const calls: Call[] = [];
  let status = { enabled: false, backup_codes_left: 0, available: true, ...options.status };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (address: string, init?: RequestInit) => {
      const url = new URL(address);
      const call: Call = {
        method: init?.method ?? "GET",
        path: url.pathname,
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
        authorization: (init?.headers as Record<string, string> | undefined)?.Authorization,
      };
      calls.push(call);
      const custom = options.answer?.(call);
      if (custom) return custom;
      if (call.path === "/account/two-factor" && call.method === "GET") return json(status);
      if (call.path === "/account/two-factor/start") return json({ secret: SECRET, otpauth_uri: URI });
      if (call.path === "/account/two-factor/confirm") {
        status = { ...status, enabled: true, backup_codes_left: 10 };
        return json({ backup_codes: CODES });
      }
      if (call.path === "/account/two-factor/disable") {
        status = { ...status, enabled: false, backup_codes_left: 0 };
        return json({ enabled: false });
      }
      if (call.path === "/account/two-factor/backup-codes") return json({ backup_codes: CODES.map((code) => `N${code.slice(1)}`) });
      return json({ detail: "Not found" }, 404);
    }),
  );
  return calls;
}

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
  toDataURL.mockClear();
  replace.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function openScreen(role: StaffRole = "editor", enabled = false) {
  saveStaffSession({ token: "tok", user: person(role, enabled) });
  render(<AdminSecurityPage />);
  await screen.findByRole("heading", { level: 1, name: "Security" });
}

async function startSetUp() {
  await userEvent.click(await screen.findByRole("button", { name: "Set up the authenticator app" }));
  await userEvent.type(screen.getByLabelText("Your password"), "my-password");
  await userEvent.click(screen.getByRole("button", { name: "Show the QR code" }));
  await screen.findByAltText("QR code to scan with your authenticator app");
}

describe("the Security screen", () => {
  it.each(["verifier", "editor", "admin", "provider"] as const)("opens for a %s, like no other staff screen", async (role) => {
    stubApi();

    await openScreen(role);

    expect(screen.getByText("The authenticator app is off.")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("explains in plain words that it is free and replaces the SMS code", async () => {
    stubApi();
    await openScreen();

    expect(screen.getByText(/free/i)).toBeInTheDocument();
    expect(screen.getByText(/no SMS/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Set up the authenticator app" })).toBeEnabled();
  });

  it("says when the server cannot do it yet and offers no set-up", async () => {
    stubApi({ status: { available: false } });
    await openScreen();

    expect(await screen.findByText("The authenticator app is not available yet.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Set up the authenticator app" })).toBeNull();
  });

  it("shows when it is on and how many backup codes are left", async () => {
    stubApi({ status: { enabled: true, backup_codes_left: 7 } });
    await openScreen("editor", true);

    expect(await screen.findByText("The authenticator app is on.")).toBeInTheDocument();
    expect(screen.getByText("Backup codes left: 7")).toBeInTheDocument();
  });
});

describe("switching it on", () => {
  it("asks for the password again, sends it with the token, then shows the QR code and the key to type", async () => {
    const calls = stubApi();
    await openScreen();

    await startSetUp();

    const start = calls.find((call) => call.path === "/account/two-factor/start");
    expect(start).toEqual({ method: "POST", path: "/account/two-factor/start", body: { password: "my-password" }, authorization: "Bearer tok" });
    expect(toDataURL).toHaveBeenCalledWith(URI, expect.objectContaining({ margin: 2 }));
    expect(screen.getByAltText("QR code to scan with your authenticator app")).toHaveAttribute("src", "data:image/png;base64,QRPICTURE");
    expect(screen.getByText("Can't scan? Type this key into the app:")).toBeInTheDocument();
    expect(screen.getByText("JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP")).toBeInTheDocument(); // groups of 4 are easier to copy
    expect(screen.queryByText(URI)).toBeNull(); // the long address is only in the QR code
  });

  it("does not ask the server before a password is typed", async () => {
    const calls = stubApi();
    await openScreen();
    await userEvent.click(await screen.findByRole("button", { name: "Set up the authenticator app" }));

    await userEvent.click(screen.getByRole("button", { name: "Show the QR code" }));

    expect(calls.filter((call) => call.path === "/account/two-factor/start")).toHaveLength(0);
    expect(screen.getByText("Type your password.")).toBeInTheDocument();
  });

  it("sends the first code, and only then shows ten backup codes, once, to copy or print", async () => {
    const calls = stubApi();
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    await openScreen();
    await startSetUp();

    expect(screen.queryByText("ABCDE23456")).toBeNull();
    await userEvent.type(screen.getByLabelText("6-digit code from the app"), "482 913");
    await userEvent.click(screen.getByRole("button", { name: "Switch it on" }));

    expect(await screen.findByRole("heading", { name: "Your backup codes" })).toBeInTheDocument();
    expect(calls.find((call) => call.path === "/account/two-factor/confirm")?.body).toEqual({ code: "482913" });
    const list = screen.getByRole("list", { name: "Backup codes" });
    expect(within(list).getAllByRole("listitem").map((item) => item.textContent)).toEqual(CODES);
    expect(screen.getByText(/shown only this once/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Copy the codes" }));
    expect(writeText).toHaveBeenCalledWith(CODES.join("\n"));
    await userEvent.click(screen.getByRole("button", { name: "Print the codes" }));
    expect(print).toHaveBeenCalled();
  });

  it("closes the codes with I have saved them: the secret and the codes are gone from the page and the session says it is on", async () => {
    stubApi();
    await openScreen();
    await startSetUp();
    await userEvent.type(screen.getByLabelText("6-digit code from the app"), "482913");
    await userEvent.click(screen.getByRole("button", { name: "Switch it on" }));
    await screen.findByRole("heading", { name: "Your backup codes" });

    await userEvent.click(screen.getByRole("button", { name: "I have saved them" }));

    expect(await screen.findByText("The authenticator app is on.")).toBeInTheDocument();
    expect(screen.queryByText("ABCDE23456")).toBeNull();
    expect(screen.queryByText(/JBSW/)).toBeNull();
    expect(readStaffSession()?.user.two_factor_enabled).toBe(true);
  });

  it("keeps neither the key, nor a backup code, nor a password in any storage", async () => {
    stubApi();
    await openScreen();
    await startSetUp();
    await userEvent.type(screen.getByLabelText("6-digit code from the app"), "482913");
    await userEvent.click(screen.getByRole("button", { name: "Switch it on" }));
    await screen.findByRole("heading", { name: "Your backup codes" });

    const stored = JSON.stringify({ ...window.sessionStorage }) + JSON.stringify({ ...window.localStorage });
    for (const secret of [SECRET, "my-password", ...CODES, "482913"]) expect(stored).not.toContain(secret);
  });

  it.each([
    [403, "The password is not right."],
    [409, "The authenticator app is already switched on."],
    [429, "Too many attempts. Try again in a few minutes."],
    [503, "The authenticator app is not available yet."],
  ])("on %i when starting says: %s", async (status, message) => {
    stubApi({ answer: (call) => (call.path === "/account/two-factor/start" ? json({ detail: message }, status) : null) });
    await openScreen();
    await userEvent.click(await screen.findByRole("button", { name: "Set up the authenticator app" }));
    await userEvent.type(screen.getByLabelText("Your password"), "my-password");

    await userEvent.click(screen.getByRole("button", { name: "Show the QR code" }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.queryByAltText("QR code to scan with your authenticator app")).toBeNull();
  });

  it.each([
    [400, "That code is not right. Check that your phone's time is set automatically."],
    [429, "Too many wrong codes. Try again in 52 minutes."],
  ])("on %i when confirming says: %s, and the backup codes stay hidden", async (status, message) => {
    stubApi({ answer: (call) => (call.path === "/account/two-factor/confirm" ? json({ detail: message }, status) : null) });
    await openScreen();
    await startSetUp();
    await userEvent.type(screen.getByLabelText("6-digit code from the app"), "000000");

    await userEvent.click(screen.getByRole("button", { name: "Switch it on" }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Your backup codes" })).toBeNull();
    expect(screen.getByAltText("QR code to scan with your authenticator app")).toBeInTheDocument();
  });

  it("does not send a first code that is not 6 digits", async () => {
    const calls = stubApi();
    await openScreen();
    await startSetUp();

    await userEvent.type(screen.getByLabelText("6-digit code from the app"), "123");
    await userEvent.click(screen.getByRole("button", { name: "Switch it on" }));

    expect(calls.filter((call) => call.path === "/account/two-factor/confirm")).toHaveLength(0);
    expect(screen.getByText("Enter the 6 digits of the code.")).toBeInTheDocument();
  });
});

describe("when it is on", () => {
  async function openOn() {
    const calls = stubApi({ status: { enabled: true, backup_codes_left: 8 } });
    await openScreen("editor", true);
    await screen.findByText("The authenticator app is on.");
    return calls;
  }

  it("makes new backup codes with the password and a code, and shows them once", async () => {
    const calls = await openOn();

    await userEvent.click(screen.getByRole("button", { name: "Get new backup codes" }));
    await userEvent.type(screen.getByLabelText("Your password"), "my-password");
    await userEvent.type(screen.getByLabelText("A code from your app, or a backup code"), "ABCDE-23456");
    await userEvent.click(screen.getByRole("button", { name: "Make new codes" }));

    expect(await screen.findByRole("heading", { name: "Your backup codes" })).toBeInTheDocument();
    expect(calls.find((call) => call.path === "/account/two-factor/backup-codes")?.body).toEqual({ password: "my-password", code: "ABCDE23456" });
    expect(screen.getByText("The old codes no longer work.")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(10);
  });

  it("switches it off with the password and a code, then says it is off and updates the session", async () => {
    const calls = await openOn();

    await userEvent.click(screen.getByRole("button", { name: "Switch it off" }));
    await userEvent.type(screen.getByLabelText("Your password"), "my-password");
    await userEvent.type(screen.getByLabelText("A code from your app, or a backup code"), "482 913");
    await userEvent.click(screen.getByRole("button", { name: "Yes, switch it off" }));

    expect(await screen.findByText("The authenticator app is off.")).toBeInTheDocument();
    expect(calls.find((call) => call.path === "/account/two-factor/disable")?.body).toEqual({ password: "my-password", code: "482913" });
    expect(readStaffSession()?.user.two_factor_enabled).toBe(false);
  });

  it.each([
    [403, "The password is not right."],
    [400, "That code is not right. Check that your phone's time is set automatically."],
  ])("on %i when switching off says: %s, and it stays on", async (status, message) => {
    stubApi({
      status: { enabled: true, backup_codes_left: 8 },
      answer: (call) => (call.path === "/account/two-factor/disable" ? json({ detail: message }, status) : null),
    });
    await openScreen("editor", true);
    await screen.findByText("The authenticator app is on.");
    await userEvent.click(screen.getByRole("button", { name: "Switch it off" }));
    await userEvent.type(screen.getByLabelText("Your password"), "my-password");
    await userEvent.type(screen.getByLabelText("A code from your app, or a backup code"), "000000");

    await userEvent.click(screen.getByRole("button", { name: "Yes, switch it off" }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.getByText("The authenticator app is on.")).toBeInTheDocument();
  });
});

describe("how it is built", () => {
  it("has fields and buttons of at least 48 px, a label on every field, and nothing red", async () => {
    stubApi();
    await openScreen();
    await userEvent.click(await screen.findByRole("button", { name: "Set up the authenticator app" }));

    for (const field of [screen.getByLabelText("Your password")]) expect(field.className).toMatch(/\bmin-h-12\b/);
    for (const button of screen.getAllByRole("button")) expect(button.className).toMatch(/\bmin-h-(?:12|\[5\dpx\])/);
    expect(readSource("components/admin/TwoFactorSetup.tsx")).not.toMatch(/\b(?:text|bg|border)-(?:red|emergency)/);
  });

  it("loads the QR package only when the screen needs it, and writes nothing to the console or localStorage", () => {
    const source = readSource("components/admin/TwoFactorSetup.tsx");

    expect(source).toMatch(/await import\("qrcode"\)/);
    expect(source).not.toMatch(/^import .* from "qrcode"/m);
    expect(source).not.toMatch(/console\.|localStorage/);
  });

  it("waits for the token of the session and sends the call through the gate (a 401 logs out)", async () => {
    const calls = stubApi();
    await openScreen();

    await waitFor(() => expect(calls.some((call) => call.path === "/account/two-factor")).toBe(true));
    expect(calls[0].authorization).toBe("Bearer tok");
  });
});
