// @vitest-environment jsdom
/** The gate and the bar of the staff area. Requirements: FR-30, FR-42, NFR-06, NFR-10. UI spec "Phase 10 details";
 * decisions C2 and C11 in specs/2026-10-20-staff-screens/requirements.md.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StaffGate, useStaff } from "@/components/admin/StaffGate";
import { ApiError } from "@/lib/api/request";
import { readStaffSession, saveStaffSession } from "@/lib/staff/session";
import type { StaffRole, StaffUser } from "@/types/staff";

const replace = vi.fn();
// One router object, like Next.js: a new object on every render would make the gate's effect run again and again.
const router = { replace, push: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

function user(role: StaffRole): StaffUser {
  return { id: 3, name: "Ada Staff", email: "ada@example.com", phone: "+2340000000001", role, is_active: true };
}

beforeEach(() => {
  window.sessionStorage.clear();
  replace.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

function Probe() {
  const { session, call } = useStaff();
  return (
    <div>
      <p>token:{session.token}</p>
      <button onClick={() => call(async () => { throw new ApiError(401); }).catch(() => undefined)}>Expire</button>
      <button onClick={() => call(async () => { throw new ApiError(403); }).catch(() => undefined)}>Forbid</button>
    </div>
  );
}

describe("StaffGate", () => {
  it("sends a visitor with no session to the login screen and shows none of the page", async () => {
    render(<StaffGate area="listings"><p>Secret page</p></StaffGate>);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/login"));
    expect(screen.queryByText("Secret page")).toBeNull();
  });

  it("shows the page and the bar for a role that may open it", async () => {
    saveStaffSession({ token: "tok", user: user("editor") });
    render(<StaffGate area="listings"><p>Listings page</p></StaffGate>);

    expect(await screen.findByText("Listings page")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText("Ada Staff")).toBeInTheDocument();
    expect(screen.getByText("Editor")).toBeInTheDocument();
  });

  it("says a role cannot open a page it may not, with a link to where it starts, and not the page", async () => {
    saveStaffSession({ token: "tok", user: user("verifier") });
    render(<StaffGate area="staff"><p>Staff accounts</p></StaffGate>);

    expect(await screen.findByText("Your role cannot open this page.")).toBeInTheDocument();
    expect(screen.queryByText("Staff accounts")).toBeNull();
    expect(screen.getByRole("link", { name: "Go to your listings" })).toHaveAttribute("href", "/admin/listings?mine=true");
  });

  it("shows only the links a role can use: Listings for staff, Staff for the admin only", async () => {
    saveStaffSession({ token: "tok", user: user("admin") });
    const first = render(<StaffGate area="listings"><p>x</p></StaffGate>);
    await screen.findByText("x");
    expect(screen.getByRole("link", { name: "Listings" })).toHaveAttribute("href", "/admin/listings");
    expect(screen.getByRole("link", { name: "Staff" })).toHaveAttribute("href", "/admin/staff");
    first.unmount();

    saveStaffSession({ token: "tok", user: user("editor") });
    render(<StaffGate area="listings"><p>y</p></StaffGate>);
    await screen.findByText("y");
    expect(screen.queryByRole("link", { name: "Staff" })).toBeNull();
  });

  it("makes every link and button of the bar at least 48 px high", async () => {
    saveStaffSession({ token: "tok", user: user("admin") });
    render(<StaffGate area="listings"><p>x</p></StaffGate>);
    await screen.findByText("x");

    const controls = [screen.getByRole("link", { name: "Listings" }), screen.getByRole("link", { name: "Staff" }), screen.getByRole("button", { name: "Log out" })];
    for (const control of controls) expect(control.className).toMatch(/\bmin-h-12\b/);
  });

  it("logs out: clears the session and goes to the login", async () => {
    saveStaffSession({ token: "tok", user: user("editor") });
    render(<StaffGate area="listings"><p>x</p></StaffGate>);
    await screen.findByText("x");

    await userEvent.click(screen.getByRole("button", { name: "Log out" }));

    expect(readStaffSession()).toBeNull();
    expect(replace).toHaveBeenCalledWith("/admin/login");
  });

  it("gives the page the token, and a 401 from a call clears the session and goes to the login", async () => {
    saveStaffSession({ token: "tok", user: user("editor") });
    render(<StaffGate area="listings"><Probe /></StaffGate>);
    expect(await screen.findByText("token:tok")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Expire" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/login"));
    expect(readStaffSession()).toBeNull();
  });

  it("a 403 from a call does not log the user out", async () => {
    saveStaffSession({ token: "tok", user: user("editor") });
    render(<StaffGate area="listings"><Probe /></StaffGate>);
    await screen.findByText("token:tok");

    await userEvent.click(screen.getByRole("button", { name: "Forbid" }));

    expect(readStaffSession()).not.toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });
});
