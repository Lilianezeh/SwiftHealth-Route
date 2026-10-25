// @vitest-environment jsdom
/** The shared password field with its show / hide eye button. Requirements: NFR-06, NFR-10 (large tap targets, 16 px text),
 * US-13 (small screens). Owner's request of 2026-10-25.
 *
 * One component for every password field (staff login, the Security screen, the staff accounts screen, and the sign-up, change-password
 * and reset-password screens to come). The button is a real button with aria-label and aria-pressed, at least 48 px, never submits the
 * form. The same input stays in the page when its type changes (so the browser's password manager and a paste keep working), and the
 * password goes back to hidden when the form is submitted or the page is left.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { PasswordField } from "@/components/ui/PasswordField";

import { readSource } from "../helpers/source";

function Harness({ onSubmit = () => undefined, autoComplete = "current-password" as const }: { onSubmit?: () => void; autoComplete?: "current-password" | "new-password" }) {
  const [value, setValue] = useState("");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label htmlFor="pw">Password</label>
      <PasswordField id="pw" value={value} onChange={setValue} autoComplete={autoComplete} />
      <button type="submit">Send</button>
    </form>
  );
}

const field = () => screen.getByLabelText("Password") as HTMLInputElement;
const eye = (name: "Show password" | "Hide password" = "Show password") => screen.getByRole("button", { name });

describe("the field", () => {
  it("starts hidden: a password input, labelled by the caller, with the eye button beside it", () => {
    render(<Harness />);

    expect(field()).toHaveAttribute("type", "password");
    expect(field()).toHaveAttribute("id", "pw");
    expect(eye()).toHaveAttribute("type", "button");
    expect(eye()).toHaveAttribute("aria-pressed", "false");
  });

  it.each(["current-password", "new-password"] as const)("passes autocomplete=%s on, hidden or shown, for the password manager", async (value) => {
    render(<Harness autoComplete={value} />);
    expect(field()).toHaveAttribute("autocomplete", value);

    await userEvent.click(eye());

    expect(field()).toHaveAttribute("autocomplete", value);
  });

  it("shows the password when the eye is pressed and hides it when it is pressed again, with the label and aria-pressed following", async () => {
    render(<Harness />);
    await userEvent.type(field(), "my-secret-1");

    await userEvent.click(eye("Show password"));
    expect(field()).toHaveAttribute("type", "text");
    expect(field()).toHaveValue("my-secret-1");
    expect(eye("Hide password")).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: "Show password" })).toBeNull();

    await userEvent.click(eye("Hide password"));
    expect(field()).toHaveAttribute("type", "password");
    expect(eye("Show password")).toHaveAttribute("aria-pressed", "false");
  });

  it("keeps the same input element when it changes type, so a paste, the caret and the password manager keep working", async () => {
    render(<Harness />);
    const before = field();
    await userEvent.type(before, "abc");

    await userEvent.click(eye());

    expect(field()).toBe(before);
    expect(field()).toHaveValue("abc");
  });

  it("accepts a paste, hidden or shown", async () => {
    render(<Harness />);
    await userEvent.click(field());
    await userEvent.paste("pasted-password-1");
    expect(field()).toHaveValue("pasted-password-1");

    await userEvent.click(eye());
    await userEvent.click(field());
    await userEvent.paste("-more");
    expect(field()).toHaveValue("pasted-password-1-more");
  });

  it("turns off the guesses of the keyboard for a shown password: no capital, no autocorrect, no spell check", () => {
    render(<Harness />);

    expect(field()).toHaveAttribute("autocapitalize", "none");
    expect(field()).toHaveAttribute("autocorrect", "off");
    expect(field()).toHaveAttribute("spellcheck", "false");
  });
});

describe("the button", () => {
  it("never submits the form, with a click or with the keyboard", async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    await userEvent.click(eye());
    eye("Hide password").focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("works with the keyboard: Tab from the field reaches it, and Enter and Space both toggle it", async () => {
    render(<Harness />);
    await userEvent.click(field());

    await userEvent.tab();
    expect(eye()).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(field()).toHaveAttribute("type", "text");
    await userEvent.keyboard(" ");
    expect(field()).toHaveAttribute("type", "password");
  });

  it("is at least 48 px high and wide, inside the right edge of the field, with a 16 px field text", () => {
    render(<Harness />);

    expect(eye().className).toMatch(/\bmin-h-12\b/);
    expect(eye().className).toMatch(/\bw-12\b/);
    expect(eye().className).toMatch(/\babsolute\b/);
    expect(eye().className).toMatch(/\bright-0\b/);
    expect(field().className).toMatch(/\bmin-h-12\b/);
    expect(field().className).toMatch(/\btext-base\b/);
    expect(field().className).toMatch(/\bpr-14\b/); // room for the button: the text never runs under it
    expect(field().className).toMatch(/\bw-full\b/);
  });

  it("has an icon that is only decoration: hidden from screen readers, the label is on the button", () => {
    render(<Harness />);

    const icon = eye().querySelector("svg");
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(eye().textContent).toBe("");
  });
});

describe("going back to hidden", () => {
  it("hides the password again when the form is submitted", async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    await userEvent.type(field(), "my-secret-1");
    await userEvent.click(eye());
    expect(field()).toHaveAttribute("type", "text");

    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(field()).toHaveAttribute("type", "password");
    expect(eye("Show password")).toHaveAttribute("aria-pressed", "false");
    expect(field()).toHaveValue("my-secret-1"); // only the display changes
  });

  it("hides it when the page is left (pagehide, also when the browser keeps the page for the back button)", async () => {
    render(<Harness />);
    await userEvent.click(eye());
    expect(field()).toHaveAttribute("type", "text");

    fireEvent(window, new Event("pagehide"));

    expect(await screen.findByRole("button", { name: "Show password" })).toBeInTheDocument();
    expect(field()).toHaveAttribute("type", "password");
  });

  it("starts hidden again when the field is drawn again, as after a change of page or of step", async () => {
    const first = render(<Harness />);
    await userEvent.click(eye());
    first.unmount();

    render(<Harness />);

    expect(field()).toHaveAttribute("type", "password");
  });

  it("stops listening when it is removed: nothing is left on the window or the form", async () => {
    const remove = vi.spyOn(window, "removeEventListener");
    const view = render(<Harness />);

    view.unmount();

    expect(remove).toHaveBeenCalledWith("pagehide", expect.any(Function));
    remove.mockRestore();
  });
});

describe("how it is written", () => {
  it("uses the colour tokens only (no colour written by hand, nothing red), so a dark mode changes it in one place", () => {
    const source = readSource("components/ui/PasswordField.tsx");

    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(source).not.toMatch(/\b(?:text|bg|border)-(?:red|emergency|black|gray|slate|blue)\b/); // the tokens are the blue palette
    expect(source).toMatch(/text-forest/);
  });

  it("is the only place that writes a password input: every other screen uses it, so none can forget the eye", () => {
    const folder = join(process.cwd(), "src");
    const files = (readdirSync(folder, { recursive: true }) as string[]).filter((name) => /\.(tsx|ts)$/.test(name));
    // What an input's type looks like: type="password", or type={shown ? "text" : "password"}.
    const looksLikeAPasswordInput = /type=(?:"password"|'password'|\{[^}]*["']password["'][^}]*\})/;
    const writers = files.filter((name) => looksLikeAPasswordInput.test(readFileSync(join(folder, name), "utf8")));

    expect(writers.map((name) => name.replaceAll("\\", "/"))).toEqual(["components/ui/PasswordField.tsx"]);
  });

  it("does not block a paste or write to the console or a storage", () => {
    const source = readSource("components/ui/PasswordField.tsx");

    expect(source).not.toMatch(/onPaste|onCopy|onCut|preventDefault/);
    expect(source).not.toMatch(/console\.|localStorage|sessionStorage/);
  });
});
