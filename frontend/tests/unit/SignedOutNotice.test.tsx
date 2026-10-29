// @vitest-environment jsdom
/** The sentence on the login page after an automatic sign-out. Requirements: NFR-06, NFR-10. Spec: specs/2026-10-29-idle-sign-out/.
 * The idle sign-out sends the person to /log-in?signed-out=idle; the page says why, once, politely, as a status (not an alert).
 */
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SignedOutNotice } from "@/components/admin/SignedOutNotice";
import { IDLE_LOGIN_ADDRESS } from "@/config/idle";
import { readSource } from "../helpers/source";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));

afterEach(() => window.history.pushState({}, "", "/"));

describe("SignedOutNotice", () => {
  it("says the person was signed out for being inactive, as a status", async () => {
    window.history.pushState({}, "", IDLE_LOGIN_ADDRESS);
    render(<SignedOutNotice />);

    const notice = await screen.findByRole("status");
    expect(notice).toHaveTextContent("You were signed out because you were inactive. Log in again to continue.");
  });

  it("is where the idle sign-out sends the person: /log-in?signed-out=idle", () => {
    expect(IDLE_LOGIN_ADDRESS).toBe("/log-in?signed-out=idle");
  });

  it.each(["/log-in", "/log-in?next=/list-your-facility", "/log-in?signed-out=other"])("shows nothing on %s", (address) => {
    window.history.pushState({}, "", address);
    const { container } = render(<SignedOutNotice />);

    expect(container).toBeEmptyDOMElement();
  });

  it("is shown above the login form", () => {
    expect(readSource("app/(dashboards)/log-in/page.tsx")).toMatch(/<SignedOutNotice\s*\/>[\s\S]*<LoginForm\s*\/>/);
  });
});
