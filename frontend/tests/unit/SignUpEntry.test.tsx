// @vitest-environment jsdom
/** How the sign-up page is opened with the kind already chosen: `/sign-up?as=owner` (from For facilities) and `/sign-up?as=staff` (from
 * the Staff portal). Requirements: FR-48, FR-49, NFR-10. Owner's request of 2026-11-02; UI spec 3.1c. `/sign-up` alone still asks.
 * Any other value asks too (never a guess), and the choice is never kept in the browser. Every name here is fictional.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SignUpPage from "@/app/(dashboards)/sign-up/page";
import { signUpKindFromAddress } from "@/lib/account/signupKind";

import { readSource } from "../helpers/source";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

async function openSignUp(parameters: { as?: string | string[] }) {
  render(await SignUpPage({ searchParams: Promise.resolve(parameters) }));
}

describe("the kind named in the address", () => {
  it.each([
    ["owner", "provider"],
    ["staff", "staff"],
  ] as const)("reads as=%s as the account kind %s", (word, kind) => {
    expect(signUpKindFromAddress(word)).toBe(kind);
  });

  it.each([undefined, "", "admin", "provider", "OWNER", "owner staff", ["owner", "staff"], "<script>"])(
    "reads %j as no choice, so the question is asked",
    (value) => {
      expect(signUpKindFromAddress(value as string | undefined)).toBeNull();
    },
  );
});

describe("the sign-up page", () => {
  it("asks the question when it is opened with no choice, as before", async () => {
    await openSignUp({});

    expect(screen.getByText("What do you want to sign up as?")).toBeInTheDocument();
  });

  it("opens on the Facility owner form with ?as=owner", async () => {
    await openSignUp({ as: "owner" });

    expect(screen.getByText("Signing up as: Facility owner")).toBeInTheDocument();
    expect(screen.queryByText("What do you want to sign up as?")).not.toBeInTheDocument();
  });

  it("opens on the Staff form with ?as=staff, and says an admin must approve it", async () => {
    await openSignUp({ as: "staff" });

    expect(screen.getByText("Signing up as: Staff")).toBeInTheDocument();
    expect(screen.getByText("An admin must approve your staff sign-up before you can use it.")).toBeInTheDocument();
  });

  it("asks the question for a value it does not know, or a list of values", async () => {
    await openSignUp({ as: ["owner", "staff"] });

    expect(screen.getByText("What do you want to sign up as?")).toBeInTheDocument();
  });

  it("keeps the old address: it is still /sign-up, and still not for search engines", () => {
    expect(readSource("app/(dashboards)/sign-up/page.tsx")).toContain("SignUpForm");
    expect(readSource("app/(dashboards)/layout.tsx")).toMatch(/index:\s*false/);
  });
});
