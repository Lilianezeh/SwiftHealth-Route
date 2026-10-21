// @vitest-environment jsdom
/** /admin and /admin/login. Requirements: FR-30, FR-42. Decision C11 in specs/2026-10-20-staff-screens/requirements.md:
 * /admin sends each role to its own start, and a visitor with no session to the login.
 */
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AdminPage from "@/app/(dashboards)/admin/page";
import LoginPage from "@/app/(dashboards)/admin/login/page";
import { saveStaffSession } from "@/lib/staff/session";
import type { StaffRole } from "@/types/staff";

import { readSource } from "../helpers/source";

const replace = vi.fn();
const router = { replace, push: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

beforeEach(() => {
  window.sessionStorage.clear();
  replace.mockReset();
});

function sessionFor(role: StaffRole) {
  saveStaffSession({
    token: "tok",
    user: { id: 1, name: "Ada", email: "a@b.co", phone: null, role, is_active: true },
  });
}

describe("/admin", () => {
  it("sends a visitor with no session to the login", async () => {
    render(<AdminPage />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/login"));
  });

  it.each([
    ["verifier", "/admin/listings?mine=true"],
    ["editor", "/admin/listings"],
    ["admin", "/admin/listings"],
    ["provider", "/provider"],
  ] as const)("sends a %s to %s", async (role, address) => {
    sessionFor(role);
    render(<AdminPage />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith(address));
  });

  it("says it is going somewhere while it decides, never showing staff data", () => {
    render(<AdminPage />);

    expect(screen.getByRole("status")).toHaveTextContent(/Going to/);
  });
});

describe("/admin/login", () => {
  it("is the login form", () => {
    render(<LoginPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Staff login" })).toBeInTheDocument();
  });

  it("is not in the footer or the header: staff open it by address", () => {
    expect(readSource("config/site.ts")).not.toMatch(/admin/);
  });
});
