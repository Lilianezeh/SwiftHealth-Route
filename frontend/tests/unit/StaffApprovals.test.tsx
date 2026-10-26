// @vitest-environment jsdom
/** The admin screens for approving staff sign-ups and managing accounts. Requirements: FR-49, FR-55, US-18, NFR-06, NFR-10.
 * UI spec 3.8 (accounts phase 4b); api-spec section 11, "Phase 4a". Admin only; every decision has a confirm step.
 * Every name, address and number here is fictional.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AdminStaffPage from "@/app/(dashboards)/admin/staff/page";
import { saveStaffSession } from "@/lib/staff/session";
import type { AdminUserRow, StaffRole } from "@/types/staff";

import { json } from "../helpers/api";

const replace = vi.fn();
const router = { replace, push: vi.fn() }; // one object: the gate's effect depends on it, so a new one on each render would loop
vi.mock("next/navigation", () => ({ useRouter: () => router }));

function row(id: number, role: StaffRole, overrides: Partial<AdminUserRow> = {}): AdminUserRow {
  return {
    id, name: `Person ${id}`, email: `person${id}@example.com`, phone: "+2348030000001", role, is_active: true,
    approval_status: "approved", last_login_at: null, created_at: "2026-10-01T09:00:00Z",
    email_verified_at: "2026-10-01T09:05:00Z", phone_verified_at: "2026-10-01T09:06:00Z", signup_note: null,
    ...overrides,
  };
}

const WAITING_ONE = row(10, "verifier", {
  name: "Bola Staff", email: "bola.staff@example.com", phone: "+2348030000456", approval_status: "pending",
  signup_note: "Verifier at the clinic in Ogui; Dr Eze can vouch for me.", created_at: "2026-10-20T10:30:00Z",
});
const WAITING_TWO = row(11, "verifier", {
  name: "Chidi Waiting", email: "chidi@example.com", approval_status: "pending", phone_verified_at: null,
});
const USERS = [
  row(1, "admin", { last_login_at: "2026-10-12T14:05:00Z" }),
  row(2, "editor"),
  row(3, "verifier", { is_active: false }),
  row(4, "provider", { approval_status: "approved" }),
  WAITING_ONE,
  WAITING_TWO,
  row(12, "verifier", { name: "Nobody Approved", approval_status: "rejected", is_active: true }),
];

type Call = { method: string; path: string; query: Record<string, string>; body: unknown };

/** A fake API that filters, pages and decides like the real one (api-spec section 11, "Phase 4a"). */
function stubApi(options: { users?: AdminUserRow[]; fail?: (call: Call) => Response | null } = {}) {
  const calls: Call[] = [];
  const users = (options.users ?? USERS).map((user) => ({ ...user }));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (address: string, init?: RequestInit) => {
      const url = new URL(address);
      const call: Call = {
        method: init?.method ?? "GET",
        path: url.pathname,
        query: Object.fromEntries(url.searchParams),
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      };
      calls.push(call);
      const failure = options.fail?.(call);
      if (failure) return failure;
      if (call.method === "GET" && call.path === "/admin/users") {
        let list = users;
        if (call.query.role) list = list.filter((user) => user.role === call.query.role);
        if (call.query.approval_status) list = list.filter((user) => user.approval_status === call.query.approval_status);
        if (call.query.is_active) list = list.filter((user) => String(user.is_active) === call.query.is_active);
        if (call.query.q) list = list.filter((user) => `${user.name} ${user.email}`.toLowerCase().includes(call.query.q.toLowerCase()));
        const offset = Number(call.query.offset ?? 0);
        const limit = Number(call.query.limit ?? 100);
        return json({ items: list.slice(offset, offset + limit), total: list.length });
      }
      const decision = /^\/admin\/users\/(\d+)\/(approve|reject|suspend|reactivate|confirm-phone-by-call)$/.exec(call.path);
      if (call.method === "POST" && decision) {
        const user = users.find((candidate) => candidate.id === Number(decision[1]));
        if (!user) return json({ detail: "User not found" }, 404);
        if (decision[2] === "approve") Object.assign(user, { approval_status: "approved", role: (call.body as { role: StaffRole }).role });
        if (decision[2] === "reject") user.approval_status = "rejected";
        if (decision[2] === "suspend") user.is_active = false;
        if (decision[2] === "reactivate") user.is_active = true;
        if (decision[2] === "confirm-phone-by-call") {
          user.phone_verified_at = "2026-10-26T10:00:00Z";
          return json({ phone_confirmed: true });
        }
        return json(user);
      }
      return json({ detail: "Not found" }, 404);
    }),
  );
  return { calls, decisions: () => calls.filter((call) => call.method === "POST") };
}

beforeEach(() => {
  window.sessionStorage.clear();
  replace.mockReset();
  saveStaffSession({ token: "tok", user: row(1, "admin") });
});
afterEach(() => vi.unstubAllGlobals());

async function openWaitingTab() {
  render(<AdminStaffPage />);
  await userEvent.click(await screen.findByRole("tab", { name: /^Waiting for approval/ }));
}

describe("the two tabs", () => {
  it("has Waiting for approval with the number of people waiting, and All accounts, which is the one open at first", async () => {
    stubApi();
    render(<AdminStaffPage />);

    const waiting = await screen.findByRole("tab", { name: "Waiting for approval (2)" });
    const all = screen.getByRole("tab", { name: "All accounts" });

    expect(all).toHaveAttribute("aria-selected", "true");
    expect(waiting).toHaveAttribute("aria-selected", "false");
    expect(within(screen.getByRole("tablist")).getAllByRole("tab")).toHaveLength(2);
    expect(waiting.className).toMatch(/min-h-12/);
  });

  it("says in words that people are waiting, and says nothing when nobody is", async () => {
    stubApi();
    const { unmount } = render(<AdminStaffPage />);
    expect(await screen.findByText("2 people are waiting for approval.")).toBeInTheDocument();
    unmount();

    stubApi({ users: USERS.filter((user) => user.approval_status !== "pending") });
    render(<AdminStaffPage />);
    await screen.findByRole("tab", { name: "Waiting for approval (0)" });
    expect(screen.queryByText(/waiting for approval\.$/)).not.toBeInTheDocument();
  });

  it("says 1 person is waiting in the singular", async () => {
    stubApi({ users: USERS.filter((user) => user.id !== WAITING_TWO.id) });
    render(<AdminStaffPage />);

    expect(await screen.findByText("1 person is waiting for approval.")).toBeInTheDocument();
  });

  it("switches with the keyboard-reachable tabs", async () => {
    stubApi();
    await openWaitingTab();

    expect(screen.getByRole("tab", { name: /^Waiting for approval/ })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByText("Bola Staff")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "All accounts" }));
    expect(await screen.findByText("Person 2")).toBeInTheDocument();
  });
});

describe("Waiting for approval", () => {
  it("shows one card per waiting account with what the admin needs to decide, and no one else", async () => {
    const { calls } = stubApi();
    await openWaitingTab();

    const cards = await screen.findAllByRole("listitem");

    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText("Bola Staff")).toBeInTheDocument();
    expect(within(cards[0]).getByText("bola.staff@example.com")).toBeInTheDocument();
    expect(within(cards[0]).getByText("0803 000 0456")).toBeInTheDocument(); // reading form, never +234
    expect(within(cards[0]).getByText(/Signed up 20 Oct 2026/)).toBeInTheDocument();
    expect(within(cards[0]).getByText("Verifier at the clinic in Ogui; Dr Eze can vouch for me.")).toBeInTheDocument();
    expect(within(cards[0]).getByText("Email confirmed")).toBeInTheDocument();
    expect(within(cards[0]).getByText("Phone confirmed")).toBeInTheDocument();
    expect(calls.some((call) => call.query.approval_status === "pending")).toBe(true);
  });

  it("says when they wrote nothing about themselves", async () => {
    stubApi();
    await openWaitingTab();

    const second = (await screen.findAllByRole("listitem"))[1];

    expect(within(second).getByText("They wrote nothing.")).toBeInTheDocument();
  });

  it("says Nobody is waiting for approval when the list is empty", async () => {
    stubApi({ users: USERS.filter((user) => user.approval_status !== "pending") });
    await openWaitingTab();

    expect(await screen.findByText("Nobody is waiting for approval.")).toBeInTheDocument();
  });

  it("offers only Editor and Verifier to approve as, Verifier first, never Admin or Provider", async () => {
    stubApi();
    await openWaitingTab();

    const choice = await screen.findByLabelText("Role for Bola Staff");

    expect(within(choice).getAllByRole("option").map((option) => option.getAttribute("value"))).toEqual(["verifier", "editor"]);
    expect(choice).toHaveValue("verifier");
    expect(choice.className).toMatch(/min-h-12/);
  });

  it("asks before it approves, and Cancel changes nothing", async () => {
    const { decisions } = stubApi();
    await openWaitingTab();
    await screen.findByText("Bola Staff");
    await userEvent.selectOptions(screen.getByLabelText("Role for Bola Staff"), "editor");

    await userEvent.click(screen.getByRole("button", { name: "Approve Bola Staff" }));

    expect(screen.getByText("Approve Bola Staff as an editor?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Approve Bola Staff as an editor?")).not.toBeInTheDocument();
    expect(decisions()).toEqual([]);
  });

  it("approves with the chosen role, takes the card out of the list and says what happened", async () => {
    const { decisions } = stubApi();
    await openWaitingTab();
    await screen.findByText("Bola Staff");
    await userEvent.selectOptions(screen.getByLabelText("Role for Bola Staff"), "editor");
    await userEvent.click(screen.getByRole("button", { name: "Approve Bola Staff" }));

    await userEvent.click(screen.getByRole("button", { name: "Yes, approve" }));

    expect(await screen.findByText("Bola Staff was approved as an editor.")).toBeInTheDocument();
    expect(decisions()).toEqual([{ method: "POST", path: "/admin/users/10/approve", query: {}, body: { role: "editor" } }]);
    expect(screen.queryByRole("button", { name: "Approve Bola Staff" })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Waiting for approval (1)" })).toBeInTheDocument();
  });

  it("will not approve while the phone is not confirmed, says why, and shows how to confirm it", async () => {
    stubApi();
    await openWaitingTab();
    await screen.findByText("Chidi Waiting");

    const approve = screen.getByRole("button", { name: "Approve Chidi Waiting" });

    expect(approve).toBeDisabled();
    expect(screen.getByText("Phone not confirmed")).toBeInTheDocument();
    expect(screen.getByText("Phone them on 0803 000 0001, then press the button below.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Phone confirmed by call/ })).toBeInTheDocument();
  });

  it("records the call after a confirm step, and then the account can be approved", async () => {
    const { decisions } = stubApi();
    await openWaitingTab();
    await screen.findByText("Chidi Waiting");

    await userEvent.click(screen.getByRole("button", { name: /^Phone confirmed by call/ }));
    expect(screen.getByText("Did you phone Chidi Waiting and hear them confirm this number?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Yes, I phoned them" }));

    const card = screen.getByText("Chidi Waiting").closest("li") as HTMLElement;
    await waitFor(() => expect(within(card).getByText("Phone confirmed")).toBeInTheDocument());
    expect(decisions()).toEqual([
      { method: "POST", path: "/admin/users/11/confirm-phone-by-call", query: {}, body: undefined },
    ]);
    expect(screen.getByRole("button", { name: "Approve Chidi Waiting" })).toBeEnabled();
    expect(screen.queryByText(/Phone them on/)).not.toBeInTheDocument();
  });

  it("will not approve while the email is not confirmed, and says so", async () => {
    stubApi({ users: [row(1, "admin"), { ...WAITING_ONE, email_verified_at: null }] });
    await openWaitingTab();
    await screen.findByText("Bola Staff");

    expect(screen.getByRole("button", { name: "Approve Bola Staff" })).toBeDisabled();
    expect(screen.getByText("Their email is not confirmed yet.")).toBeInTheDocument();
    expect(screen.getByText("Email not confirmed yet")).toBeInTheDocument();
  });

  it("rejects after a confirm step, with the reason when one is written, and takes the card out", async () => {
    const { decisions } = stubApi();
    await openWaitingTab();
    await screen.findByText("Bola Staff");
    await userEvent.type(screen.getByLabelText("Reason for rejecting Bola Staff (optional)"), "We do not know this clinic.");

    await userEvent.click(screen.getByRole("button", { name: "Reject Bola Staff" }));
    expect(screen.getByText("Reject Bola Staff?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Yes, reject" }));

    expect(await screen.findByText("Bola Staff was rejected.")).toBeInTheDocument();
    expect(decisions()).toEqual([
      { method: "POST", path: "/admin/users/10/reject", query: {}, body: { reason: "We do not know this clinic." } },
    ]);
    expect(screen.getByRole("tab", { name: "Waiting for approval (1)" })).toBeInTheDocument();
  });

  it("rejects without a reason with an empty body", async () => {
    const { decisions } = stubApi();
    await openWaitingTab();
    await screen.findByText("Bola Staff");

    await userEvent.click(screen.getByRole("button", { name: "Reject Bola Staff" }));
    await userEvent.click(screen.getByRole("button", { name: "Yes, reject" }));

    await screen.findByText("Bola Staff was rejected.");
    expect(decisions()[0].body).toEqual({});
  });

  it("limits the reason to 500 characters", async () => {
    stubApi();
    await openWaitingTab();
    await screen.findByText("Bola Staff");

    expect(screen.getByLabelText("Reason for rejecting Bola Staff (optional)")).toHaveAttribute("maxlength", "500");
  });

  it("shows the API's own sentence when a decision is refused, and keeps the card", async () => {
    stubApi({
      fail: (call) =>
        call.path.endsWith("/approve") ? json({ detail: "This account is not waiting for approval." }, 409) : null,
    });
    await openWaitingTab();
    await screen.findByText("Bola Staff");
    await userEvent.click(screen.getByRole("button", { name: "Approve Bola Staff" }));

    await userEvent.click(screen.getByRole("button", { name: "Yes, approve" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("This account is not waiting for approval.");
    expect(screen.getByText("Bola Staff")).toBeInTheDocument();
  });

  it("says plain words when the network fails", async () => {
    stubApi();
    await openWaitingTab();
    await screen.findByText("Bola Staff");
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("offline"))));
    await userEvent.click(screen.getByRole("button", { name: "Reject Bola Staff" }));

    await userEvent.click(screen.getByRole("button", { name: "Yes, reject" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't do that. Check your connection and try again.");
  });

  it("does not send a decision twice while it waits", async () => {
    let release: (response: Response) => void = () => undefined;
    const sent: string[] = [];
    stubApi();
    await openWaitingTab();
    await screen.findByText("Bola Staff");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (address: string) => {
        sent.push(new URL(address).pathname);
        return new Promise<Response>((resolve) => (release = resolve));
      }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Approve Bola Staff" }));
    await userEvent.click(screen.getByRole("button", { name: "Yes, approve" }));

    expect(screen.getByRole("button", { name: /^Approving/ })).toBeDisabled();
    release(json(row(10, "verifier", { approval_status: "approved" })));
    await waitFor(() => expect(sent).toEqual(["/admin/users/10/approve"]));
  });
});

describe("All accounts: the state and the last login in words", () => {
  it("says the state of every account and when each last logged in, in Lagos time", async () => {
    stubApi();
    render(<AdminStaffPage />);

    const cards = await screen.findAllByRole("listitem");

    expect(within(cards[0]).getByText(/Last login: 12 Oct 2026, 15:05/)).toBeInTheDocument();
    expect(within(cards[1]).getByText("Has not logged in yet")).toBeInTheDocument();
    expect(within(cards[0]).getByText("Admin · Active")).toBeInTheDocument();
    expect(within(cards[2]).getByText("Verifier · Suspended")).toBeInTheDocument();
    expect(within(cards[4]).getByText("Verifier · Waiting for approval")).toBeInTheDocument();
    expect(within(cards[6]).getByText("Verifier · Not approved")).toBeInTheDocument();
  });

  it("sends a waiting account to the other tab and offers no decision on it here", async () => {
    stubApi();
    render(<AdminStaffPage />);

    const cards = await screen.findAllByRole("listitem");

    expect(within(cards[4]).getByText("Decide on it under Waiting for approval.")).toBeInTheDocument();
    const decision = /^(Suspend|Reactivate|Approve|Reject) /;
    expect(within(cards[4]).queryByRole("button", { name: decision })).not.toBeInTheDocument();
    expect(within(cards[6]).queryByRole("button", { name: decision })).not.toBeInTheDocument();
  });

  it("works with an older answer that has none of the new fields", async () => {
    stubApi({ users: [{ id: 1, name: "Old Admin", email: "o@example.com", phone: null, role: "admin", is_active: true } as AdminUserRow] });
    render(<AdminStaffPage />);

    const [card] = await screen.findAllByRole("listitem");

    expect(within(card).getByText("Has not logged in yet")).toBeInTheDocument();
  });
});

describe("All accounts: filters and pages", () => {
  async function ready() {
    render(<AdminStaffPage />);
    await screen.findAllByRole("listitem");
  }
  // The list of the tab (50 a page); the call that counts the waiting accounts asks for 200 and is left out.
  const lastUsersCall = (calls: Call[]) =>
    calls.filter((call) => call.method === "GET" && call.path === "/admin/users" && call.query.limit === "50").at(-1) as Call;

  it("asks the API again for a role", async () => {
    const { calls } = stubApi();
    await ready();

    await userEvent.selectOptions(screen.getByLabelText("Filter by role"), "editor");

    await waitFor(() => expect(lastUsersCall(calls).query.role).toBe("editor"));
    expect(await screen.findAllByRole("listitem")).toHaveLength(1);
  });

  it.each([
    ["Active", { is_active: "true" }],
    ["Suspended", { is_active: "false" }],
    ["Waiting for approval", { approval_status: "pending" }],
    ["Not approved", { approval_status: "rejected" }],
  ])("asks the API again for the state %s", async (state, expected) => {
    const { calls } = stubApi();
    await ready();

    await userEvent.selectOptions(screen.getByLabelText("Filter by state"), state);

    await waitFor(() => expect(lastUsersCall(calls).query).toMatchObject(expected));
  });

  it("goes back to everyone with Any", async () => {
    const { calls } = stubApi();
    await ready();
    await userEvent.selectOptions(screen.getByLabelText("Filter by state"), "Suspended");
    await waitFor(() => expect(lastUsersCall(calls).query.is_active).toBe("false"));

    await userEvent.selectOptions(screen.getByLabelText("Filter by state"), "Any");

    await waitFor(() => expect(lastUsersCall(calls).query.is_active).toBeUndefined());
  });

  it("searches by name or email when Search is pressed", async () => {
    const { calls } = stubApi();
    await ready();

    await userEvent.type(screen.getByLabelText("Search"), "bola");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => expect(lastUsersCall(calls).query.q).toBe("bola"));
    expect(await screen.findAllByRole("listitem")).toHaveLength(1);
  });

  it("pages 50 at a time, with Previous and Next and where you are", async () => {
    const many = Array.from({ length: 120 }, (_, index) => row(100 + index, "verifier", { name: `Many ${index + 1}` }));
    const { calls } = stubApi({ users: [row(1, "admin"), ...many] });
    await ready();

    expect(screen.getByText("Showing 1 to 50 of 121")).toBeInTheDocument();
    expect(lastUsersCall(calls).query).toMatchObject({ limit: "50" });
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Showing 51 to 100 of 121")).toBeInTheDocument();
    expect(lastUsersCall(calls).query.offset).toBe("50");
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Showing 101 to 121 of 121")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(await screen.findByText("Showing 51 to 100 of 121")).toBeInTheDocument();
  });

  it("goes back to the first page when a filter changes", async () => {
    const many = Array.from({ length: 120 }, (_, index) => row(100 + index, "editor", { name: `Many ${index + 1}` }));
    const { calls } = stubApi({ users: [row(1, "admin"), ...many] });
    await ready();
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Showing 51 to 100 of 121");

    await userEvent.selectOptions(screen.getByLabelText("Filter by role"), "editor");

    await waitFor(() => expect(lastUsersCall(calls).query.offset).toBeUndefined());
    expect(await screen.findByText("Showing 1 to 50 of 120")).toBeInTheDocument();
  });

  it("says when nothing matches", async () => {
    stubApi();
    await ready();

    await userEvent.type(screen.getByLabelText("Search"), "zzzzz");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(await screen.findByText("No accounts match these filters.")).toBeInTheDocument();
  });

  it("makes the filters and the page buttons at least 48 px", async () => {
    stubApi();
    await ready();

    for (const control of [screen.getByLabelText("Filter by role"), screen.getByLabelText("Filter by state"), screen.getByLabelText("Search")]) {
      expect(control.className).toMatch(/min-h-12/);
    }
    for (const name of ["Search", "Previous", "Next"]) expect(screen.getByRole("button", { name }).className).toMatch(/min-h-\[50px\]/);
  });
});

describe("All accounts: suspend and reactivate", () => {
  it("offers Suspend on an active, approved account that is not your own, and nothing on yours", async () => {
    stubApi();
    render(<AdminStaffPage />);

    const cards = await screen.findAllByRole("listitem");

    expect(within(cards[0]).queryByRole("button", { name: /^Suspend/ })).not.toBeInTheDocument(); // me
    expect(within(cards[1]).getByRole("button", { name: "Suspend Person 2" })).toBeInTheDocument();
    expect(within(cards[2]).getByRole("button", { name: "Reactivate Person 3" })).toBeInTheDocument();
    expect(within(cards[2]).queryByRole("button", { name: /^Suspend/ })).not.toBeInTheDocument();
  });

  it("needs a reason, asks before it suspends, and then offers Reactivate", async () => {
    const { decisions } = stubApi();
    render(<AdminStaffPage />);
    await screen.findAllByRole("listitem");

    await userEvent.click(screen.getByRole("button", { name: "Suspend Person 2" }));
    await userEvent.click(screen.getByRole("button", { name: "Yes, suspend" }));
    expect(screen.getByText("Say why you are suspending this account.")).toBeInTheDocument();
    expect(decisions()).toEqual([]);
    await userEvent.type(screen.getByLabelText("Reason for suspending Person 2"), "Left the team.");
    await userEvent.click(screen.getByRole("button", { name: "Yes, suspend" }));

    expect(await screen.findByText("Person 2 was suspended.")).toBeInTheDocument();
    expect(decisions()).toEqual([
      { method: "POST", path: "/admin/users/2/suspend", query: {}, body: { reason: "Left the team." } },
    ]);
    expect(screen.getByRole("button", { name: "Reactivate Person 2" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Suspend Person 2" })).not.toBeInTheDocument();
  });

  it("Cancel closes the suspend question and sends nothing", async () => {
    const { decisions } = stubApi();
    render(<AdminStaffPage />);
    await screen.findAllByRole("listitem");

    await userEvent.click(screen.getByRole("button", { name: "Suspend Person 2" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByLabelText("Reason for suspending Person 2")).not.toBeInTheDocument();
    expect(decisions()).toEqual([]);
  });

  it("reactivates after a confirm step", async () => {
    const { decisions } = stubApi();
    render(<AdminStaffPage />);
    await screen.findAllByRole("listitem");

    await userEvent.click(screen.getByRole("button", { name: "Reactivate Person 3" }));
    expect(screen.getByText("Reactivate Person 3?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Yes, reactivate" }));

    expect(await screen.findByText("Person 3 was reactivated.")).toBeInTheDocument();
    expect(decisions()).toEqual([{ method: "POST", path: "/admin/users/3/reactivate", query: {}, body: undefined }]);
    expect(screen.getByRole("button", { name: "Suspend Person 3" })).toBeInTheDocument();
  });

  it("shows the API's sentence when the last admin cannot be suspended", async () => {
    stubApi({ fail: (call) => (call.path.endsWith("/suspend") ? json({ detail: "This is the last active admin." }, 409) : null) });
    render(<AdminStaffPage />);
    await screen.findAllByRole("listitem");
    await userEvent.click(screen.getByRole("button", { name: "Suspend Person 2" }));
    await userEvent.type(screen.getByLabelText("Reason for suspending Person 2"), "x");

    await userEvent.click(screen.getByRole("button", { name: "Yes, suspend" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("This is the last active admin.");
  });

  it("has no button anywhere that deletes an account", async () => {
    stubApi();
    await openWaitingTab();
    await screen.findByText("Bola Staff");
    expect(screen.queryByRole("button", { name: /delete|remove/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "All accounts" }));
    await screen.findByText("Person 2");

    expect(screen.queryByRole("button", { name: /delete|remove/i })).not.toBeInTheDocument();
  });
});

describe("who may open it", () => {
  it.each<StaffRole>(["editor", "verifier", "provider"])("a %s is turned away and nothing is asked of the API", async (role) => {
    window.sessionStorage.clear();
    saveStaffSession({ token: "tok", user: row(5, role) });
    const { calls } = stubApi();
    render(<AdminStaffPage />);

    expect(await screen.findByText("Your role cannot open this page.")).toBeInTheDocument();
    expect(calls).toEqual([]);
  });
});
