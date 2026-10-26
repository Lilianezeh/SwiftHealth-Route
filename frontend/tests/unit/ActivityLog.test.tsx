// @vitest-environment jsdom
/** The activity log screen (admin only). Requirements: FR-55, FR-38, US-18, NFR-10. UI spec 3.8b (accounts phase 4b);
 * api-spec section 11, "Phase 4a", `GET /admin/activity`. Every name and value here is fictional.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ActivityPage from "@/app/(dashboards)/admin/activity/page";
import { saveStaffSession } from "@/lib/staff/session";
import type { ActivityItem, StaffRole } from "@/types/staff";

import { json } from "../helpers/api";

const replace = vi.fn();
const router = { replace, push: vi.fn() }; // one object: the gate's effect depends on it
vi.mock("next/navigation", () => ({ useRouter: () => router }));

function entry(id: number, overrides: Partial<ActivityItem> = {}): ActivityItem {
  return {
    id, at: "2026-10-12T14:05:00Z", user_id: 1, user_name: "Ada Admin", action: "user_approve", listing_id: null,
    listing_name: null, target_user_id: 10, target_user_name: "Bola Staff", field_changed: "approval_status",
    old_value: "pending", new_value: "approved", ...overrides,
  };
}

const PEOPLE = [
  { id: 1, name: "Ada Admin", email: "ada@example.com", phone: null, role: "admin", is_active: true },
  { id: 2, name: "Eze Editor", email: "eze@example.com", phone: null, role: "editor", is_active: true },
];

type Call = { path: string; query: Record<string, string> };

function stubApi(options: { entries?: ActivityItem[]; total?: number; fail?: boolean } = {}) {
  const calls: Call[] = [];
  const entries = options.entries ?? [entry(1)];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (address: string) => {
      const url = new URL(address);
      calls.push({ path: url.pathname, query: Object.fromEntries(url.searchParams) });
      if (url.pathname === "/admin/users") return json({ items: PEOPLE, total: 2 });
      if (url.pathname === "/admin/activity") {
        if (options.fail) return json({ detail: "boom" }, 500);
        return json({ items: entries, total: options.total ?? entries.length });
      }
      return json({ detail: "Not found" }, 404);
    }),
  );
  return { calls, activityCalls: () => calls.filter((call) => call.path === "/admin/activity") };
}

function loginAs(role: StaffRole) {
  saveStaffSession({ token: "tok", user: { id: 1, name: "Ada Admin", email: "ada@example.com", phone: null, role, is_active: true } });
}

beforeEach(() => {
  window.sessionStorage.clear();
  replace.mockReset();
  loginAs("admin");
});
afterEach(() => vi.unstubAllGlobals());

describe("the entries", () => {
  it("says each one in a sentence a person can read, with the time in Lagos, the account and the change", async () => {
    stubApi();
    render(<ActivityPage />);

    const [card] = await screen.findAllByRole("listitem");

    expect(within(card).getByText("Ada Admin approved an account")).toBeInTheDocument();
    expect(within(card).getByText("12 Oct 2026, 15:05")).toBeInTheDocument();
    expect(within(card).getByText("About: Bola Staff")).toBeInTheDocument();
    expect(within(card).getByText("approval_status: pending → approved")).toBeInTheDocument();
  });

  it("names the listing when the entry is about a listing, and leaves out a missing old value", async () => {
    stubApi({
      entries: [entry(2, { action: "update", listing_id: 5, listing_name: "Night Pharmacy A", target_user_id: null, target_user_name: null, field_changed: "phone", old_value: null, new_value: "changed" })],
    });
    render(<ActivityPage />);

    const [card] = await screen.findAllByRole("listitem");

    expect(within(card).getByText("Ada Admin changed a listing")).toBeInTheDocument();
    expect(within(card).getByText("Listing: Night Pharmacy A")).toBeInTheDocument();
    expect(within(card).getByText("phone: changed")).toBeInTheDocument();
    expect(within(card).queryByText(/About:/)).not.toBeInTheDocument();
  });

  it("calls an entry with no person The system, and shows an unknown action as words", async () => {
    stubApi({ entries: [entry(3, { user_id: null, user_name: null, action: "recheck_due_moved", target_user_id: null, target_user_name: null, field_changed: null, old_value: null, new_value: null })] });
    render(<ActivityPage />);

    const [card] = await screen.findAllByRole("listitem");

    expect(within(card).getByText("The system recheck due moved")).toBeInTheDocument();
    expect(card.textContent).not.toMatch(/null|undefined/);
  });

  it("says the words of the account actions", async () => {
    stubApi({
      entries: [
        entry(1, { action: "user_reject" }),
        entry(2, { action: "user_suspend" }),
        entry(3, { action: "user_reactivate" }),
        entry(4, { action: "phone_confirmed_by_call" }),
      ],
    });
    render(<ActivityPage />);

    await screen.findAllByRole("listitem");

    for (const words of ["rejected an account", "suspended an account", "reactivated an account", "recorded a phone call that confirmed a phone"]) {
      expect(screen.getByText(`Ada Admin ${words}`)).toBeInTheDocument();
    }
  });

  it("says Nothing matches these filters when the log is empty", async () => {
    stubApi({ entries: [] });
    render(<ActivityPage />);

    expect(await screen.findByText("Nothing matches these filters.")).toBeInTheDocument();
  });

  it("shows the error with Retry when the log cannot be loaded", async () => {
    let attempts = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (address: string) => {
        if (new URL(address).pathname === "/admin/users") return json({ items: PEOPLE, total: 2 });
        return ++attempts === 1 ? json({ detail: "boom" }, 500) : json({ items: [entry(1)], total: 1 });
      }),
    );
    render(<ActivityPage />);

    expect(await screen.findByText("We couldn't load this. Check your connection and try again.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findAllByRole("listitem")).toHaveLength(1);
  });
});

describe("the filters", () => {
  it("asks for the first page of 50 with no filter, and sends the token", async () => {
    const { activityCalls } = stubApi();
    render(<ActivityPage />);
    await screen.findAllByRole("listitem");

    expect(activityCalls()[0].query).toEqual({ limit: "50" });
    expect(vi.mocked(fetch).mock.calls.every(([, init]) => (init?.headers as Record<string, string>).Authorization === "Bearer tok")).toBe(true);
  });

  it("offers Everyone and every account in Person, and asks again for one person", async () => {
    const { activityCalls } = stubApi();
    render(<ActivityPage />);
    await screen.findAllByRole("listitem");
    const person = screen.getByLabelText("Person");
    await waitFor(() => expect(within(person).getAllByRole("option")).toHaveLength(3));

    expect(within(person).getAllByRole("option").map((option) => option.textContent)).toEqual(["Everyone", "Ada Admin", "Eze Editor"]);
    await userEvent.selectOptions(person, "Eze Editor");

    await waitFor(() => expect(activityCalls().at(-1)?.query.user_id).toBe("2"));
  });

  it("asks again for one kind of action, with the code the API wants", async () => {
    const { activityCalls } = stubApi();
    render(<ActivityPage />);
    await screen.findAllByRole("listitem");

    await userEvent.selectOptions(screen.getByLabelText("What happened"), "Account suspended");

    await waitFor(() => expect(activityCalls().at(-1)?.query.action).toBe("user_suspend"));
  });

  it("asks again for the days, both ends", async () => {
    const { activityCalls } = stubApi();
    render(<ActivityPage />);
    await screen.findAllByRole("listitem");

    await userEvent.type(screen.getByLabelText("From"), "2026-10-01");
    await userEvent.type(screen.getByLabelText("To"), "2026-10-26");

    await waitFor(() => expect(activityCalls().at(-1)?.query).toMatchObject({ from: "2026-10-01", to: "2026-10-26" }));
  });

  it("goes back to the first page when a filter changes", async () => {
    const many = Array.from({ length: 50 }, (_, index) => entry(index + 1));
    const { activityCalls } = stubApi({ entries: many, total: 120 });
    render(<ActivityPage />);
    await screen.findByText("Showing 1 to 50 of 120");
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(activityCalls().at(-1)?.query.offset).toBe("50"));

    await userEvent.selectOptions(screen.getByLabelText("What happened"), "Account approved");

    await waitFor(() => expect(activityCalls().at(-1)?.query.offset).toBeUndefined());
  });

  it("makes every filter and button at least 48 px", async () => {
    stubApi();
    render(<ActivityPage />);
    await screen.findAllByRole("listitem");

    for (const label of ["Person", "What happened", "From", "To"]) {
      expect(screen.getByLabelText(label).className, label).toMatch(/min-h-12/);
    }
    for (const name of ["Previous", "Next"]) expect(screen.getByRole("button", { name }).className).toMatch(/min-h-\[50px\]/);
  });
});

describe("pages", () => {
  it("says where you are and moves with Previous and Next", async () => {
    const many = Array.from({ length: 50 }, (_, index) => entry(index + 1));
    const { activityCalls } = stubApi({ entries: many, total: 120 });
    render(<ActivityPage />);

    expect(await screen.findByText("Showing 1 to 50 of 120")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => expect(activityCalls().at(-1)?.query).toMatchObject({ limit: "50", offset: "50" }));
    expect(await screen.findByText("Showing 51 to 100 of 120")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Previous" }));
    await waitFor(() => expect(activityCalls().at(-1)?.query.offset).toBeUndefined());
  });

  it("switches Next off on the last page", async () => {
    stubApi({ entries: [entry(1), entry(2)], total: 2 });
    render(<ActivityPage />);

    expect(await screen.findByText("Showing 1 to 2 of 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });
});

describe("who may open it", () => {
  it.each<StaffRole>(["editor", "verifier", "provider"])("a %s is turned away and the log is not asked for", async (role) => {
    window.sessionStorage.clear();
    loginAs(role);
    const { calls } = stubApi();
    render(<ActivityPage />);

    expect(await screen.findByText("Your role cannot open this page.")).toBeInTheDocument();
    expect(calls.filter((call) => call.path === "/admin/activity")).toEqual([]);
    expect(screen.queryByRole("link", { name: "Activity" })).not.toBeInTheDocument();
  });

  it("a visitor with no session goes to the login", async () => {
    window.sessionStorage.clear();
    stubApi();
    render(<ActivityPage />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/log-in"));
  });

  it("the admin's staff bar has the Activity link", async () => {
    stubApi();
    render(<ActivityPage />);
    await screen.findAllByRole("listitem");

    expect(within(screen.getByRole("navigation", { name: "Staff" })).getByRole("link", { name: "Activity" })).toHaveAttribute("href", "/admin/activity");
  });
});
