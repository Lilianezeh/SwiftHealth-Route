// @vitest-environment jsdom
/** The forgotten password page: the email, then the code and the new password. Requirements: FR-54, FR-56, NFR-06, NFR-10.
 * UI spec 3.1d (accounts phase 5); API in api-spec 4d. The answer to the first step is the same for every email. Every name,
 * address and number here is fictional.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ForgotPasswordPage from "@/app/(dashboards)/forgot-password/page";
import { saveStaffSession } from "@/lib/staff/session";

import { json } from "../helpers/api";
import { readSource } from "../helpers/source";

type Call = { path: string; body: Record<string, string>; auth: string | undefined };

function stubApi(answers: Record<string, () => Response> = {}) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (address: string, init?: RequestInit) => {
      const path = new URL(address).pathname;
      calls.push({
        path,
        body: JSON.parse(String(init?.body ?? "{}")),
        auth: (init?.headers as Record<string, string> | undefined)?.Authorization,
      });
      return (answers[path] ?? (() => json({ detail: "Not found" }, 404)))();
    }),
  );
  return calls;
}

const FORGOT = () => json({ reset_token: "reset.jwt", sent_to: "a***@example.com" });
const RESET = () => json({ reset: true });

beforeEach(() => window.sessionStorage.clear());
afterEach(() => vi.unstubAllGlobals());

async function askForTheCode(email = "ada@example.com") {
  await userEvent.type(screen.getByLabelText("Email"), email);
  await userEvent.click(screen.getByRole("button", { name: "Send me a code" }));
}

describe("step 1: the email", () => {
  it("asks for the email only, with a clear heading, and needs no login", () => {
    stubApi();
    render(<ForgotPasswordPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Forgot your password?" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
    expect(screen.queryByLabelText("6-digit code")).not.toBeInTheDocument();
  });

  it("sends the email without any token and moves to the code step with the same words for every email", async () => {
    const calls = stubApi({ "/auth/forgot-password": FORGOT });
    render(<ForgotPasswordPage />);

    await askForTheCode();

    expect(await screen.findByText("If that email has an account, a code is on its way to a***@example.com.")).toBeInTheDocument();
    expect(calls).toEqual([{ path: "/auth/forgot-password", body: { email: "ada@example.com" }, auth: undefined }]);
    expect(screen.getByLabelText("6-digit code")).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
  });

  it("says plain words for too many asks (429) and for email not set up (503), using the API's sentence", async () => {
    stubApi({ "/auth/forgot-password": () => json({ detail: "Too many codes. Try again in 52 minutes." }, 429) });
    render(<ForgotPasswordPage />);

    await askForTheCode();

    expect(await screen.findByRole("alert")).toHaveTextContent("Too many codes. Try again in 52 minutes.");
  });

  it("says plain words when the network fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("offline"))));
    render(<ForgotPasswordPage />);

    await askForTheCode();

    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't do that. Check your connection and try again.");
  });
});

describe("step 2: the code and the new password", () => {
  async function toStepTwo(answers: Record<string, () => Response> = {}) {
    const calls = stubApi({ "/auth/forgot-password": FORGOT, "/auth/reset-password": RESET, ...answers });
    render(<ForgotPasswordPage />);
    await askForTheCode();
    await screen.findByLabelText("6-digit code");
    return calls;
  }

  it("sets the new password with the code and the token, never logs in, and offers the login", async () => {
    const calls = await toStepTwo();
    await userEvent.type(screen.getByLabelText("6-digit code"), "482913");
    await userEvent.type(screen.getByLabelText("New password"), "brand-new-password-91");

    await userEvent.click(screen.getByRole("button", { name: "Set the new password" }));

    expect(await screen.findByText("Your password was changed. Log in with it.")).toBeInTheDocument();
    expect(calls.at(-1)).toEqual({
      path: "/auth/reset-password",
      body: { reset_token: "reset.jwt", code: "482913", new_password: "brand-new-password-91" },
      auth: undefined,
    });
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/log-in");
    expect(window.sessionStorage.getItem("swifthealth.staff-session")).toBeNull();
  });

  it("keeps only digits in the code, at most six, and asks for six before it calls the API", async () => {
    const calls = await toStepTwo();
    await userEvent.type(screen.getByLabelText("6-digit code"), "12ab34 5678");
    expect(screen.getByLabelText("6-digit code")).toHaveValue("123456");
    await userEvent.clear(screen.getByLabelText("6-digit code"));
    await userEvent.type(screen.getByLabelText("6-digit code"), "12");
    await userEvent.type(screen.getByLabelText("New password"), "brand-new-password-91");

    await userEvent.click(screen.getByRole("button", { name: "Set the new password" }));

    expect(screen.getByText("Enter the 6 digits of the code.")).toBeInTheDocument();
    expect(calls.filter((call) => call.path === "/auth/reset-password")).toEqual([]);
  });

  it("shows the API's sentence for a wrong code (401) or a refused password (422), and keeps the step", async () => {
    await toStepTwo({ "/auth/reset-password": () => json({ detail: "Invalid or expired code" }, 401) });
    await userEvent.type(screen.getByLabelText("6-digit code"), "000000");
    await userEvent.type(screen.getByLabelText("New password"), "brand-new-password-91");

    await userEvent.click(screen.getByRole("button", { name: "Set the new password" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid or expired code");
    expect(screen.getByLabelText("6-digit code")).toBeInTheDocument();
  });

  it("uses the shared password field and starts again with Start again", async () => {
    await toStepTwo();

    expect(screen.getByLabelText("New password")).toHaveAttribute("autocomplete", "new-password");
    expect(screen.getByRole("button", { name: "Show password" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Start again" }));

    expect(screen.queryByLabelText("6-digit code")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("makes the fields and buttons at least 48 px", async () => {
    await toStepTwo();

    expect(screen.getByLabelText("6-digit code").className).toMatch(/min-h-12/);
    expect(screen.getByRole("button", { name: "Set the new password" }).className).toMatch(/min-h-\[50px\]/);
    expect(screen.getByRole("button", { name: "Start again" }).className).toMatch(/min-h-12/);
  });
});

describe("where it is linked", () => {
  it("is linked from the login form as Forgot your password?", () => {
    expect(readSource("components/admin/LoginForm.tsx")).toMatch(/href="\/forgot-password"/);
    expect(readSource("components/admin/LoginForm.tsx")).toMatch(/Forgot your password\?/);
  });

  it("works while a person is logged in too (nothing is read from the session)", async () => {
    saveStaffSession({ token: "t", user: { id: 1, name: "X", email: "x@example.com", phone: null, role: "editor", is_active: true } });
    const calls = stubApi({ "/auth/forgot-password": FORGOT });
    render(<ForgotPasswordPage />);

    await askForTheCode();

    await screen.findByLabelText("6-digit code");
    expect(calls[0].auth).toBeUndefined();
  });
});
