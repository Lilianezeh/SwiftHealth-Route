// @vitest-environment jsdom
/** The confirm page of the sign-up: the email code, then (only when Termii is live) the phone code. Requirements: FR-48,
 * FR-49, FR-57 (the same new-code rules as the login), NFR-06, NFR-10. UI spec 3.1c; decision D20 in
 * specs/2026-10-23-accounts-and-facility-ownership/. Every name, address and number is fictional.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SignUpConfirm } from "@/components/account/SignUpConfirm";
import { readSignUpStep, saveSignUpStep, type SignUpStep } from "@/lib/account/signupStep";

import { json } from "../helpers/api";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

type Call = { path: string; body: Record<string, string> };
type Answers = Partial<Record<"/auth/confirm-email" | "/auth/confirm-phone" | "/auth/signup-resend-code", () => Response>>;

function stubApi(answers: Answers = {}) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (address: string, init: RequestInit) => {
      const path = new URL(address).pathname as keyof Answers;
      calls.push({ path, body: JSON.parse(String(init.body)) as Record<string, string> });
      const answer = answers[path];
      return answer ? answer() : json({ detail: "Not found" }, 404);
    }),
  );
  return calls;
}

const EMAIL_STEP: SignUpStep = { step: "email", token: "email.jwt", sentTo: "a***@example.com", kind: "provider", readyAt: 0 };

beforeEach(() => {
  window.sessionStorage.clear();
  push.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function tooManyRequests(detail: string, retryAfter: number): Response {
  return new Response(JSON.stringify({ detail }), {
    status: 429,
    headers: { "Content-Type": "application/json", "Retry-After": String(retryAfter) },
  });
}

async function typeCode(code: string) {
  await userEvent.type(await screen.findByLabelText("6-digit code"), code);
}

describe("with nothing saved", () => {
  it("says there is no sign-up to finish and offers to start one", async () => {
    stubApi();
    render(<SignUpConfirm />);

    expect(await screen.findByText("There is no sign-up to finish.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute("href", "/sign-up");
    expect(screen.queryByLabelText("6-digit code")).not.toBeInTheDocument();
  });
});

describe("the email step", () => {
  it("shows where the code went, a numeric one-time-code field and a Confirm email button", async () => {
    saveSignUpStep(EMAIL_STEP);
    stubApi();
    render(<SignUpConfirm />);

    expect(await screen.findByText("Code sent to a***@example.com")).toBeInTheDocument();
    const field = screen.getByLabelText("6-digit code");
    expect(field).toHaveAttribute("inputmode", "numeric");
    expect(field).toHaveAttribute("autocomplete", "one-time-code");
    expect(field.className).toMatch(/min-h-12/);
    expect(screen.getByRole("button", { name: "Confirm email" }).className).toMatch(/min-h-\[50px\]/); // the shared button: 50 px
  });

  it("keeps only digits, at most six", async () => {
    saveSignUpStep(EMAIL_STEP);
    stubApi();
    render(<SignUpConfirm />);

    await typeCode("12ab34 56789");

    expect(screen.getByLabelText("6-digit code")).toHaveValue("123456");
  });

  it("asks for six digits before it calls the API", async () => {
    saveSignUpStep(EMAIL_STEP);
    const calls = stubApi();
    render(<SignUpConfirm />);
    await typeCode("123");

    await userEvent.click(screen.getByRole("button", { name: "Confirm email" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Enter the 6 digits of the code.");
    expect(calls).toEqual([]);
  });

  it("with Termii live: sends the code and moves to the phone step with only the last four digits shown", async () => {
    saveSignUpStep(EMAIL_STEP);
    const calls = stubApi({
      "/auth/confirm-email": () => json({ status: "phone_code_sent", confirm_token: "phone.jwt", sent_to: "+234******0123" }),
    });
    render(<SignUpConfirm />);
    await typeCode("482913");

    await userEvent.click(screen.getByRole("button", { name: "Confirm email" }));

    expect(await screen.findByText("Code sent to ••• ••• 0123")).toBeInTheDocument();
    expect(calls).toEqual([{ path: "/auth/confirm-email", body: { confirm_token: "email.jwt", code: "482913" } }]);
    expect(screen.getByRole("button", { name: "Confirm phone" })).toBeInTheDocument();
    expect(screen.getByLabelText("6-digit code")).toHaveValue(""); // the old code is dropped
    expect(readSignUpStep()).toMatchObject({ step: "phone", token: "phone.jwt", sentTo: "+234******0123" });
  });

  it("without Termii (D20): the email code ends the road for an owner, who is told to log in, and the phone is not asked", async () => {
    saveSignUpStep(EMAIL_STEP);
    stubApi({ "/auth/confirm-email": () => json({ status: "active" }) });
    render(<SignUpConfirm />);
    await typeCode("482913");

    await userEvent.click(screen.getByRole("button", { name: "Confirm email" }));

    expect(await screen.findByText("Your account is ready.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/log-in");
    expect(screen.queryByLabelText("6-digit code")).not.toBeInTheDocument();
    expect(screen.queryByText(/phone/i)).not.toBeInTheDocument();
    expect(readSignUpStep()).toBeNull();
  });

  it("without Termii: staff go to the waiting page", async () => {
    saveSignUpStep({ ...EMAIL_STEP, kind: "staff" });
    stubApi({ "/auth/confirm-email": () => json({ status: "waiting_for_approval" }) });
    render(<SignUpConfirm />);
    await typeCode("482913");

    await userEvent.click(screen.getByRole("button", { name: "Confirm email" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/sign-up/waiting"));
    expect(readSignUpStep()).toBeNull();
  });

  it("says Invalid or expired code for a wrong code (401) and keeps the step", async () => {
    saveSignUpStep(EMAIL_STEP);
    stubApi({ "/auth/confirm-email": () => json({ detail: "Invalid or expired code" }, 401) });
    render(<SignUpConfirm />);
    await typeCode("000000");

    await userEvent.click(screen.getByRole("button", { name: "Confirm email" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid or expired code");
    expect(readSignUpStep()).toMatchObject({ step: "email" });
  });

  it("shows the API's lock sentence after ten wrong codes (429)", async () => {
    saveSignUpStep(EMAIL_STEP);
    stubApi({ "/auth/confirm-email": () => tooManyRequests("Too many wrong codes. Try again in 52 minutes.", 3120) });
    render(<SignUpConfirm />);
    await typeCode("000000");

    await userEvent.click(screen.getByRole("button", { name: "Confirm email" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Too many wrong codes. Try again in 52 minutes.");
  });

  it("says that the code could not be sent when the SMS fails (502), so the email code can be tried again", async () => {
    saveSignUpStep(EMAIL_STEP);
    stubApi({ "/auth/confirm-email": () => json({ detail: "Could not send the code. Try again." }, 502) });
    render(<SignUpConfirm />);
    await typeCode("482913");

    await userEvent.click(screen.getByRole("button", { name: "Confirm email" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not send the code. Try again.");
    expect(screen.getByRole("button", { name: "Confirm email" })).toBeEnabled();
  });
});

describe("the phone step", () => {
  const PHONE_STEP: SignUpStep = { step: "phone", token: "phone.jwt", sentTo: "+234******0123", kind: "provider", readyAt: 0 };

  it("confirms the phone and tells an owner the account is ready", async () => {
    saveSignUpStep(PHONE_STEP);
    const calls = stubApi({ "/auth/confirm-phone": () => json({ status: "active" }) });
    render(<SignUpConfirm />);
    await typeCode("135790");

    await userEvent.click(screen.getByRole("button", { name: "Confirm phone" }));

    expect(await screen.findByText("Your account is ready.")).toBeInTheDocument();
    expect(calls).toEqual([{ path: "/auth/confirm-phone", body: { confirm_token: "phone.jwt", code: "135790" } }]);
    expect(readSignUpStep()).toBeNull();
  });

  it("sends staff to the waiting page", async () => {
    saveSignUpStep({ ...PHONE_STEP, kind: "staff" });
    stubApi({ "/auth/confirm-phone": () => json({ status: "waiting_for_approval" }) });
    render(<SignUpConfirm />);
    await typeCode("135790");

    await userEvent.click(screen.getByRole("button", { name: "Confirm phone" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/sign-up/waiting"));
  });
});

describe("a new code (the same rules as at login)", () => {
  it("is off while the wait lasts, counting down in words", async () => {
    saveSignUpStep({ ...EMAIL_STEP, readyAt: Date.now() + 45_000 });
    stubApi();
    render(<SignUpConfirm />);

    expect(await screen.findByText(/^You can ask for a new code in (44|45) seconds\.$/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send a new code" })).toBeDisabled();
  });

  it("counts on the clock: the seconds fall as time passes", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    saveSignUpStep({ ...EMAIL_STEP, readyAt: Date.now() + 45_000 });
    stubApi();
    render(<SignUpConfirm />);
    await screen.findByText(/in (44|45) seconds/);

    await vi.advanceTimersByTimeAsync(46_000);

    expect(await screen.findByText("You can send a new code now.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send a new code" })).toBeEnabled();
  });

  it("sends the current token, replaces it, waits 60 seconds again and says so", async () => {
    saveSignUpStep(EMAIL_STEP);
    const calls = stubApi({
      "/auth/signup-resend-code": () => json({ confirm_token: "email2.jwt", sent_to: "a***@example.com" }),
    });
    render(<SignUpConfirm />);

    await userEvent.click(await screen.findByRole("button", { name: "Send a new code" }));

    expect(await screen.findByText("A new code was sent.")).toBeInTheDocument();
    expect(calls).toEqual([{ path: "/auth/signup-resend-code", body: { confirm_token: "email.jwt" } }]);
    expect(readSignUpStep()).toMatchObject({ token: "email2.jwt", step: "email" });
    expect(screen.getByText(/^You can ask for a new code in (59|60) seconds\.$/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send a new code" })).toBeDisabled();
  });

  it("uses Retry-After when the server says it is too soon", async () => {
    saveSignUpStep(EMAIL_STEP);
    stubApi({ "/auth/signup-resend-code": () => tooManyRequests("Wait 30 seconds for a new code.", 30) });
    render(<SignUpConfirm />);

    await userEvent.click(await screen.findByRole("button", { name: "Send a new code" }));

    expect(await screen.findByText(/^You can ask for a new code in (29|30) seconds\.$/)).toBeInTheDocument();
  });

  it("stays off, with the API's sentence, when the 5 codes an hour are used", async () => {
    saveSignUpStep(EMAIL_STEP);
    stubApi({ "/auth/signup-resend-code": () => tooManyRequests("Too many codes. Try again in 52 minutes.", 3120) });
    render(<SignUpConfirm />);

    await userEvent.click(await screen.findByRole("button", { name: "Send a new code" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Too many codes. Try again in 52 minutes.");
    expect(screen.getByRole("button", { name: "Send a new code" })).toBeDisabled();
    expect(screen.queryByText("You can send a new code now.")).not.toBeInTheDocument();
  });

  it("asks the person to start again when the token has expired (401)", async () => {
    saveSignUpStep(EMAIL_STEP);
    stubApi({ "/auth/signup-resend-code": () => json({ detail: "Invalid or expired code" }, 401) });
    render(<SignUpConfirm />);

    await userEvent.click(await screen.findByRole("button", { name: "Send a new code" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("The code has expired. Choose Start again to get a new one.");
  });
});

describe("Start again", () => {
  it("forgets the saved step and goes to the sign-up page", async () => {
    saveSignUpStep(EMAIL_STEP);
    const calls = stubApi();
    render(<SignUpConfirm />);

    await userEvent.click(await screen.findByRole("button", { name: "Start again" }));

    expect(readSignUpStep()).toBeNull();
    expect(push).toHaveBeenCalledWith("/sign-up");
    expect(calls).toEqual([]);
  });

  it("is at least 48 px high", async () => {
    saveSignUpStep(EMAIL_STEP);
    stubApi();
    render(<SignUpConfirm />);

    expect((await screen.findByRole("button", { name: "Start again" })).className).toMatch(/min-h-12/);
  });
});
