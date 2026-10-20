// @vitest-environment jsdom
/** The staff login screen. Requirements: FR-30 (password, then a one-time code), FR-42, NFR-06, NFR-07, NFR-10.
 * UI spec 3.1 and "Phase 10 details"; decision C2 in specs/2026-10-20-staff-screens/requirements.md.
 */
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LoginForm } from "@/components/admin/LoginForm";
import { formatMaskedPhone } from "@/lib/formatters/phone";
import { readStaffSession } from "@/lib/staff/session";
import type { StaffRole } from "@/types/staff";

import { json } from "../helpers/api";
import { readSource } from "../helpers/source";

const replace = vi.fn();
const router = { replace, push: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

type Handler = (body: Record<string, string>) => Response;

function stubAuth(options: { login?: Handler; verify?: Handler } = {}) {
  const calls: { path: string; body: Record<string, string> }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (address: string, init: RequestInit) => {
      const path = new URL(address).pathname;
      const body = JSON.parse(String(init.body)) as Record<string, string>;
      calls.push({ path, body });
      if (path === "/auth/login") return (options.login ?? (() => json({ challenge_token: "challenge.jwt", sent_to: "+234******0001" })))(body);
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

describe("the masked number as it is shown", () => {
  it("keeps the mask in the reading shape", () => {
    expect(formatMaskedPhone("+234******0001")).toBe("0*** *** 0001");
  });
  it("returns anything else as it was given", () => {
    expect(formatMaskedPhone("hello")).toBe("hello");
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
    expect(screen.getByText("Sent to 0*** *** 0001")).toBeInTheDocument();
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

describe("resending the code", () => {
  it("is offered only after 60 seconds, and repeats step 1 with the password kept in memory", async () => {
    const calls = stubAuth();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<LoginForm />);
    await logInTo();
    expect(screen.queryByRole("button", { name: "Resend code" })).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(59_000);
    });
    expect(screen.queryByRole("button", { name: "Resend code" })).toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(1_000);
    });
    await userEvent.click(await screen.findByRole("button", { name: "Resend code" }));

    expect(calls.filter((call) => call.path === "/auth/login")).toHaveLength(2);
    expect(calls[1].body).toEqual({ email: "ada@example.com", password: "a-long-password" });
    expect(await screen.findByText("A new code was sent.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resend code" })).toBeNull(); // the 60 seconds start again
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
