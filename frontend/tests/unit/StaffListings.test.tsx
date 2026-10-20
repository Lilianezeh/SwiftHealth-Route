// @vitest-environment jsdom
/** The staff listings screen. Requirements: FR-31, FR-42, NFR-06, NFR-10. UI spec 3.3 and "Phase 10 details" (cards that become a
 * two-column grid from 768 px, decision C14). The screen reads listings of every status with the staff token.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AdminListingsPage from "@/app/(dashboards)/admin/listings/page";
import { resetMetaCache } from "@/lib/api/meta";
import { saveStaffSession } from "@/lib/staff/session";
import type { ListingStatus, StaffListingSummary, StaffRole } from "@/types/staff";

import { META, json, listing } from "../helpers/api";

const replace = vi.fn();
const router = { replace, push: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

function staffItem(id: number, status: ListingStatus, overrides: Partial<StaffListingSummary> = {}): StaffListingSummary {
  return {
    ...listing({ id, slug: `place-${id}`, name: `Place ${id}` }),
    status,
    next_check_due: "2026-11-20T09:00:00Z",
    created_by: 3,
    ...overrides,
  };
}

function loginAs(role: StaffRole) {
  saveStaffSession({ token: "tok", user: { id: 3, name: "Ada Staff", email: "a@b.co", phone: null, role, is_active: true } });
}

function stubStaffApi(handler: (params: URLSearchParams) => Response = () => json({ items: [], total: 0 })) {
  const requests: { url: URL; headers: Record<string, string> }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (address: string, init?: RequestInit) => {
      const url = new URL(address);
      requests.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
      if (url.pathname === "/meta") return json(META);
      if (url.pathname === "/listings") return handler(url.searchParams);
      return json({ detail: "Not found" }, 404);
    }),
  );
  return { requests, lists: () => requests.filter((request) => request.url.pathname === "/listings") };
}

async function openPage(search: { mine?: string; status?: string } = {}) {
  render(await AdminListingsPage({ searchParams: Promise.resolve(search) }));
}

beforeEach(() => {
  window.sessionStorage.clear();
  resetMetaCache();
  replace.mockReset();
  loginAs("editor");
});
afterEach(() => vi.unstubAllGlobals());

describe("the staff listings screen", () => {
  it("asks for the listings with the token in the header and nothing in the address", async () => {
    const { lists } = stubStaffApi();
    await openPage();

    await screen.findByText("No listings match.");

    expect(lists()[0].headers.Authorization).toBe("Bearer tok");
    expect(lists()[0].url.href).not.toContain("tok");
    expect(Object.fromEntries(lists()[0].url.searchParams)).toEqual({ limit: "20", offset: "0" });
  });

  it("shows each listing with its status in words, its category and area, and the next check date", async () => {
    stubStaffApi(() =>
      json({
        items: [staffItem(1, "draft"), staffItem(2, "pending_review"), staffItem(3, "published"), staffItem(4, "recheck_due"), staffItem(5, "hidden")],
        total: 5,
      }),
    );
    await openPage();

    const cards = await screen.findAllByRole("article");

    expect(cards).toHaveLength(5);
    for (const [index, words] of ["Draft", "Pending review", "Published", "Re-check due", "Hidden"].entries()) {
      expect(within(cards[index]).getByText(words)).toBeInTheDocument();
    }
    expect(within(cards[0]).getByRole("link", { name: "Place 1" })).toHaveAttribute("href", "/admin/listings/1");
    expect(cards[0]).toHaveTextContent("Pharmacy");
    expect(cards[0]).toHaveTextContent("New Haven");
    expect(cards[0]).toHaveTextContent("Next check 20 Nov 2026");
  });

  it("says 'No next check' for a listing with no date", async () => {
    stubStaffApi(() => json({ items: [staffItem(1, "draft", { next_check_due: null })], total: 1 }));
    await openPage();

    expect(await screen.findByText("No next check")).toBeInTheDocument();
  });

  it("has a New listing button to /admin/listings/new, at least 48 px high", async () => {
    stubStaffApi();
    await openPage();

    const button = await screen.findByRole("link", { name: "New listing" });
    expect(button).toHaveAttribute("href", "/admin/listings/new");
    expect(button.className).toMatch(/min-h-\[50px\]/);
  });

  it("starts with 'Only mine' ticked when the address says mine=true (where a verifier starts)", async () => {
    loginAs("verifier");
    const { lists } = stubStaffApi();
    await openPage({ mine: "true" });

    await screen.findByText("No listings match.");

    expect(screen.getByRole("checkbox", { name: "Only mine" })).toBeChecked();
    expect(lists()[0].url.searchParams.get("mine")).toBe("true");
  });

  it("starts with the status of the address (where the dashboard cards lead) and ignores a status that does not exist", async () => {
    const { lists } = stubStaffApi();
    await openPage({ status: "pending_review" });
    await screen.findByText("No listings match.");

    expect(screen.getByLabelText("Status")).toHaveValue("pending_review");
    expect(lists()[0].url.searchParams.get("status")).toBe("pending_review");
  });

  it("asks for every status when the address names one that does not exist", async () => {
    const { lists } = stubStaffApi();
    await openPage({ status: "nonsense" });
    await screen.findByText("No listings match.");

    expect(screen.getByLabelText("Status")).toHaveValue("");
    expect(lists()[0].url.searchParams.has("status")).toBe(false);
  });

  it("filters by status, category, area, text and 'Only mine', and starts again from the first page", async () => {
    const { lists } = stubStaffApi();
    await openPage();
    await screen.findByText("No listings match.");

    await userEvent.selectOptions(screen.getByLabelText("Status"), "draft");
    await userEvent.selectOptions(screen.getByLabelText("Category"), "clinic");
    await userEvent.selectOptions(screen.getByLabelText("Area"), "Ogui");
    await userEvent.type(screen.getByLabelText("Search by name"), "night");
    await userEvent.click(screen.getByRole("checkbox", { name: "Only mine" }));

    await waitFor(() => {
      const last = lists().at(-1)?.url.searchParams;
      expect(Object.fromEntries(last ?? [])).toEqual({
        status: "draft", category: "clinic", area: "Ogui", q: "night", mine: "true", limit: "20", offset: "0",
      });
    });
  });

  it("offers every status, and the categories and areas of the API", async () => {
    stubStaffApi();
    await openPage();
    await screen.findByText("No listings match.");

    const statusOptions = within(screen.getByLabelText("Status")).getAllByRole("option").map((option) => option.textContent);
    expect(statusOptions).toEqual(["Any status", "Draft", "Pending review", "Published", "Re-check due", "Hidden"]);
    const categoryOptions = within(screen.getByLabelText("Category")).getAllByRole("option").map((option) => option.getAttribute("value"));
    expect(categoryOptions).toContain("ambulance"); // staff see the emergency categories too
    expect(categoryOptions).toContain("pharmacy");
    expect(within(screen.getByLabelText("Area")).getAllByRole("option").map((option) => option.getAttribute("value"))).toEqual(["", "GRA", "New Haven", "Ogui"]);
  });

  it("loads 20 at a time with a Load more button until all are shown", async () => {
    const all = Array.from({ length: 25 }, (_unused, index) => staffItem(index + 1, "draft"));
    const { lists } = stubStaffApi((params) => {
      const offset = Number(params.get("offset"));
      return json({ items: all.slice(offset, offset + 20), total: 25 });
    });
    await openPage();
    await screen.findAllByRole("article");
    expect(screen.getAllByRole("article")).toHaveLength(20);

    await userEvent.click(screen.getByRole("button", { name: "Load more" }));

    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(25));
    expect(lists().at(-1)?.url.searchParams.get("offset")).toBe("20");
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  it("says how many there are", async () => {
    stubStaffApi(() => json({ items: [staffItem(1, "draft")], total: 1 }));
    await openPage();

    expect(await screen.findByText("1 listing")).toBeInTheDocument();
  });

  it("shows the error with Retry when the call fails", async () => {
    let attempts = 0;
    stubStaffApi(() => (++attempts === 1 ? json({ detail: "boom" }, 500) : json({ items: [staffItem(1, "draft")], total: 1 })));
    await openPage();

    expect(await screen.findByText("We couldn't load this. Check your connection and try again.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByRole("link", { name: "Place 1" })).toBeInTheDocument();
  });

  it("goes to the login when the token is no longer good (401)", async () => {
    stubStaffApi(() => json({ detail: "Invalid or expired token" }, 401));
    await openPage();

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/login"));
    expect(window.sessionStorage.length).toBe(0);
  });

  it("is closed to a visitor with no session, and to a provider", async () => {
    window.sessionStorage.clear();
    stubStaffApi();
    const first = render(await AdminListingsPage({ searchParams: Promise.resolve({}) }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/login"));
    expect(screen.queryByText("New listing")).toBeNull();
    first.unmount();

    loginAs("provider");
    render(await AdminListingsPage({ searchParams: Promise.resolve({}) }));
    expect(await screen.findByText("Your role cannot open this page.")).toBeInTheDocument();
  });
});
