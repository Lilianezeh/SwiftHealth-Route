// @vitest-environment jsdom
/** The staff session in the browser. Requirements: FR-30, NFR-06, NFR-07. Decision C2 in
 * specs/2026-10-20-staff-screens/requirements.md: sessionStorage only (gone when the tab closes), never localStorage.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { STAFF_SESSION_CHANGED, STAFF_SESSION_KEY, clearStaffSession, readStaffSession, saveStaffSession } from "@/lib/staff/session";
import { homeAddressFor, canOpen } from "@/lib/staff/roles";
import type { StaffUser } from "@/types/staff";

const USER: StaffUser = { id: 3, name: "Ada Verifier", email: "ada@example.com", phone: "+2340000000001", role: "verifier", is_active: true };

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

describe("the header is told when the session changes (Phase 3b: My account)", () => {
  it("announces a saved session and a cleared one in the same tab, where the storage event does not fire", () => {
    const heard = vi.fn();
    window.addEventListener(STAFF_SESSION_CHANGED, heard);
    try {
      saveStaffSession({ token: "t.o.k", user: USER });
      clearStaffSession();
    } finally {
      window.removeEventListener(STAFF_SESSION_CHANGED, heard);
    }

    expect(heard).toHaveBeenCalledTimes(2);
  });
});

describe("the staff session", () => {
  it("is saved in sessionStorage and read back", () => {
    saveStaffSession({ token: "t.o.k", user: USER });

    expect(readStaffSession()).toEqual({ token: "t.o.k", user: USER });
    expect(window.sessionStorage.getItem(STAFF_SESSION_KEY)).not.toBeNull();
  });

  it("is never in localStorage", () => {
    saveStaffSession({ token: "t.o.k", user: USER });

    expect(window.localStorage.length).toBe(0);
  });

  it("is gone after clearing", () => {
    saveStaffSession({ token: "t.o.k", user: USER });
    clearStaffSession();

    expect(readStaffSession()).toBeNull();
  });

  it.each([
    ["nothing stored", null],
    ["text that is not JSON", "{not json"],
    ["a number", "5"],
    ["no token", JSON.stringify({ user: USER })],
    ["an empty token", JSON.stringify({ token: "", user: USER })],
    ["no user", JSON.stringify({ token: "t" })],
    ["a user with a wrong role", JSON.stringify({ token: "t", user: { ...USER, role: "boss" } })],
    ["a user with no name", JSON.stringify({ token: "t", user: { ...USER, name: 5 } })],
  ])("reads %s as no session", (_label, stored) => {
    if (stored !== null) window.sessionStorage.setItem(STAFF_SESSION_KEY, stored);

    expect(readStaffSession()).toBeNull();
  });

  it("copes with a storage that throws (private mode)", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(() => saveStaffSession({ token: "t", user: USER })).not.toThrow();
    expect(readStaffSession()).toBeNull();
    expect(() => clearStaffSession()).not.toThrow();
  });
});

describe("where each role starts, and what each may open (decision C11)", () => {
  it.each([
    ["verifier", "/admin/listings?mine=true"],
    ["editor", "/admin"],
    ["admin", "/admin"],
    ["provider", "/provider"],
  ] as const)("%s starts at %s", (role, address) => {
    expect(homeAddressFor(role)).toBe(address);
  });

  it("lets every staff role open the listings and only the admin open the staff accounts", () => {
    for (const role of ["verifier", "editor", "admin"] as const) expect(canOpen(role, "listings")).toBe(true);
    expect(canOpen("provider", "listings")).toBe(false);
    expect(canOpen("admin", "staff")).toBe(true);
    for (const role of ["editor", "admin"] as const) expect(canOpen(role, "review")).toBe(true); // dashboard, reports, re-checks
    for (const role of ["verifier", "provider"] as const) expect(canOpen(role, "review")).toBe(false);
    for (const role of ["verifier", "editor", "provider"] as const) expect(canOpen(role, "staff")).toBe(false);
  });

  it("lets every role open the Security screen (FR-58): everyone with an account can switch the app on", () => {
    for (const role of ["verifier", "editor", "admin", "provider"] as const) expect(canOpen(role, "security")).toBe(true);
  });
});
