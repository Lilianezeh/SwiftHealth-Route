// @vitest-environment jsdom
/** Find blood and Donate blood. Requirements: US-15, US-16, FR-27, FR-28, FR-29, FR-19, FR-20, NFR-01, NFR-07, NFR-10.
 * UI spec 2.6 and 2.7 with their phase 8 details; decisions F3 and F5 to F9 in specs/2026-10-20-blood/requirements.md.
 */
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import DonateBloodPage from "@/app/(public)/blood/donate/page";
import BloodPage from "@/app/(public)/blood/page";
import { DONOR_GUIDANCE } from "@/config/donorGuidance";
import { BLOOD_COPY_KEY, readBloodCopy, saveBloodCopy } from "@/lib/blood/offlineCopy";
import { savePosition } from "@/lib/location/locationStore";

import { json, neverAnswers, stubGeolocation } from "../helpers/api";
import { bloodBank, donationCentre } from "../helpers/blood";
import { readSource } from "../helpers/source";

type Handler = (parameters: URLSearchParams, signal?: AbortSignal) => Response | Promise<Response>;

function stubBlood(handlers: { banks?: Handler; centres?: Handler } = {}) {
  const requests: URL[] = [];
  const empty: Handler = () => json({ items: [], total: 0 });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (address: string, init?: RequestInit) => {
      const url = new URL(address);
      requests.push(url);
      const signal = init?.signal ?? undefined;
      if (url.pathname === "/blood/banks") return (handlers.banks ?? empty)(url.searchParams, signal);
      if (url.pathname === "/blood/donation-centres") return (handlers.centres ?? empty)(url.searchParams, signal);
      return json({ detail: "Not found" }, 404);
    }),
  );
  return { requests, banks: () => requests.filter((url) => url.pathname === "/blood/banks"), centres: () => requests.filter((url) => url.pathname === "/blood/donation-centres") };
}

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("the two tab links", () => {
  it.each([
    ["Find blood", BloodPage, "/blood", "Donate blood", "/blood/donate"],
    ["Donate blood", DonateBloodPage, "/blood/donate", "Find blood", "/blood"],
  ] as const)("on %s: both links, the current one marked, each 48 px high", async (_name, Page, currentHref, otherLabel, otherHref) => {
    stubBlood();
    render(<Page />);

    const navigation = screen.getByRole("navigation", { name: "Blood" });
    const current = within(navigation).getByRole("link", { current: "page" });
    expect(current).toHaveAttribute("href", currentHref);
    expect(within(navigation).getByRole("link", { name: otherLabel })).toHaveAttribute("href", otherHref);
    expect(within(navigation).getByRole("link", { name: otherLabel })).not.toHaveAttribute("aria-current");
    for (const link of within(navigation).getAllByRole("link")) expect(link.className).toMatch(/\bmin-h-12\b/);
  });
});

describe("Find blood", () => {
  it("has one h1, the nine chips (Any first), none but Any pressed, each 48 px high", async () => {
    stubBlood();
    render(<BloodPage />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Find blood");
    const group = screen.getByRole("group", { name: "Blood group" });
    const chips = within(group).getAllByRole("button");
    expect(chips.map((chip) => chip.textContent)).toEqual(["Any", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]);
    expect(chips.map((chip) => chip.getAttribute("aria-pressed"))).toEqual(["true", ...Array(8).fill("false")]);
    for (const chip of chips) expect(chip.className).toMatch(/\bmin-h-12\b/);
  });

  it("asks for every blood bank first, with no group and no position", async () => {
    const { banks } = stubBlood({ banks: () => json({ items: [bloodBank()], total: 1 }) });
    render(<BloodPage />);

    await screen.findByRole("article");

    expect(Object.fromEntries(banks()[0].searchParams)).toEqual({ limit: "20", offset: "0" });
    expect(screen.getByText("1 blood bank, A to Z")).toBeInTheDocument();
  });

  it("shows each bank with its groups, the confirmed date, the notice, Call, Directions and Report, and nothing sponsored", async () => {
    stubBlood({ banks: () => json({ items: [bloodBank({ sponsored: true })], total: 1 }) });
    render(<BloodPage />);

    const card = await screen.findByRole("article");

    expect(within(card).getByRole("link", { name: "Demo Blood Bank Central" })).toHaveAttribute("href", "/listing/demo-blood-bank-central");
    expect(card).toHaveTextContent("Blood bank · Ogui");
    expect(within(card).getByRole("list", { name: "Blood groups" }).textContent).toBe("A+O+");
    expect(card).toHaveTextContent("Confirmed 1 Oct 2026");
    expect(card).toHaveTextContent("Stock changes daily; call to confirm before you go.");
    expect(within(card).getByRole("link", { name: /^Call/ })).toHaveAttribute("href", "tel:+2340000000012");
    expect(within(card).getByRole("link", { name: /^Directions/ })).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: "Report a problem with Demo Blood Bank Central" })).toHaveAttribute("href", "/report/demo-blood-bank-central");
    expect(card).toHaveTextContent("Open now");
    expect(card).toHaveTextContent("Closes 9:00 PM");
    expect(screen.queryByText("Sponsored")).toBeNull(); // FR-19
  });

  it("says 'No groups listed' and shows no date for a bank with no groups, and leaves out Call without a number", async () => {
    stubBlood({ banks: () => json({ items: [bloodBank({ blood_groups: [], blood_groups_confirmed_at: null, primary_phone: null })], total: 1 }) });
    render(<BloodPage />);

    const card = await screen.findByRole("article");

    expect(card).toHaveTextContent("No groups listed");
    expect(card.textContent).not.toMatch(/Confirmed/);
    expect(within(card).queryByRole("link", { name: /^Call/ })).toBeNull();
  });

  it("choosing a group asks for it again, keeps it pressed, and Any clears it", async () => {
    const { banks } = stubBlood();
    render(<BloodPage />);
    await screen.findByText("No blood banks found. In an emergency, call 112.");

    await userEvent.click(screen.getByRole("button", { name: "O+" }));
    await waitFor(() => expect(banks().at(-1)?.searchParams.get("blood_group")).toBe("O+"));
    expect(screen.getByRole("button", { name: "O+" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Any" })).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(screen.getByRole("button", { name: "Any" }));
    await waitFor(() => expect(banks().at(-1)?.searchParams.has("blood_group")).toBe(false));
    expect(window.location.search).toBe(""); // the choice is not in the address
  });

  it("says no banks were found with the way to SwiftRescue", async () => {
    stubBlood();
    render(<BloodPage />);

    expect(await screen.findByText("No blood banks found. In an emergency, call 112.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "SwiftRescue" })).toHaveAttribute("href", "/emergency");
  });

  it("with a position already allowed on another page sends it once, shows distances, and says nearest first", async () => {
    savePosition({ latitude: 6.452, longitude: 7.51 });
    const { banks } = stubBlood({ banks: () => json({ items: [bloodBank({ distance_km: 1.4 })], total: 1 }) });
    render(<BloodPage />);

    const card = await screen.findByRole("article");

    // The list on screen asks with the position, once (the copy for offline use is a separate quiet request without it).
    const withPosition = banks().filter((request) => request.searchParams.has("lat"));
    expect(withPosition).toHaveLength(1);
    expect(Object.fromEntries(withPosition[0].searchParams)).toMatchObject({ lat: "6.452", lng: "7.51" });
    expect(card).toHaveTextContent("Blood bank · Ogui · 1.4 km");
    expect(screen.getByText("1 blood bank, nearest first")).toBeInTheDocument();
    expect(window.location.search).toBe(""); // never in the address
  });

  it("asks the browser for the position only after the tap on 'Show blood banks near me'", async () => {
    const getCurrentPosition = stubGeolocation({ latitude: 6.452, longitude: 7.51 });
    const { banks } = stubBlood();
    render(<BloodPage />);
    const button = await screen.findByRole("button", { name: "Show blood banks near me" });
    expect(getCurrentPosition).not.toHaveBeenCalled();

    await userEvent.click(button);

    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(banks().at(-1)?.searchParams.get("lat")).toBe("6.452"));
  });

  it("says the position could not be used and keeps the A to Z list when it is refused", async () => {
    stubGeolocation({ errorCode: 1 });
    stubBlood({ banks: () => json({ items: [bloodBank()], total: 1 }) });
    render(<BloodPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Show blood banks near me" }));

    expect(await screen.findByText("We could not use your location, so blood banks are listed A to Z.")).toBeInTheDocument();
    expect(screen.getByRole("article")).toBeInTheDocument();
  });

  it("loads 20 at a time with Load more until all are shown", async () => {
    const all = Array.from({ length: 25 }, (_unused, index) => bloodBank({ id: 100 + index, slug: `bank-${index}`, name: `Bank ${index}` }));
    const { banks } = stubBlood({
      banks: (parameters) => {
        const offset = Number(parameters.get("offset"));
        return json({ items: all.slice(offset, offset + 20), total: 25 });
      },
    });
    render(<BloodPage />);
    await screen.findAllByRole("article");
    expect(screen.getAllByRole("article")).toHaveLength(20);

    await userEvent.click(screen.getByRole("button", { name: "Load more" }));

    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(25));
    expect(banks().at(-1)?.searchParams.get("offset")).toBe("20");
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  it("shows a skeleton, then 'waking up' after 5 seconds, then the error with Retry after 45", async () => {
    vi.useFakeTimers();
    stubBlood({ banks: neverAnswers });
    render(<BloodPage />);
    expect(screen.getByTestId("blood-status")).toHaveAttribute("aria-busy", "true");

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
    stubBlood({ banks: () => (++attempts === 1 ? json({ detail: "x" }, 500) : json({ items: [bloodBank()], total: 1 })) });
    render(<BloodPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Retry" }));

    expect(await screen.findByRole("article")).toBeInTheDocument();
  });

  it("keeps the Call 112 line visible: blood is never a replacement for the emergency number", async () => {
    stubBlood();
    render(<BloodPage />);

    expect(screen.getAllByText(/call 112/i).length).toBeGreaterThan(0);
  });
});

describe("Donate blood", () => {
  it("has one h1, and the guidance part ends with the sentence of FR-29", async () => {
    stubBlood();
    render(<DonateBloodPage />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Donate blood");
    expect(screen.getByText("The blood bank will confirm if you can donate.")).toBeInTheDocument();
  });

  it("says the guidance is being prepared with the medical advisor while it is empty, and writes no medical advice itself (F3)", () => {
    stubBlood();
    render(<DonateBloodPage />);

    expect(DONOR_GUIDANCE.points).toEqual([]);
    expect(screen.getByText("Donor guidance is being prepared with our medical advisor.")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\b(age|weight|kg|hemoglobin|haemoglobin|iron|eat|drink|sleep|medication|pregnan|tattoo|illness)\b/i);
  });

  it("only ever shows guidance that carries a review line with a date (a rule for whoever adds the text later)", () => {
    const { points, reviewedBy, reviewedOn } = DONOR_GUIDANCE;

    if (points.length > 0) {
      expect(reviewedBy).toBe("Reviewed by our medical advisor");
      expect(reviewedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    } else {
      expect(reviewedOn).toBeNull();
    }
    expect(readSource("components/blood/DonorGuidance.tsx")).toMatch(/reviewedBy/);
  });

  it("lists the donation centres with the week of hours, Call, Directions and Report", async () => {
    stubBlood({ centres: () => json({ items: [donationCentre()], total: 1 }) });
    render(<DonateBloodPage />);

    const card = await screen.findByRole("article");

    expect(within(card).getByRole("link", { name: "Demo Blood Bank North" })).toHaveAttribute("href", "/listing/demo-blood-bank-north");
    expect(card).toHaveTextContent("Blood bank · Abakpa Nike");
    expect(within(card).getByText("Donation hours")).toBeInTheDocument();
    const rows = within(card).getAllByRole("row");
    expect(rows).toHaveLength(7);
    expect(rows[0]).toHaveTextContent("Monday");
    expect(rows[0]).toHaveTextContent("8:00 AM");
    expect(rows[0]).toHaveTextContent("5:00 PM");
    expect(rows[6]).toHaveTextContent("Closed");
    expect(within(card).getByRole("link", { name: /^Call/ })).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: /^Directions/ })).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: "Report a problem with Demo Blood Bank North" })).toHaveAttribute("href", "/report/demo-blood-bank-north");
    expect(screen.queryByText("Sponsored")).toBeNull();
  });

  it("says Open 24 hours instead of the table for a 24-hour centre", async () => {
    stubBlood({ centres: () => json({ items: [donationCentre({ is_24_hours: true })], total: 1 }) });
    render(<DonateBloodPage />);

    const card = await screen.findByRole("article");

    expect(within(card).queryAllByRole("row")).toHaveLength(0);
    expect(card).toHaveTextContent("Open 24 hours, every day");
  });

  it("says no centres are listed yet with the way to Find blood", async () => {
    stubBlood();
    render(<DonateBloodPage />);

    expect(await screen.findByText("No donation centres are listed yet. Call a blood bank to ask.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Find a blood bank" })).toHaveAttribute("href", "/blood");
  });

  it("uses the position the same way: only after a tap, and never in the address", async () => {
    const getCurrentPosition = stubGeolocation({ latitude: 6.452, longitude: 7.51 });
    const { centres } = stubBlood({ centres: () => json({ items: [donationCentre({ distance_km: 2.1 })], total: 1 }) });
    render(<DonateBloodPage />);
    const button = await screen.findByRole("button", { name: "Show donation centres near me" });
    expect(getCurrentPosition).not.toHaveBeenCalled();

    await userEvent.click(button);

    await waitFor(() => expect(centres().at(-1)?.searchParams.get("lat")).toBe("6.452"));
    expect(await screen.findByText(/Abakpa Nike · 2\.1 km/)).toBeInTheDocument();
    expect(window.location.search).toBe("");
  });

  it("loads 20 at a time with Load more", async () => {
    const all = Array.from({ length: 22 }, (_unused, index) => donationCentre({ id: 200 + index, slug: `centre-${index}`, name: `Centre ${index}` }));
    stubBlood({ centres: (parameters) => json({ items: all.slice(Number(parameters.get("offset")), Number(parameters.get("offset")) + 20), total: 22 }) });
    render(<DonateBloodPage />);
    await screen.findAllByRole("article");

    await userEvent.click(screen.getByRole("button", { name: "Load more" }));

    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(22));
  });
});

const NETWORK_DOWN: Handler = () => {
  throw new TypeError("Failed to fetch");
};
const SAVED_AT = new Date("2026-10-22T10:00:00Z");
const OFFLINE_NOTICE = "Offline — showing saved blood banks from 22 Oct 2026";

function savedBanks() {
  saveBloodCopy(
    [
      bloodBank({ id: 28, slug: "central", name: "Demo Blood Bank Central", blood_groups: ["A+", "O+"] }),
      bloodBank({ id: 29, slug: "north", name: "Demo Blood Bank North", area: "Abakpa Nike", blood_groups: ["B+", "O-"], primary_phone: "+2340000000029" }),
    ],
    SAVED_AT,
  );
}

describe("saving the list for offline use (decision N2)", () => {
  it("saves the list that loaded with no position and no group, from that same answer, with no extra request", async () => {
    const { banks } = stubBlood({ banks: () => json({ items: [bloodBank()], total: 1 }) });
    render(<BloodPage />);

    await screen.findByRole("article");

    expect(banks()).toHaveLength(1);
    expect(readBloodCopy()?.banks.map((bank) => bank.name)).toEqual(["Demo Blood Bank Central"]);
  });

  it("with a position asks once more, quietly, with no position and no group and the most banks, and saves that: no distance in it", async () => {
    savePosition({ latitude: 6.432, longitude: 7.499 }); // not the place of the blood bank, so a leak of the position would show
    const { banks } = stubBlood({
      banks: (parameters) => json({ items: [bloodBank({ distance_km: parameters.has("lat") ? 1.4 : null })], total: 1 }),
    });
    render(<BloodPage />);

    await screen.findByRole("article");
    await waitFor(() => expect(readBloodCopy()).not.toBeNull());

    const [shown, quiet] = banks();
    expect(shown.searchParams.get("lat")).toBe("6.432");
    expect(quiet.searchParams.has("lat")).toBe(false);
    expect(quiet.searchParams.has("lng")).toBe(false);
    expect(quiet.searchParams.has("blood_group")).toBe(false);
    expect(quiet.searchParams.get("limit")).toBe("100");
    const stored = window.localStorage.getItem(BLOOD_COPY_KEY) ?? "";
    expect(stored).not.toContain("distance_km");
    expect(stored).not.toContain("6.432");
    expect(stored).not.toContain("7.499");
    expect(window.location.search).toBe(""); // and the position is still in no address
  });

  it("makes the copy once per visit: choosing a group afterwards asks for the list only", async () => {
    const { banks } = stubBlood({ banks: () => json({ items: [bloodBank()], total: 1 }) });
    render(<BloodPage />);
    await screen.findByRole("article");
    expect(banks()).toHaveLength(1);

    await userEvent.click(screen.getByRole("button", { name: "O+" }));
    await waitFor(() => expect(banks()).toHaveLength(2));
    await userEvent.click(screen.getByRole("button", { name: "Any" }));
    await waitFor(() => expect(banks()).toHaveLength(3));

    // 3 = the first list, the O+ list, the Any list again: no extra request for the copy, it was saved the first time.
    expect(banks().every((request) => request.searchParams.get("limit") === "20")).toBe(true);
  });

  it("saves nothing when the list is empty, so a good copy is not lost", async () => {
    savedBanks();
    stubBlood({ banks: () => json({ items: [], total: 0 }) });
    render(<BloodPage />);

    await screen.findByText("No blood banks found. In an emergency, call 112.");

    expect(readBloodCopy()?.banks).toHaveLength(2);
  });

  it("saves nothing when the request fails", async () => {
    stubBlood({ banks: () => json({ detail: "x" }, 500) });
    render(<BloodPage />);

    await screen.findByRole("button", { name: "Retry" });

    expect(readBloodCopy()).toBeNull();
  });
});

describe("Find blood with no network (decisions N3 to N5)", () => {
  it("shows the saved banks under the notice with the date, and the Call link of each", async () => {
    savedBanks();
    stubBlood({ banks: NETWORK_DOWN });
    render(<BloodPage />);

    const notice = await screen.findByText(OFFLINE_NOTICE);

    expect(notice.closest("[role=status]")).not.toBeNull();
    const cards = screen.getAllByRole("article");
    expect(cards.map((card) => within(card).getByRole("heading", { level: 3 }).textContent)).toEqual([
      "Demo Blood Bank Central",
      "Demo Blood Bank North",
    ]);
    expect(within(cards[1]).getByRole("link", { name: /^Call/ })).toHaveAttribute("href", "tel:+2340000000029");
    expect(within(cards[1]).getByRole("list", { name: "Blood groups" }).textContent).toBe("B+O-");
    expect(cards[0]).toHaveTextContent("Confirmed 1 Oct 2026");
    expect(cards[0]).toHaveTextContent("Stock changes daily; call to confirm before you go.");
    expect(screen.getByText("2 saved blood banks, A to Z")).toBeInTheDocument();
  });

  it("puts the notice directly under the group chips, before the first bank, in 16 px text", async () => {
    savedBanks();
    stubBlood({ banks: NETWORK_DOWN });
    render(<BloodPage />);

    const notice = await screen.findByText(OFFLINE_NOTICE);
    const chips = screen.getByRole("group", { name: "Blood group" });
    const first = screen.getAllByRole("article")[0];

    expect(chips.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(notice.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(notice.className).toMatch(/\btext-base\b/);
    expect(notice.className).not.toMatch(/text-(xs|sm)\b/);
  });

  it("leaves out what needs the network: near me, distances, Load more, Report a problem, and the open or closed badge", async () => {
    savedBanks();
    stubBlood({ banks: NETWORK_DOWN });
    const { container } = render(<BloodPage />);

    await screen.findByText(OFFLINE_NOTICE);

    expect(screen.queryByRole("button", { name: "Show blood banks near me" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    expect(screen.queryByRole("link", { name: /Report a problem/ })).toBeNull();
    expect(container.textContent).not.toMatch(/\bkm\b|Open now|Closed|Closes/);
  });

  it("keeps the two tab links, and Directions as a link", async () => {
    savedBanks();
    stubBlood({ banks: NETWORK_DOWN });
    render(<BloodPage />);

    await screen.findByText(OFFLINE_NOTICE);

    expect(within(screen.getByRole("navigation", { name: "Blood" })).getAllByRole("link")).toHaveLength(2);
    expect(within(screen.getAllByRole("article")[0]).getByRole("link", { name: /^Directions/ })).toBeInTheDocument();
  });

  it("filters the saved list with the group chips, and says so when no saved bank lists the group", async () => {
    savedBanks();
    stubBlood({ banks: NETWORK_DOWN });
    render(<BloodPage />);
    await screen.findByText(OFFLINE_NOTICE);

    await userEvent.click(screen.getByRole("button", { name: "O-" }));
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("Demo Blood Bank North");
    expect(screen.getByRole("button", { name: "O-" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("1 saved blood bank, A to Z")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "AB+" }));
    expect(screen.queryByRole("article")).toBeNull();
    expect(screen.getByText("No saved blood bank lists AB+. Connect to see the latest list. In an emergency, call 112.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Any" }));
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.getByText(OFFLINE_NOTICE)).toBeInTheDocument(); // still offline
  });

  it("does not ask the browser for the position or ask the network again for the chips", async () => {
    savedBanks();
    const { banks } = stubBlood({ banks: NETWORK_DOWN });
    render(<BloodPage />);
    await screen.findByText(OFFLINE_NOTICE);
    const asked = banks().length;

    await userEvent.click(screen.getByRole("button", { name: "O+" }));

    expect(banks()).toHaveLength(asked); // the chips work on the saved list
  });

  it("shows the saved banks after a timeout too (a network that never answers)", async () => {
    savedBanks();
    vi.useFakeTimers();
    stubBlood({ banks: neverAnswers });
    render(<BloodPage />);

    await act(async () => {
      vi.advanceTimersByTime(45_000);
    });

    expect(screen.getByText(OFFLINE_NOTICE)).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(2);
  });

  it("shows the standard error with Retry, not old data, when the API answers with an error (decision N5)", async () => {
    savedBanks();
    stubBlood({ banks: () => json({ detail: "x" }, 500) });
    render(<BloodPage />);

    expect(await screen.findByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.queryByText(OFFLINE_NOTICE)).toBeNull();
    expect(screen.queryByRole("article")).toBeNull();
  });

  it("shows the standard error with Retry when there is no network and no saved copy", async () => {
    stubBlood({ banks: NETWORK_DOWN });
    render(<BloodPage />);

    expect(await screen.findByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.queryByText(/Offline/)).toBeNull();
  });

  it("shows the standard error when the saved copy is damaged", async () => {
    window.localStorage.setItem(BLOOD_COPY_KEY, "{not json");
    stubBlood({ banks: NETWORK_DOWN });
    render(<BloodPage />);

    expect(await screen.findByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("has a 'Try again' button of 48 px, and the live list comes back when the network is back", async () => {
    savedBanks();
    let attempts = 0;
    stubBlood({ banks: () => (++attempts === 1 ? NETWORK_DOWN(new URLSearchParams()) : json({ items: [bloodBank({ name: "Fresh Blood Bank" })], total: 1 })) });
    render(<BloodPage />);
    await screen.findByText(OFFLINE_NOTICE);
    const tryAgain = screen.getByRole("button", { name: "Try again" });
    expect(tryAgain.className).toMatch(/min-h-\[50px\]|min-h-12/);

    await userEvent.click(tryAgain);

    await waitFor(() => expect(screen.queryByText(OFFLINE_NOTICE)).toBeNull());
    expect(await screen.findByRole("heading", { level: 3, name: "Fresh Blood Bank" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("stays offline, with the notice, when Try again finds the network still down", async () => {
    savedBanks();
    stubBlood({ banks: NETWORK_DOWN });
    render(<BloodPage />);
    await screen.findByText(OFFLINE_NOTICE);

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText(OFFLINE_NOTICE)).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(2);
  });

  it("does not show the offline notice when the network works", async () => {
    savedBanks();
    stubBlood({ banks: () => json({ items: [bloodBank()], total: 1 }) });
    render(<BloodPage />);

    await screen.findByRole("article");

    expect(screen.queryByText(/Offline/)).toBeNull();
  });

  it("never shows 'Sponsored', and Donate blood has no offline mode (decision N1)", async () => {
    savedBanks();
    stubBlood({ banks: NETWORK_DOWN, centres: NETWORK_DOWN });
    const { container, unmount } = render(<BloodPage />);
    await screen.findByText(OFFLINE_NOTICE);
    expect(container.textContent).not.toContain("Sponsored");
    unmount();

    render(<DonateBloodPage />);

    expect(await screen.findByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.queryByText(/Offline/)).toBeNull();
  });
});

describe("what is never done", () => {
  it("keeps the position out of storage beyond the tab, and writes nothing to the console", () => {
    for (const file of ["components/blood/BloodFinder.tsx", "components/blood/DonateBlood.tsx", "hooks/usePagedList.ts", "lib/api/blood.ts"]) {
      expect(readSource(file)).not.toMatch(/localStorage|console\./);
    }
  });
});
