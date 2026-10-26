// @vitest-environment jsdom
/** The pages of the accounts: /sign-up, /sign-up/confirm, /sign-up/waiting, /log-in. Requirements: FR-48, FR-49, NFR-10.
 * UI spec 3.1c. The pages are thin: they only hold a component (or, for the waiting page, plain text).
 */
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ConfirmPage from "@/app/(dashboards)/sign-up/confirm/page";
import SignUpPage from "@/app/(dashboards)/sign-up/page";
import WaitingPage from "@/app/(dashboards)/sign-up/waiting/page";
import LogInPage from "@/app/(dashboards)/log-in/page";

import { stubSignupOpen } from "../helpers/api";
import { readSource } from "../helpers/source";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

afterEach(() => vi.unstubAllGlobals());

describe("/sign-up/waiting", () => {
  it("tells a staff sign-up that an admin will look at the request, that they may be phoned, and that they can log in once approved", () => {
    render(<WaitingPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Thank you. Your request is with an admin." })).toBeInTheDocument();
    expect(screen.getByText(/cannot use the staff area until an admin approves you/)).toBeInTheDocument();
    expect(screen.getByText(/may phone you at the number you gave/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to the home page" })).toHaveAttribute("href", "/");
  });

  it("gives no medical advice and is not red (red is for emergencies)", () => {
    const { container } = render(<WaitingPage />);

    expect(container.innerHTML).not.toMatch(/emergency|bg-red|text-red/i);
  });
});

describe("/log-in", () => {
  it("is the login form with the heading Log in, and a link to sign up under the first step while sign-up is open", async () => {
    await stubSignupOpen(true);
    render(<LogInPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Log in" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Sign up" })).toHaveAttribute("href", "/sign-up");
  });

  it("has no link to sign up while sign-up is closed", async () => {
    await stubSignupOpen(false);
    render(<LogInPage />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    expect(screen.queryByRole("link", { name: "Sign up" })).not.toBeInTheDocument();
  });
});

describe("/sign-up and /sign-up/confirm", () => {
  it("hold their component", async () => {
    render(<SignUpPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Sign up" })).toBeInTheDocument();
  });

  it("the confirm page says there is no sign-up to finish when nothing is saved", async () => {
    window.sessionStorage.clear();
    render(<ConfirmPage />);

    expect(await screen.findByText("There is no sign-up to finish.")).toBeInTheDocument();
  });
});

describe("the pages are not indexed and are thin", () => {
  it.each(["sign-up/page.tsx", "sign-up/confirm/page.tsx", "sign-up/waiting/page.tsx", "log-in/page.tsx"])(
    "%s sits in the staff-area layout, which keeps it out of search engines, and calls no API itself",
    (file) => {
      const source = readSource(`app/(dashboards)/${file}`);

      expect(source).not.toMatch(/fetch\(|lib\/api\//);
    },
  );
});
