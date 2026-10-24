// @vitest-environment jsdom
/** The staff login screen. Requirements: FR-30 (password, then a one-time code), FR-42, NFR-06, NFR-07, NFR-10.
 * UI spec 3.1 and "Phase 10 details"; decision C2 in specs/2026-10-20-staff-screens/requirements.md.
 */
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LoginForm } from "@/components/admin/LoginForm";
import { formatPhoneHint } from "@/lib/formatters/phone";
import { readStaffSession } from "@/lib/staff/session";
import type { StaffRole } from "@/types/staff";

import { json } from "../helpers/api";
import { readSource } from "../helpers/source";

const replace = vi.fn();
const router = { replace, push: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

type Handler = (body: Record<string, string>) => Response;

function tooManyRequests(detail: string, retryAfter: number): Response {
  return new Response(JSON.stringify({ detail }), {
    status: 429,
    headers: { "Content-Type": "application/json", "Retry-After": String(retryAfter) },
  });
}

/** What the API answers when a code was sent by SMS (the usual case), and when the app is asked for (FR-58). */
function sentBySms(challengeToken: string) {
  return { challenge_token: challengeToken, sent_to: "+234******0001", method: "sms", can_use_sms: false };
}
function askForApp(canUseSms = false) {
  return { challenge_token: "app.jwt", sent_to: null, method: "totp", can_use_sms: canUseSms };
}

function stubAuth(options: { login?: Handler; verify?: Handler; resend?: Handler; useSms?: Handler } = {}) {
  const calls: { path: string; body: Record<string, string> }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (address: string, init: RequestInit) => {
      const path = new URL(address).pathname;
      const body = JSON.parse(String(init.body)) as Record<string, string>;
      calls.push({ path, body });
      if (path === "/auth/login") return (options.login ?? (() => json(sentBySms("challenge.jwt"))))(body);
      if (path === "/auth/resend-code") return (options.resend ?? (() => json(sentBySms("challenge2.jwt"))))(body);
      if (path === "/auth/use-sms") return (options.useSms ?? (() => json(sentBySms("sms.jwt"))))(body);
      if (path === "/auth/verify-code") {
        return (options.verify ?? (() => tokenFor("editor")))(body);
      }
      return json({ detail: "Not found" }, 404);
    }),
  );
  return calls;
}

function tokenFor(role: StaffRole): Response {
  return json({
    access_token: "access.jwt", token_type: "bearer", expires_in: 43200,
    user: { id: 3, name: "Ada Staff", email: "ada@example.com", phone: "+2340000000001", role, is_active: true },
  });
}

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
  replace.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function logInTo(stepTwo = true) {
  await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
  await userEvent.type(screen.getByLabelText("Password"), "a-long-password");
  await userEvent.click(screen.getByRole("button", { name: "Send me a code" }));
  if (stepTwo) await screen.findByLabelText("6-digit code");
}

describe("the phone as the code screen hints at it (FR-57)", () => {
  it("shows only the last four digits, the rest hidden", () => {
    expect(formatPhoneHint("+234******4567")).toBe("••• ••• 4567");
    expect(formatPhoneHint("+234******0001")).toBe("••• ••• 0001");
  });
  it("returns anything that does not end in four digits as it was given", () => {
    expect(formatPhoneHint("hello")).toBe("hello");
    expect(formatPhoneHint("")).toBe("");
  });
});

describe("step 1: email and password", () => {
  it("has labelled fields with the right autocomplete, at least 48 px high, and one button", () => {
    stubAuth();
    render(<LoginForm />);

    const email = screen.getByLabelText("Email");
    const password = screen.getByLabelText("Password");
    expect(email).toHaveAttribute("type", "email");
    expect(email).toHaveAttribute("autocomplete", "username");
    expect(password).toHaveAttribute("type", "password");
    expect(password).toHaveAttribute("autocomplete", "current-password");
    for (const field of [email, password]) expect(field.className).toMatch(/\bmin-h-12\b/);
    expect(screen.getByRole("heading", { level: 1, name: "Staff login" })).toBeInTheDocument();
  });

  it("posts the email and password, then asks for the code and says where it was sent", async () => {
    const calls = stubAuth();
    render(<LoginForm />);

    await logInTo();

    expect(calls[0]).toEqual({ path: "/auth/login", body: { email: "ada@example.com", password: "a-long-password" } });
    expect(screen.getByText("Code sent to ••• ••• 0001")).toBeInTheDocument();
    expect(screen.queryByLabelText("Password")).toBeNull();
  });

  it.each([
    [401, "Invalid email or password"],
    [403, "This account is deactivated."],
    [400, "This account has no phone number, so no code can be sent."],
    [429, "Too many attempts. Try again in a few minutes."],
    [502, "Could not send the code. Try again."],
    [500, "We couldn't log you in. Check your connection and try again."],
  ])("on %i says: %s", async (status, message) => {
    stubAuth({ login: () => json({ detail: "x" }, status) });
    render(<LoginForm />);

    await logInTo(false);

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("says the same for an unknown email and a wrong password: it shows the API's one answer, not which was wrong", async () => {
    stubAuth({ login: () => json({ detail: "Invalid email or password" }, 401) });
    render(<LoginForm />);

    await logInTo(false);

    expect(await screen.findByText("Invalid email or password")).toBeInTheDocument();
  });
});

describe("step 2: the code", () => {
  it("has a 6-digit one-time-code field and a button, and no password field", async () => {
    stubAuth();
    render(<LoginForm />);
    await logInTo();

    const code = screen.getByLabelText("6-digit code");
    expect(code).toHaveAttribute("autocomplete", "one-time-code");
    expect(code).toHaveAttribute("inputmode", "numeric");
    expect(code).toHaveAttribute("maxlength", "6");
    expect(code.className).toMatch(/\bmin-h-12\b/);
    expect(screen.getByRole("button", { name: "Log in" })).toBeInTheDocument();
  });

  it("posts the challenge and the code, saves the session in sessionStorage only, and goes to where the role starts", async () => {
    const calls = stubAuth({ verify: () => tokenFor("editor") });
    render(<LoginForm />);
    await logInTo();

    await userEvent.type(screen.getByLabelText("6-digit code"), "482913");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin"));
    expect(calls[1]).toEqual({ path: "/auth/verify-code", body: { challenge_token: "challenge.jwt", code: "482913" } });
    expect(readStaffSession()?.token).toBe("access.jwt");
    expect(readStaffSession()?.user.role).toBe("editor");
    expect(window.localStorage.length).toBe(0);
  });

  it.each([
    ["verifier", "/admin/listings?mine=true"],
    ["editor", "/admin"],
    ["admin", "/admin"],
    ["provider", "/provider"],
  ] as const)("sends a %s to %s", async (role, address) => {
    stubAuth({ verify: () => tokenFor(role) });
    render(<LoginForm />);
    await logInTo();

    await userEvent.type(screen.getByLabelText("6-digit code"), "482913");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith(address));
  });

  it("keeps only digits in the code field and stops at 6", async () => {
    stubAuth();
    render(<LoginForm />);
    await logInTo();

    await userEvent.type(screen.getByLabelText("6-digit code"), "48a2 9-13999");

    expect(screen.getByLabelText("6-digit code")).toHaveValue("482913");
  });

  it("does not send a code that is not 6 digits", async () => {
    const calls = stubAuth();
    render(<LoginForm />);
    await logInTo();

    await userEvent.type(screen.getByLabelText("6-digit code"), "123");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(calls.filter((call) => call.path === "/auth/verify-code")).toHaveLength(0);
    expect(screen.getByText("Enter the 6 digits of the code.")).toBeInTheDocument();
  });

  it.each([
    [401, "Invalid or expired code"],
    [403, "This account is deactivated."],
    [429, "Too many attempts. Try again in a few minutes."],
  ])("on %i says: %s, saves no session and stays on the code step", async (status, message) => {
    stubAuth({ verify: () => json({ detail: "x" }, status) });
    render(<LoginForm />);
    await logInTo();

    await userEvent.type(screen.getByLabelText("6-digit code"), "000000");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(readStaffSession()).toBeNull();
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByLabelText("6-digit code")).toBeInTheDocument();
  });
});

/** Moves the fake clock one second at a time: the countdown sets its next one-second timer only after React has drawn. */
async function wait(seconds: number) {
  for (let second = 0; second < seconds; second += 1) {
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
  }
}

describe("asking for a new code (FR-57)", () => {
  const SEND_NEW_CODE = { name: "Send a new code" };

  it("is disabled for 60 seconds, with the seconds counting down in words, then it can be pressed", async () => {
    stubAuth();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<LoginForm />);
    await logInTo();

    // The fake clock also moves with real time (the typing above took a moment), so read where the count is.
    const secondsShown = () => Number(/in (\d+) seconds?\./.exec(screen.getByText(/You can ask for a new code in/).textContent ?? "")?.[1]);
    const start = secondsShown();
    expect(screen.getByRole("button", SEND_NEW_CODE)).toBeDisabled();
    expect(start).toBeGreaterThanOrEqual(57);
    expect(start).toBeLessThanOrEqual(60);
    await wait(30);
    expect(Math.abs(secondsShown() - (start - 30))).toBeLessThanOrEqual(1);
    await wait(secondsShown() - 1);
    expect(screen.getByText("You can ask for a new code in 1 second.")).toBeInTheDocument();
    expect(screen.getByRole("button", SEND_NEW_CODE)).toBeDisabled();
    await wait(1);

    expect(screen.getByRole("button", SEND_NEW_CODE)).toBeEnabled();
    expect(screen.queryByText(/You can ask for a new code in/)).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("You can send a new code now.");
  });

  it("asks for the new code with the current token, never with the password, and uses the new token", async () => {
    const calls = stubAuth({ verify: () => tokenFor("editor") });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<LoginForm />);
    await logInTo();
    await wait(60);

    await userEvent.click(screen.getByRole("button", SEND_NEW_CODE));

    expect(await screen.findByText("A new code was sent.")).toBeInTheDocument();
    expect(calls.filter((call) => call.path === "/auth/login")).toHaveLength(1); // the login ran once only
    expect(calls[1]).toEqual({ path: "/auth/resend-code", body: { challenge_token: "challenge.jwt" } });
    expect(JSON.stringify(calls.slice(1))).not.toContain("a-long-password");
    expect(screen.getByRole("button", SEND_NEW_CODE)).toBeDisabled(); // the 60 seconds start again
    expect(screen.getByText("You can ask for a new code in 60 seconds.")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("6-digit code"), "482913");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    await waitFor(() => expect(replace).toHaveBeenCalled());
    expect(calls.at(-1)).toEqual({ path: "/auth/verify-code", body: { challenge_token: "challenge2.jwt", code: "482913" } });
  });

  it("clears the code the person had typed when a new one is sent", async () => {
    stubAuth();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<LoginForm />);
    await logInTo();
    await userEvent.type(screen.getByLabelText("6-digit code"), "123");
    await wait(60);

    await userEvent.click(screen.getByRole("button", SEND_NEW_CODE));
    await screen.findByText("A new code was sent.");

    expect(screen.getByLabelText("6-digit code")).toHaveValue("");
  });

  it("when the server says to wait a few more seconds, shows its sentence and counts those seconds", async () => {
    stubAuth({ resend: () => tooManyRequests("Wait 20 seconds before asking for a new code.", 20) });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<LoginForm />);
    await logInTo();
    await wait(60);

    await userEvent.click(screen.getByRole("button", SEND_NEW_CODE));

    expect(await screen.findByText("Wait 20 seconds before asking for a new code.")).toBeInTheDocument();
    expect(screen.getByRole("button", SEND_NEW_CODE)).toBeDisabled();
    expect(screen.getByText("You can ask for a new code in 20 seconds.")).toBeInTheDocument();
    await wait(20);
    expect(screen.getByRole("button", SEND_NEW_CODE)).toBeEnabled();
  });

  it("at the hourly limit shows the server's sentence and keeps the button off", async () => {
    stubAuth({ resend: () => tooManyRequests("Too many codes. Try again in 52 minutes.", 3120) });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<LoginForm />);
    await logInTo();
    await wait(60);

    await userEvent.click(screen.getByRole("button", SEND_NEW_CODE));

    expect(await screen.findByText("Too many codes. Try again in 52 minutes.")).toBeInTheDocument();
    expect(screen.getByRole("button", SEND_NEW_CODE)).toBeDisabled();
    expect(screen.queryByText(/You can ask for a new code in/)).toBeNull();
    await wait(300);
    expect(screen.getByRole("button", SEND_NEW_CODE)).toBeDisabled(); // it does not come back by itself
    expect(screen.getByRole("button", { name: "Start again" })).toBeEnabled(); // the way out
  });

  it.each([
    [401, "The code has expired. Choose Start again to get a new one."],
    [403, "This account is deactivated."],
    [502, "Could not send the code. Try again."],
    [500, "We couldn't send a new code. Check your connection and try again."],
  ])("on %i says: %s", async (status, message) => {
    stubAuth({ resend: () => json({ detail: "x" }, status) });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<LoginForm />);
    await logInTo();
    await wait(60);

    await userEvent.click(screen.getByRole("button", SEND_NEW_CODE));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.getByLabelText("6-digit code")).toBeInTheDocument();
  });
});

describe("starting again", () => {
  it("is offered on the code step and goes back to email and password, with the email kept and nothing else", async () => {
    const calls = stubAuth();
    render(<LoginForm />);
    await logInTo();
    await userEvent.type(screen.getByLabelText("6-digit code"), "123");

    await userEvent.click(screen.getByRole("button", { name: "Start again" }));

    expect(screen.getByLabelText("Email")).toHaveValue("ada@example.com");
    expect(screen.getByLabelText("Password")).toHaveValue("");
    expect(screen.queryByLabelText("6-digit code")).toBeNull();
    expect(screen.queryByText(/Code sent to/)).toBeNull();
    expect(screen.getByRole("button", { name: "Send me a code" })).toBeInTheDocument();
    expect(calls).toHaveLength(1); // going back sends nothing
  });

  it("then logs in again from the start, with a fresh code step", async () => {
    const calls = stubAuth();
    render(<LoginForm />);
    await logInTo();
    await userEvent.click(screen.getByRole("button", { name: "Start again" }));

    await userEvent.type(screen.getByLabelText("Password"), "a-long-password");
    await userEvent.click(screen.getByRole("button", { name: "Send me a code" }));

    expect(await screen.findByLabelText("6-digit code")).toBeInTheDocument();
    expect(calls.filter((call) => call.path === "/auth/login")).toHaveLength(2);
  });

  it("stops the countdown: nothing is asked of the server by the old screen", async () => {
    const calls = stubAuth();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<LoginForm />);
    await logInTo();

    await userEvent.click(screen.getByRole("button", { name: "Start again" }));
    await wait(120);

    expect(calls).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Send a new code" })).toBeNull();
  });

  it("is a button with a 48 px tap area and plain colours (nothing red)", async () => {
    stubAuth();
    render(<LoginForm />);
    await logInTo();

    const again = screen.getByRole("button", { name: "Start again" });
    const sendNew = screen.getByRole("button", { name: "Send a new code" });

    for (const button of [again, sendNew]) expect(button.className).toMatch(/\bmin-h-(?:12|\[5\dpx\])/);
    expect(readSource("components/admin/LoginForm.tsx")).not.toMatch(/\b(?:text|bg|border)-(?:red|emergency)/);
  });
});

describe("the authenticator app at login (FR-58)", () => {
  const APP_CODE = "Code from your app";

  it("asks for the code from the app, says nothing was sent, and offers neither a new code nor SMS", async () => {
    stubAuth({ login: () => json(askForApp()) });
    render(<LoginForm />);

    await logInTo(false);

    expect(await screen.findByLabelText(APP_CODE)).toBeInTheDocument();
    expect(screen.getByText("Open your authenticator app and type the 6-digit code. Nothing is sent to your phone.")).toBeInTheDocument();
    expect(screen.queryByText(/Code sent to/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Send a new code" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Use SMS instead" })).toBeNull();
    expect(screen.getByRole("button", { name: "Start again" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use a backup code" })).toBeInTheDocument();
  });

  it("keeps only digits (an app shows 482 913 with a space), at most 6, and posts the code with the app token", async () => {
    const calls = stubAuth({ login: () => json(askForApp()), verify: () => tokenFor("admin") });
    render(<LoginForm />);
    await logInTo(false);

    const field = await screen.findByLabelText(APP_CODE);
    expect(field).toHaveAttribute("autocomplete", "one-time-code");
    expect(field).toHaveAttribute("inputmode", "numeric");
    await userEvent.type(field, "48a2 9-13999");
    expect(field).toHaveValue("482913");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin"));
    expect(calls.at(-1)).toEqual({ path: "/auth/verify-code", body: { challenge_token: "app.jwt", code: "482913" } });
  });

  it("does not send an app code that is not 6 digits", async () => {
    const calls = stubAuth({ login: () => json(askForApp()) });
    render(<LoginForm />);
    await logInTo(false);

    await userEvent.type(await screen.findByLabelText(APP_CODE), "123");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(calls.filter((call) => call.path === "/auth/verify-code")).toHaveLength(0);
    expect(screen.getByText("Enter the 6 digits of the code.")).toBeInTheDocument();
  });

  it("switches to a backup code and back; the backup code is letters and digits, any case, dashes and spaces ignored, 10 at most", async () => {
    const calls = stubAuth({ login: () => json(askForApp()), verify: () => tokenFor("editor") });
    render(<LoginForm />);
    await logInTo(false);

    await userEvent.click(await screen.findByRole("button", { name: "Use a backup code" }));
    const backup = screen.getByLabelText("Backup code");
    expect(backup).toHaveAttribute("maxlength", "10");
    expect(backup).not.toHaveAttribute("inputmode", "numeric");
    await userEvent.type(backup, "abcde-fgh 23456789");
    expect(backup).toHaveValue("ABCDEFGH23");
    await userEvent.click(screen.getByRole("button", { name: "Use the app code instead" }));
    expect(screen.getByLabelText(APP_CODE)).toHaveValue("");
    await userEvent.click(screen.getByRole("button", { name: "Use a backup code" }));
    await userEvent.type(screen.getByLabelText("Backup code"), "ABCDE23456");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() => expect(replace).toHaveBeenCalled());
    expect(calls.at(-1)).toEqual({ path: "/auth/verify-code", body: { challenge_token: "app.jwt", code: "ABCDE23456" } });
  });

  it("does not send a backup code that is not 10 characters", async () => {
    const calls = stubAuth({ login: () => json(askForApp()) });
    render(<LoginForm />);
    await logInTo(false);
    await userEvent.click(await screen.findByRole("button", { name: "Use a backup code" }));

    await userEvent.type(screen.getByLabelText("Backup code"), "ABC23");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(calls.filter((call) => call.path === "/auth/verify-code")).toHaveLength(0);
    expect(screen.getByText("A backup code has 10 letters and digits.")).toBeInTheDocument();
  });

  it("offers SMS instead only when the server says it is possible, and then goes to the SMS step with its own token", async () => {
    const calls = stubAuth({ login: () => json(askForApp(true)), verify: () => tokenFor("editor") });
    render(<LoginForm />);
    await logInTo(false);

    await userEvent.click(await screen.findByRole("button", { name: "Use SMS instead" }));

    expect(await screen.findByText("Code sent to ••• ••• 0001")).toBeInTheDocument();
    expect(calls.at(-1)).toEqual({ path: "/auth/use-sms", body: { challenge_token: "app.jwt" } });
    expect(screen.getByRole("button", { name: "Send a new code" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Use SMS instead" })).toBeNull();
    await userEvent.type(screen.getByLabelText("6-digit code"), "482913");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    await waitFor(() => expect(replace).toHaveBeenCalled());
    expect(calls.at(-1)).toEqual({ path: "/auth/verify-code", body: { challenge_token: "sms.jwt", code: "482913" } });
  });

  it.each([
    [409, "SMS codes are not available."],
    [401, "The code has expired. Choose Start again to get a new one."],
    [429, "Too many codes. Try again in 52 minutes."],
    [502, "Could not send the code. Try again."],
  ])("on %i from Use SMS instead says: %s", async (status, message) => {
    stubAuth({ login: () => json(askForApp(true)), useSms: () => json({ detail: message }, status) });
    render(<LoginForm />);
    await logInTo(false);

    await userEvent.click(await screen.findByRole("button", { name: "Use SMS instead" }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.getByLabelText(APP_CODE)).toBeInTheDocument(); // still on the app step
  });

  it.each([
    [401, "Invalid or expired code"],
    [429, "Too many wrong codes. Try again in 52 minutes."],
    [503, "Codes from the app cannot be checked right now. Use a backup code."],
  ])("on %i from the app step says: %s", async (status, message) => {
    stubAuth({ login: () => json(askForApp()), verify: () => json({ detail: message }, status) });
    render(<LoginForm />);
    await logInTo(false);

    await userEvent.type(await screen.findByLabelText(APP_CODE), "000000");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(readStaffSession()).toBeNull();
  });

  it("Start again from the app step goes back to the email and drops the app token", async () => {
    stubAuth({ login: () => json(askForApp()) });
    render(<LoginForm />);
    await logInTo(false);
    await screen.findByLabelText(APP_CODE);

    await userEvent.click(screen.getByRole("button", { name: "Start again" }));

    expect(screen.getByLabelText("Email")).toHaveValue("ada@example.com");
    expect(screen.queryByLabelText(APP_CODE)).toBeNull();
  });
});

describe("a login code sent by email (no SMS yet, D19)", () => {
  const sentByEmail = { challenge_token: "mail.jwt", sent_to: "e***@demo.example.com", method: "email", can_use_sms: false };

  it("says the code went to the email, with the same 6-digit field, new-code button and Start again", async () => {
    const calls = stubAuth({ login: () => json(sentByEmail), verify: () => tokenFor("editor") });
    render(<LoginForm />);

    await logInTo();

    expect(screen.getByText("Code sent to e***@demo.example.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send a new code" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Start again" })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("6-digit code"), "482913");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    await waitFor(() => expect(replace).toHaveBeenCalled());
    expect(calls.at(-1)).toEqual({ path: "/auth/verify-code", body: { challenge_token: "mail.jwt", code: "482913" } });
  });
});

describe("what is never kept", () => {
  it("puts neither the password nor the code in any storage, and the token in no address", async () => {
    stubAuth();
    render(<LoginForm />);
    await logInTo();
    await userEvent.type(screen.getByLabelText("6-digit code"), "482913");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    await waitFor(() => expect(replace).toHaveBeenCalled());

    const stored = JSON.stringify({ ...window.sessionStorage }) + JSON.stringify({ ...window.localStorage });
    expect(stored).not.toContain("a-long-password");
    expect(stored).not.toContain("482913");
    expect(replace.mock.calls.every((call) => !String(call[0]).includes("access.jwt"))).toBe(true);
  });

  it("writes nothing to the console and does not use localStorage", () => {
    const source = readSource("components/admin/LoginForm.tsx");
    expect(source).not.toMatch(/console\.|localStorage/);
  });
});
