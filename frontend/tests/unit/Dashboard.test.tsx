// @vitest-environment jsdom
/** The staff dashboard `/admin` and the staff bar. Requirements: US-11, FR-34, NFR-10. UI spec 3.2 and "Phase 11 details";
 * decision H8 in specs/2026-10-20-reports-queue/requirements.md. The editor and the admin see the dashboard; a verifier and a
 * provider are still sent to their own start (decision C11 of phase 10).
 */
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AdminPage from "@/app/(dashboards)/admin/page";
import { StaffBar } from "@/components/admin/StaffBar";
import type { StaffRole } from "@/types/staff";

import { json, neverAnswers } from "../helpers/api";
import { dashboardStats, headerOf, loginAs, stubStaffApi } from "../helpers/queue";
import { readSource } from "../helpers/source";

const replace = vi.fn();
const router = { replace, push: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const stats = () => json(dashboardStats());

beforeEach(() => {
  window.sessionStorage.clear();
  replace.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("who sees the dashboard", () => {
  it("sends a visitor with no session to the login and asks for nothing", async () => {
    const { requests } = stubStaffApi({});
    render(<AdminPage />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/log-in"));
    expect(requests).toHaveLength(0);
  });

  it.each([
    ["verifier", "/admin/listings?mine=true"],
    ["provider", "/provider"],
  ] as const)("sends a %s to %s and asks for no numbers", async (role, address) => {
    loginAs(role);
    const { requests } = stubStaffApi({});
    render(<AdminPage />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith(address));
    expect(requests).toHaveLength(0);
    expect(screen.queryByRole("heading", { name: "Dashboard" })).toBeNull();
  });

  it.each(["editor", "admin"] as const)("shows the dashboard to an %s, with one call that carries the token", async (role) => {
    loginAs(role);
    const { on } = stubStaffApi({ "/dashboard/stats": stats });
    render(<AdminPage />);

    expect(await screen.findByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();

    expect(replace).not.toHaveBeenCalled();
    const requests = on("/dashboard/stats");
    expect(requests).toHaveLength(1);
    expect(headerOf(requests[0].init, "Authorization")).toBe("Bearer tok");
    expect(requests[0].url.search).toBe("");
  });

  it("says it is going somewhere while it sends a visitor away, never showing staff data", () => {
    stubStaffApi({});
    render(<AdminPage />);

    expect(screen.getByRole("status")).toHaveTextContent(/Going to/);
    expect(screen.queryByRole("heading", { name: "Dashboard" })).toBeNull();
  });
});

describe("the stat cards", () => {
  async function openDashboard(overrides = {}) {
    loginAs("editor");
    stubStaffApi({ "/dashboard/stats": () => json(dashboardStats(overrides)) });
    render(<AdminPage />);
    await screen.findByRole("heading", { level: 1, name: "Dashboard" });
    await screen.findByText("Published");
  }

  it("show the five numbers as links to the screen that holds them, each at least 48 px high", async () => {
    await openDashboard();

    const cards = [
      ["Published", "140", "/admin/listings?status=published"],
      ["Pending review", "4", "/admin/listings?status=pending_review"],
      ["Due this week", "18", "/admin/recheck?tab=this_week"],
      ["Overdue", "2", "/admin/recheck?tab=overdue"],
      ["Open reports", "5", "/admin/reports"],
    ] as const;
    for (const [label, count, href] of cards) {
      const link = screen.getByRole("link", { name: new RegExp(`${label}`) });
      expect(link).toHaveAttribute("href", href);
      expect(link).toHaveTextContent(count);
      expect(link.className).toMatch(/min-h-12|min-h-\[50px\]|min-h-24/);
    }
  });

  it("say 'N urgent' in words and in red when a report is urgent", async () => {
    await openDashboard({ urgent_reports: 1 });

    const urgent = screen.getByText("1 urgent");
    expect(urgent.className).toMatch(/text-alert/); // red as text: lighter red in the dark mode
    expect(screen.getByRole("link", { name: /Open reports/ })).toContainElement(urgent);
  });

  it("do not mention urgent when none is", async () => {
    await openDashboard({ urgent_reports: 0 });

    expect(screen.queryByText(/urgent/)).toBeNull();
  });
});

describe("the checks chart", () => {
  async function openDashboard() {
    loginAs("admin");
    stubStaffApi({ "/dashboard/stats": stats });
    render(<AdminPage />);
    await screen.findByText("Checks in the last 30 days");
  }

  it("has a heading, a text description of the chart, and the same numbers as a table under 'Show the numbers'", async () => {
    await openDashboard();

    expect(screen.getByRole("heading", { level: 2, name: "Checks in the last 30 days" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /passed and failed per day/ })).toBeInTheDocument();
    const details = screen.getByText("Show the numbers").closest("details");
    expect(details).not.toBeNull();
    const rows = within(details as HTMLElement).getAllByRole("row");
    expect(rows).toHaveLength(31); // the header and 30 days
    expect(within(rows[0]).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Day", "Passed", "Failed"]);
  });

  it("names both series in words, so the colours are never the only difference", async () => {
    await openDashboard();

    const figure = screen.getByRole("img", { name: /passed and failed per day/ });
    expect(figure.closest("section")).toHaveTextContent("Passed");
    expect(figure.closest("section")).toHaveTextContent("Failed");
  });
});

describe("the states", () => {
  it("shows a skeleton, then 'waking up' after 5 seconds, then the error with Retry after 45", async () => {
    vi.useFakeTimers();
    loginAs("editor");
    stubStaffApi({ "/dashboard/stats": (_url, init) => neverAnswers(undefined, init?.signal ?? undefined) });
    render(<AdminPage />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByTestId("queue-status")).toHaveAttribute("aria-busy", "true");

    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });
    expect(screen.getByText("The service is waking up. This can take up to a minute.")).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(40_000);
    });

    expect(screen.getByText("We couldn't load this. Check your connection and try again.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("Retry asks again after an error", async () => {
    loginAs("editor");
    let attempts = 0;
    stubStaffApi({ "/dashboard/stats": () => (++attempts === 1 ? json({ detail: "x" }, 500) : json(dashboardStats())) });
    render(<AdminPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Published")).toBeInTheDocument();
  });

  it("an answer 401 logs the user out and goes to the login", async () => {
    loginAs("editor");
    stubStaffApi({ "/dashboard/stats": () => json({ detail: "Invalid or expired token" }, 401) });
    render(<AdminPage />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/log-in"));
  });
});

describe("the staff bar", () => {
  function barFor(role: StaffRole) {
    render(<StaffBar user={{ id: 1, name: "Ada", email: "a@b.co", phone: null, role, is_active: true }} onLogout={() => {}} />);
    return within(screen.getByRole("navigation", { name: "Staff" })).queryAllByRole("link").map((link) => link.textContent);
  }

  it("shows an editor the dashboard, reports, re-checks and listings", () => {
    // "Security" (the authenticator app, FR-58) is in every role's bar, last.
    expect(barFor("editor")).toEqual([
      "Dashboard", "Reports", "Re-checks", "Owner requests", "SwiftRescue contacts", "Listings", "Security",
      "Account",
    ]);
  });

  it("shows an admin the same, and also staff and import and export", () => {
    // Activity (the activity log) is for the admin only, accounts phase 4b.
    expect(barFor("admin")).toEqual([
      "Dashboard", "Reports", "Re-checks", "Owner requests", "SwiftRescue contacts", "Listings", "Staff",
      "Activity", "Import and export", "Security", "Account",
    ]);
  });

  it("shows a verifier listings only (and Security, which every role has)", () => {
    expect(barFor("verifier")).toEqual(["Listings", "Security", "Account"]);
  });

  it("links to the three new screens", () => {
    barFor("editor");

    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/admin");
    expect(screen.getByRole("link", { name: "Reports" })).toHaveAttribute("href", "/admin/reports");
    expect(screen.getByRole("link", { name: "Re-checks" })).toHaveAttribute("href", "/admin/recheck");
  });
});

describe("what is never done", () => {
  it("keeps nothing in local storage and writes nothing to the console", () => {
    for (const file of ["components/admin/Dashboard.tsx", "components/admin/CheckChart.tsx", "hooks/useDashboardStats.ts"]) {
      expect(readSource(file)).not.toMatch(/localStorage|console\./);
    }
  });
});
