// @vitest-environment jsdom
/** The staff report queue `/admin/reports`. Requirements: US-12, FR-35, NFR-07, NFR-10. UI spec 3.6 and "Phase 11 details";
 * decisions H1 to H3 and H7 in specs/2026-10-20-reports-queue/requirements.md.
 */
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AdminReportsPage from "@/app/(dashboards)/admin/reports/page";
import type { ReportItem } from "@/types/staff";

import { json, neverAnswers } from "../helpers/api";
import { headerOf, loginAs, reportItem, stubStaffApi } from "../helpers/queue";
import { readSource } from "../helpers/source";

const replace = vi.fn();
const router = { replace, push: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

function queue(items: ReportItem[], total = items.length) {
  return () => json({ items, total });
}

beforeEach(() => {
  window.sessionStorage.clear();
  replace.mockReset();
  loginAs("editor");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("who may open it", () => {
  it("sends a visitor with no session to the login and asks for nothing", async () => {
    window.sessionStorage.clear();
    const { requests } = stubStaffApi({});
    render(<AdminReportsPage />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/log-in"));
    expect(requests).toHaveLength(0);
  });

  it.each(["verifier", "provider"] as const)("tells a %s that the role cannot open it, and asks for nothing", async (role) => {
    loginAs(role);
    const { requests } = stubStaffApi({});
    render(<AdminReportsPage />);

    expect(await screen.findByText("Your role cannot open this page.")).toBeInTheDocument();
    expect(requests).toHaveLength(0);
  });
});

describe("the list", () => {
  it("asks for the open reports with the token in the header and nothing in the address", async () => {
    const { on } = stubStaffApi({ "/reports": queue([]) });
    render(<AdminReportsPage />);

    await screen.findByText("No open reports.");

    const [request] = on("/reports");
    expect(Object.fromEntries(request.url.searchParams)).toEqual({ status: "open", limit: "20", offset: "0" });
    expect(headerOf(request.init, "Authorization")).toBe("Bearer tok");
    expect(request.url.href).not.toContain("tok");
  });

  it("has one h1 and the choice Open, Resolved, Dismissed with Open pressed", async () => {
    stubStaffApi({ "/reports": queue([]) });
    render(<AdminReportsPage />);
    await screen.findByText("No open reports.");

    expect(screen.getByRole("heading", { level: 1, name: "Reports" })).toBeInTheDocument();
    const group = screen.getByRole("group", { name: "Show reports that are" });
    const buttons = within(group).getAllByRole("button");
    expect(buttons.map((button) => button.textContent)).toEqual(["Open", "Resolved", "Dismissed"]);
    expect(buttons.map((button) => button.getAttribute("aria-pressed"))).toEqual(["true", "false", "false"]);
    for (const button of buttons) expect(button.className).toMatch(/min-h-12|min-h-\[50px\]/);
  });

  it("shows the urgent tag in words on the urgent report only, in the order the API sent", async () => {
    stubStaffApi({
      "/reports": queue([
        reportItem({ id: 1, urgent: true, reason: "not_working", listing: { id: 5, slug: "a", name: "Flagged Clinic", area: "Ogui", status: "recheck_due" } }),
        reportItem({ id: 2 }),
      ]),
    });
    render(<AdminReportsPage />);

    const cards = await screen.findAllByRole("article");

    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText("Urgent")).toBeInTheDocument();
    expect(cards[0]).toHaveTextContent("Flagged Clinic");
    expect(within(cards[1]).queryByText("Urgent")).toBeNull();
  });

  it("shows the listing as a link to its editor, the area, the status, the reason, the comment, the masked phone and the time", async () => {
    stubStaffApi({ "/reports": queue([reportItem()]) });
    render(<AdminReportsPage />);

    const card = await screen.findByRole("article");

    expect(within(card).getByRole("link", { name: "Night Pharmacy A" })).toHaveAttribute("href", "/admin/listings/12");
    expect(card).toHaveTextContent("New Haven");
    expect(card).toHaveTextContent("Published");
    expect(card).toHaveTextContent("Wrong number");
    expect(card).toHaveTextContent("Rang twice, nobody answered");
    expect(card).toHaveTextContent("0*** *** 0000");
    expect(card.textContent).not.toContain("+234******0000");
    expect(within(card).getByText("2 hours ago")).toHaveAttribute("title", expect.stringMatching(/^\d{1,2} \w{3} \d{4}, \d{2}:\d{2}$/));
  });

  it("leaves out the phone line when there is no phone, and shows the comment as plain text, never as HTML", async () => {
    stubStaffApi({
      "/reports": queue([reportItem({ reporter_phone: null, comment: "<img src=x onerror=alert(1)>" })]),
    });
    render(<AdminReportsPage />);

    const card = await screen.findByRole("article");

    expect(card).toHaveTextContent("<img src=x onerror=alert(1)>");
    expect(card.querySelector("img")).toBeNull();
    expect(card.textContent).not.toMatch(/Phone/i);
  });

  it("has the three buttons of an open report, each at least 48 px high", async () => {
    stubStaffApi({ "/reports": queue([reportItem()]) });
    render(<AdminReportsPage />);

    const card = await screen.findByRole("article");

    const open = within(card).getByRole("link", { name: "Open listing" });
    expect(open).toHaveAttribute("href", "/admin/listings/12");
    for (const control of [open, within(card).getByRole("button", { name: "Resolve" }), within(card).getByRole("button", { name: "Dismiss" })]) {
      expect(control.className).toMatch(/min-h-12|min-h-\[50px\]/);
    }
  });
});

describe("resolving and dismissing", () => {
  it.each([
    ["Resolve", "resolved", "Report resolved. The reporter's phone number, if any, was deleted."],
    ["Dismiss", "dismissed", "Report dismissed. The reporter's phone number, if any, was deleted."],
  ] as const)("%s sends a PATCH with the token, removes the card and says what happened", async (label, status, message) => {
    const { on } = stubStaffApi({
      "/reports": queue([reportItem({ id: 88 })]),
      "/reports/88": () => json(reportItem({ id: 88, status, reporter_phone: null })),
    });
    render(<AdminReportsPage />);
    const card = await screen.findByRole("article");

    await userEvent.click(within(card).getByRole("button", { name: label }));

    await waitFor(() => expect(screen.queryByRole("article")).toBeNull());
    const [patch] = on("/reports/88", "PATCH");
    expect(patch.init?.body).toBe(JSON.stringify({ status }));
    expect(headerOf(patch.init, "Authorization")).toBe("Bearer tok");
    expect(screen.getByRole("status")).toHaveTextContent(message);
    expect(screen.getByText("No open reports.")).toBeInTheDocument();
  });

  it("keeps the card and says it could not be done when the call fails", async () => {
    stubStaffApi({
      "/reports": queue([reportItem()]),
      "/reports/88": () => json({ detail: "Server error" }, 500),
    });
    render(<AdminReportsPage />);
    const card = await screen.findByRole("article");

    await userEvent.click(within(card).getByRole("button", { name: "Resolve" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't do this. Try again.");
    expect(screen.getByRole("article")).toBeInTheDocument();
    expect(within(screen.getByRole("article")).getByRole("button", { name: "Resolve" })).toBeEnabled();
  });

  it("shows the API's sentence when the report was already closed by someone else", async () => {
    stubStaffApi({
      "/reports": queue([reportItem()]),
      "/reports/88": () => json({ detail: "This report is already closed." }, 400),
    });
    render(<AdminReportsPage />);
    const card = await screen.findByRole("article");

    await userEvent.click(within(card).getByRole("button", { name: "Dismiss" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("This report is already closed.");
  });

  it("disables both buttons of the card while the call is on its way, so it is sent once", async () => {
    let calls = 0;
    stubStaffApi({
      "/reports": queue([reportItem()]),
      "/reports/88": (_url, init) => {
        calls += 1;
        return neverAnswers(undefined, init?.signal ?? undefined);
      },
    });
    render(<AdminReportsPage />);
    const card = await screen.findByRole("article");

    await userEvent.click(within(card).getByRole("button", { name: "Resolve" }));
    await userEvent.click(within(card).getByRole("button", { name: "Resolve" }));

    expect(calls).toBe(1);
    expect(within(card).getByRole("button", { name: "Resolve" })).toBeDisabled();
    expect(within(card).getByRole("button", { name: "Dismiss" })).toBeDisabled();
  });
});

describe("the choice of status", () => {
  it("asks for the resolved reports, marks the button, and shows them without buttons or phone", async () => {
    const { on } = stubStaffApi({
      "/reports": (url) =>
        url.searchParams.get("status") === "resolved"
          ? json({ items: [reportItem({ id: 7, status: "resolved", reporter_phone: null, resolved_at: new Date().toISOString() })], total: 1 })
          : json({ items: [], total: 0 }),
    });
    render(<AdminReportsPage />);
    await screen.findByText("No open reports.");

    await userEvent.click(screen.getByRole("button", { name: "Resolved" }));

    const card = await screen.findByRole("article");
    expect(on("/reports").at(-1)?.url.searchParams.get("status")).toBe("resolved");
    expect(screen.getByRole("button", { name: "Resolved" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Open" })).toHaveAttribute("aria-pressed", "false");
    expect(within(card).queryByRole("button", { name: "Resolve" })).toBeNull();
    expect(within(card).queryByRole("button", { name: "Dismiss" })).toBeNull();
    expect(card).toHaveTextContent("Resolved");
  });

  it.each([
    ["Resolved", "No resolved reports."],
    ["Dismissed", "No dismissed reports."],
  ])("says '%s' has none when the list is empty", async (button, sentence) => {
    stubStaffApi({ "/reports": queue([]) });
    render(<AdminReportsPage />);
    await screen.findByText("No open reports.");

    await userEvent.click(screen.getByRole("button", { name: button }));

    expect(await screen.findByText(sentence)).toBeInTheDocument();
  });
});

describe("paging and states", () => {
  it("loads 20 at a time with Load more until all are shown", async () => {
    const all = Array.from({ length: 25 }, (_unused, index) => reportItem({ id: 100 + index }));
    const { on } = stubStaffApi({
      "/reports": (url) => {
        const offset = Number(url.searchParams.get("offset"));
        return json({ items: all.slice(offset, offset + 20), total: 25 });
      },
    });
    render(<AdminReportsPage />);
    await screen.findAllByRole("article");
    expect(screen.getAllByRole("article")).toHaveLength(20);

    await userEvent.click(screen.getByRole("button", { name: "Load more" }));

    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(25));
    expect(on("/reports").at(-1)?.url.searchParams.get("offset")).toBe("20");
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  it("shows a skeleton, then 'waking up' after 5 seconds, then the error with Retry after 45", async () => {
    vi.useFakeTimers();
    stubStaffApi({ "/reports": (_url, init) => neverAnswers(undefined, init?.signal ?? undefined) });
    render(<AdminReportsPage />);
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
    let attempts = 0;
    stubStaffApi({ "/reports": () => (++attempts === 1 ? json({ detail: "x" }, 500) : json({ items: [reportItem()], total: 1 })) });
    render(<AdminReportsPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Retry" }));

    expect(await screen.findByRole("article")).toBeInTheDocument();
  });

  it("an answer 401 logs the user out and goes to the login", async () => {
    stubStaffApi({ "/reports": () => json({ detail: "Invalid or expired token" }, 401) });
    render(<AdminReportsPage />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/log-in"));
  });
});

describe("what is never done", () => {
  it("never keeps a reporter's phone or the token in storage beyond the session, and never writes to the console", () => {
    expect(readSource("components/admin/ReportsQueue.tsx")).not.toMatch(/localStorage|console\./);
  });
});
