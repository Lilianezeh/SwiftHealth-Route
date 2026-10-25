// @vitest-environment jsdom
/** The sign-up page: the choice, then one form. Requirements: FR-48, FR-49, FR-56, NFR-06, NFR-10. UI spec 3.1c;
 * decisions D6 and D20 in specs/2026-10-23-accounts-and-facility-ownership/. Every name, address and number is fictional.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SignUpForm } from "@/components/account/SignUpForm";
import { readSignUpStep, SIGNUP_STEP_KEY } from "@/lib/account/signupStep";

import { json } from "../helpers/api";

// Fields and links use min-h-12 (48 px); the shared buttons use min-h-[50px] (UI spec, "Buttons and text").
const AT_LEAST_48_PX = /min-h-(12|14|\[(4[89]|[5-9]\d)px\])/;

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

type Call = { path: string; body: Record<string, string> };

function stubApi(answer: () => Response = () => json({ confirm_token: "email.jwt", sent_to: "a***@example.com" })) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (address: string, init: RequestInit) => {
      calls.push({ path: new URL(address).pathname, body: JSON.parse(String(init.body)) as Record<string, string> });
      return answer();
    }),
  );
  return calls;
}

beforeEach(() => {
  window.sessionStorage.clear();
  push.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

async function chooseAndFill(kind: "Staff" | "Facility owner", password = "river78!") {
  await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${kind}`) }));
  await userEvent.type(screen.getByLabelText("Name"), "Ada Owner");
  await userEvent.type(screen.getByLabelText("Email"), "ada.owner@example.com");
  await userEvent.type(screen.getByLabelText("Phone number"), "0803 000 0123");
  await userEvent.type(screen.getByLabelText("Password", { exact: true }), password);
}

describe("step 1: what do you want to sign up as?", () => {
  it("asks the question with two large buttons, Staff and Facility owner, and shows no form yet", () => {
    stubApi();
    render(<SignUpForm />);

    expect(screen.getByRole("heading", { level: 1, name: "Sign up" })).toBeInTheDocument();
    expect(screen.getByText("What do you want to sign up as?")).toBeInTheDocument();
    for (const name of [/^Staff/, /^Facility owner/]) {
      expect(screen.getByRole("button", { name }).className).toMatch(/min-h-12|min-h-\[?(1[2-9]|[2-9]\d)/);
    }
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
  });

  it("links to the log-in page for someone who already has an account", () => {
    stubApi();
    render(<SignUpForm />);

    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/log-in");
  });
});

describe("step 2: the form", () => {
  it("for a facility owner: name, email, phone, password with the 8-character hint, and no note", async () => {
    stubApi();
    render(<SignUpForm />);

    await userEvent.click(screen.getByRole("button", { name: /^Facility owner/ }));

    expect(screen.getByText("Signing up as: Facility owner")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveAttribute("autocomplete", "name");
    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Phone number")).toHaveAttribute("type", "tel");
    expect(screen.getByLabelText("Password", { exact: true })).toHaveAttribute("autocomplete", "new-password");
    expect(screen.getByText(/At least 8 characters/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Who are you, and who can say so?")).not.toBeInTheDocument();
  });

  it("for staff: the 10-character hint and the optional note", async () => {
    stubApi();
    render(<SignUpForm />);

    await userEvent.click(screen.getByRole("button", { name: /^Staff/ }));

    expect(screen.getByText("Signing up as: Staff")).toBeInTheDocument();
    expect(screen.getByText(/At least 10 characters/)).toBeInTheDocument();
    const note = screen.getByLabelText("Who are you, and who can say so?");
    expect(note).toHaveAttribute("maxlength", "500");
    expect(note).not.toBeRequired();
  });

  it("uses the shared password field, with its show and hide button", async () => {
    stubApi();
    render(<SignUpForm />);
    await userEvent.click(screen.getByRole("button", { name: /^Facility owner/ }));

    const eye = screen.getByRole("button", { name: "Show password" });
    await userEvent.click(eye);

    expect(screen.getByLabelText("Password", { exact: true })).toHaveAttribute("type", "text");
  });

  it("goes back to the choice with Change, and keeps what was typed", async () => {
    stubApi();
    render(<SignUpForm />);
    await chooseAndFill("Facility owner");

    await userEvent.click(screen.getByRole("button", { name: "Change" }));
    expect(screen.getByText("What do you want to sign up as?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^Staff/ }));

    expect(screen.getByLabelText("Name")).toHaveValue("Ada Owner");
  });

  it("makes every field and button at least 48 px high", async () => {
    stubApi();
    render(<SignUpForm />);
    await userEvent.click(screen.getByRole("button", { name: /^Staff/ }));

    for (const control of [
      screen.getByLabelText("Name"),
      screen.getByLabelText("Email"),
      screen.getByLabelText("Phone number"),
      screen.getByLabelText("Password", { exact: true }),
      screen.getByRole("button", { name: "Send me a code" }),
      screen.getByRole("button", { name: "Change" }),
    ]) {
      expect(control.className, control.getAttribute("id") ?? control.textContent ?? "").toMatch(AT_LEAST_48_PX);
    }
  });
});

describe("sending the form", () => {
  it("posts the details with the account type, saves only the code step, and goes to the confirm page", async () => {
    const calls = stubApi();
    render(<SignUpForm />);
    await chooseAndFill("Facility owner");

    await userEvent.click(screen.getByRole("button", { name: "Send me a code" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/sign-up/confirm"));
    expect(calls).toEqual([
      {
        path: "/auth/signup",
        body: {
          name: "Ada Owner",
          email: "ada.owner@example.com",
          phone: "0803 000 0123",
          password: "river78!",
          account_type: "provider",
        },
      },
    ]);
    const saved = readSignUpStep();
    expect(saved).toMatchObject({ step: "email", token: "email.jwt", sentTo: "a***@example.com", kind: "provider" });
    expect(saved?.readyAt).toBeGreaterThan(Date.now() + 50_000); // a new code may be asked for in about 60 seconds
    const stored = window.sessionStorage.getItem(SIGNUP_STEP_KEY) ?? "";
    expect(stored).not.toContain("river78!");
    expect(stored).not.toContain("ada.owner@example.com");
  });

  it("sends the staff note, trimmed, and leaves it out when empty", async () => {
    const calls = stubApi();
    render(<SignUpForm />);
    await chooseAndFill("Staff", "river-bed-77");
    await userEvent.type(screen.getByLabelText("Who are you, and who can say so?"), "  Verifier in Ogui.  ");

    await userEvent.click(screen.getByRole("button", { name: "Send me a code" }));

    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(calls[0].body).toMatchObject({ account_type: "staff", note: "Verifier in Ogui." });
  });

  it("does not send the note key at all when the field is empty", async () => {
    const calls = stubApi();
    render(<SignUpForm />);
    await chooseAndFill("Staff", "river-bed-77");

    await userEvent.click(screen.getByRole("button", { name: "Send me a code" }));

    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(calls[0].body).not.toHaveProperty("note");
  });

  it("does not send twice while waiting", async () => {
    let release: (response: Response) => void = () => undefined;
    const calls: Call[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (address: string, init: RequestInit) => {
        calls.push({ path: new URL(address).pathname, body: JSON.parse(String(init.body)) as Record<string, string> });
        return new Promise<Response>((resolve) => (release = resolve));
      }),
    );
    render(<SignUpForm />);
    await chooseAndFill("Facility owner");

    await userEvent.click(screen.getByRole("button", { name: "Send me a code" }));
    expect(screen.getByRole("button", { name: "Sending…" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Sending…" }));
    release(json({ confirm_token: "t", sent_to: "a***@example.com" }));

    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(calls).toHaveLength(1);
  });
});

describe("when the sign-up is refused", () => {
  async function submitWith(answer: () => Response) {
    stubApi(answer);
    render(<SignUpForm />);
    await chooseAndFill("Facility owner");
    await userEvent.click(screen.getByRole("button", { name: "Send me a code" }));
    return screen.findByRole("alert");
  }

  it("says the API's own sentence for a closed sign-up (503)", async () => {
    const alert = await submitWith(() => json({ detail: "Sign-up is not open yet." }, 503));

    expect(alert).toHaveTextContent("Sign-up is not open yet.");
    expect(push).not.toHaveBeenCalled();
    expect(readSignUpStep()).toBeNull();
  });

  it("says the API's password sentence for a refused password (422 with a text)", async () => {
    const alert = await submitWith(() => json({ detail: "That password is too common. Choose another." }, 422));

    expect(alert).toHaveTextContent("That password is too common. Choose another.");
  });

  it("says plain words for any other 422 (a list of field problems)", async () => {
    const alert = await submitWith(() => json({ detail: [{ loc: ["body", "phone"], msg: "bad" }] }, 422));

    expect(alert).toHaveTextContent("Check your name, email and phone number.");
  });

  it("says the API's sentence for too many attempts (429)", async () => {
    const alert = await submitWith(() => json({ detail: "Too many sign-up attempts for this email. Try again later." }, 429));

    expect(alert).toHaveTextContent("Too many sign-up attempts for this email. Try again later.");
  });

  it("says that the email could not be sent (502)", async () => {
    const alert = await submitWith(() => json({ detail: "Could not send the email. Try again." }, 502));

    expect(alert).toHaveTextContent("Could not send the email. Try again.");
  });

  it("says plain words when the network fails, and the form keeps what was typed", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("offline"))));
    render(<SignUpForm />);
    await chooseAndFill("Facility owner");
    await userEvent.click(screen.getByRole("button", { name: "Send me a code" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't sign you up. Check your connection and try again.");
    expect(screen.getByLabelText("Email")).toHaveValue("ada.owner@example.com");
    expect(screen.getByRole("button", { name: "Send me a code" })).toBeEnabled();
  });
});
