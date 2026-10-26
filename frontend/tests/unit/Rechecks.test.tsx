// @vitest-environment jsdom
/** The re-check lists `/admin/recheck`. Requirements: US-11, FR-33, FR-36, NFR-10. UI spec 3.7 and "Phase 11 details"; decision H6
 * in specs/2026-10-20-reports-queue/requirements.md (the lists use `GET /listings?due=`).
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AdminRecheckPage from "@/app/(dashboards)/admin/recheck/page";
import type { ListingStatus, StaffListingSummary } from "@/types/staff";

import { json, listing } from "../helpers/api";
import { headerOf, loginAs, stubStaffApi } from "../helpers/queue";
import { readSource } from "../helpers/source";

const replace = vi.fn();
const router = { replace, push: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

function dueItem(id: number, status: ListingStatus = "published", due = "2026-10-05T09:00:00Z"): StaffListingSummary {
  return { ...listing({ id, slug: `place-${id}`, name: `Place ${id}` }), status, next_check_due: due, created_by: 3 };
}

function list(items: StaffListingSummary[], total = items.length) {
  return () => json({ items, total });
}

async function openPage(tab?: string) {
  render(await AdminRecheckPage({ searchParams: Promise.resolve(tab ? { tab } : {}) }));
}

beforeEach(() => {
  window.sessionStorage.clear();
  replace.mockReset();
  loginAs("editor");
});
afterEach(() => vi.unstubAllGlobals());

describe("who may open it", () => {
  it("sends a visitor with no session to the login", async () => {
    window.sessionStorage.clear();
    const { requests } = stubStaffApi({});
    await openPage();

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/log-in"));
    expect(requests).toHaveLength(0);
  });

  it.each(["verifier", "provider"] as const)("tells a %s that the role cannot open it", async (role) => {
    loginAs(role);
    const { requests } = stubStaffApi({});
    await openPage();

    expect(await screen.findByText("Your role cannot open this page.")).toBeInTheDocument();
    expect(requests).toHaveLength(0);
  });
});

describe("the two tabs", () => {
  it("are links, Overdue first and marked as the current page", async () => {
    stubStaffApi({ "/listings": list([]) });
    await openPage();

    const navigation = screen.getByRole("navigation", { name: "Re-check lists" });
    const links = within(navigation).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["Overdue", "Due this week"]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/admin/recheck?tab=overdue", "/admin/recheck?tab=this_week"]);
    expect(links.map((link) => link.getAttribute("aria-current"))).toEqual(["page", null]);
    for (const link of links) expect(link.className).toMatch(/min-h-12/);
    expect(screen.getByRole("heading", { level: 1, name: "Re-checks" })).toBeInTheDocument();
  });

  it("show the due-this-week list for ?tab=this_week", async () => {
    const { on } = stubStaffApi({ "/listings": list([]) });
    await openPage("this_week");

    await screen.findByText("Nothing is due this week.");

    const navigation = screen.getByRole("navigation", { name: "Re-check lists" });
    expect(within(navigation).getByRole("link", { current: "page" })).toHaveTextContent("Due this week");
    expect(on("/listings")[0].url.searchParams.get("due")).toBe("this_week");
  });

  it("fall back to Overdue for a tab name that does not exist", async () => {
    const { on } = stubStaffApi({ "/listings": list([]) });
    await openPage("nonsense");

    await screen.findByText("Nothing is overdue.");

    expect(on("/listings")[0].url.searchParams.get("due")).toBe("overdue");
  });
});

describe("the list", () => {
  it("asks for the overdue listings with the token in the header and nothing in the address", async () => {
    const { on } = stubStaffApi({ "/listings": list([]) });
    await openPage();

    await screen.findByText("Nothing is overdue.");

    const [request] = on("/listings");
    expect(Object.fromEntries(request.url.searchParams)).toEqual({ due: "overdue", limit: "20", offset: "0" });
    expect(headerOf(request.init, "Authorization")).toBe("Bearer tok");
    expect(request.url.href).not.toContain("tok");
  });

  it("shows the count, and for each listing its name as a link, area, category, status in words, the date and the verification log link", async () => {
    stubStaffApi({ "/listings": list([dueItem(12), dueItem(13, "recheck_due", "2026-08-20T09:00:00Z")]) });
    await openPage();

    const cards = await screen.findAllByRole("article");

    expect(screen.getByText("2 listings")).toBeInTheDocument();
    expect(within(cards[0]).getByRole("link", { name: "Place 12" })).toHaveAttribute("href", "/admin/listings/12");
    expect(cards[0]).toHaveTextContent("New Haven");
    expect(cards[0]).toHaveTextContent("Pharmacy");
    expect(cards[0]).toHaveTextContent("Published");
    expect(cards[0]).toHaveTextContent("Check was due 5 Oct 2026");
    expect(within(cards[0]).getByRole("link", { name: "Open verification log" })).toHaveAttribute("href", "/admin/listings/12/checks");
    expect(within(cards[0]).getByRole("link", { name: "Open verification log" }).className).toMatch(/min-h-12|min-h-\[50px\]/);
    expect(cards[1]).toHaveTextContent("Re-check due");
    expect(cards[1]).toHaveTextContent("Check was due 20 Aug 2026");
  });

  it("says 'Check due' instead of 'was due' on the this-week tab", async () => {
    stubStaffApi({ "/listings": list([dueItem(12, "published", "2026-10-12T09:00:00Z")]) });
    await openPage("this_week");

    const card = await screen.findByRole("article");

    expect(card).toHaveTextContent("Check due 12 Oct 2026");
  });

  it("loads 20 at a time with Load more", async () => {
    const all = Array.from({ length: 22 }, (_unused, index) => dueItem(100 + index));
    stubStaffApi({
      "/listings": (url) => {
        const offset = Number(url.searchParams.get("offset"));
        return json({ items: all.slice(offset, offset + 20), total: 22 });
      },
    });
    await openPage();
    await screen.findAllByRole("article");

    await userEvent.click(screen.getByRole("button", { name: "Load more" }));

    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(22));
  });

  it("shows the error with Retry, and Retry asks again", async () => {
    let attempts = 0;
    stubStaffApi({ "/listings": () => (++attempts === 1 ? json({ detail: "x" }, 500) : json({ items: [dueItem(12)], total: 1 })) });
    await openPage();

    expect(await screen.findByText("We couldn't load this. Check your connection and try again.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByRole("article")).toBeInTheDocument();
  });

  it("an answer 401 logs the user out and goes to the login", async () => {
    stubStaffApi({ "/listings": () => json({ detail: "Invalid or expired token" }, 401) });
    await openPage();

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/log-in"));
  });
});

describe("what is never done", () => {
  it("writes nothing to local storage or the console", () => {
    expect(readSource("components/admin/Rechecks.tsx")).not.toMatch(/localStorage|console\./);
  });
});
