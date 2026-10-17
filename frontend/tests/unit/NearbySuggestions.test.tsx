// @vitest-environment jsdom
/** Tests for NearbySuggestions. Requirements: FR-03, US-01, FR-06, NFR-07.
 * UI spec 2.2, item 6: two independent cards (closest open pharmacy, closest open 24-hour place).
 */
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NearbySuggestions } from "@/components/search/NearbySuggestions";

import { json, listing, neverAnswers, stubApi } from "../helpers/api";

const POSITION = { latitude: 6.452, longitude: 7.51 };

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function pharmacyCard() {
  return screen.getByRole("region", { name: "Closest open pharmacy" });
}

function twentyFourHourCard() {
  return screen.getByRole("region", { name: "Closest open 24-hour place" });
}

/** Answers the pharmacy call and the 24-hour call differently. */
function answer(pharmacy: () => Response | Promise<Response>, twentyFourHour: () => Response | Promise<Response>) {
  return stubApi({ search: (parameters) => (parameters.get("category") === "pharmacy" ? pharmacy() : twentyFourHour()) });
}

describe("NearbySuggestions", () => {
  it("asks for one open pharmacy and one 24-hour place, both with the position", async () => {
    const { searches } = answer(() => json({ items: [], total: 0 }), () => json({ items: [], total: 0 }));
    render(<NearbySuggestions position={POSITION} area={null} />);

    await screen.findByText("No open pharmacy found nearby");

    const parametersOfCalls = searches().map((url) => Object.fromEntries(url.searchParams));
    expect(parametersOfCalls).toContainEqual({
      category: "pharmacy", open_now: "true", limit: "1", offset: "0", lat: "6.452", lng: "7.51",
    });
    // The 24-hour card asks for two results, so it can move on when the first is the pharmacy card's place (D9).
    expect(parametersOfCalls).toContainEqual({ is_24_hours: "true", limit: "2", offset: "0", lat: "6.452", lng: "7.51" });
    expect(parametersOfCalls).toHaveLength(2);
  });

  it("shows each result as a ListingCard with its distance", async () => {
    answer(
      () => json({ items: [listing({ name: "Night Pharmacy A", distance_km: 1.4 })], total: 1 }),
      () => json({ items: [listing({ id: 2, slug: "city-hospital", name: "City Hospital", distance_km: 2.1 })], total: 1 }),
    );
    render(<NearbySuggestions position={POSITION} area={null} />);

    expect(await within(pharmacyCard()).findByRole("link", { name: "Night Pharmacy A" })).toHaveAttribute(
      "href",
      "/listing/night-pharmacy-a",
    );
    expect(await within(twentyFourHourCard()).findByText("Pharmacy · 2.1 km")).toBeInTheDocument();
  });

  it("with an area and no position, asks by area, sends no lat or lng, and shows no distance", async () => {
    const { searches } = answer(
      () => json({ items: [listing({ distance_km: null })], total: 1 }),
      () => json({ items: [listing({ id: 2, name: "City Hospital", distance_km: null })], total: 1 }),
    );
    render(<NearbySuggestions position={null} area="Ogui" />);

    await within(pharmacyCard()).findByRole("link", { name: "Night Pharmacy A" });

    for (const url of searches()) {
      expect(url.searchParams.get("area")).toBe("Ogui");
      expect(url.searchParams.has("lat")).toBe(false);
      expect(url.searchParams.has("lng")).toBe(false);
    }
    expect(screen.queryByText(/ km/)).not.toBeInTheDocument();
  });

  it("makes no request without a position or an area", () => {
    const { fetchStub } = stubApi({});
    render(<NearbySuggestions position={null} area={null} />);

    expect(fetchStub).not.toHaveBeenCalled();
  });

  it("says so, with a link to all places, when a card has no result (never an empty card)", async () => {
    answer(() => json({ items: [], total: 0 }), () => json({ items: [], total: 0 }));
    render(<NearbySuggestions position={POSITION} area={null} />);

    expect(await within(pharmacyCard()).findByText("No open pharmacy found nearby")).toBeInTheDocument();
    expect(await within(twentyFourHourCard()).findByText("No 24-hour place found nearby")).toBeInTheDocument();
    expect(within(pharmacyCard()).getByRole("link", { name: "Search all places" })).toHaveAttribute("href", "/search");
    expect(within(twentyFourHourCard()).getByRole("link", { name: "Search all places" })).toHaveAttribute("href", "/search");
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  it("loads the two cards independently: one error does not stop the other", async () => {
    answer(() => json({ detail: "down" }, 500), () => json({ items: [listing({ name: "City Hospital" })], total: 1 }));
    render(<NearbySuggestions position={POSITION} area={null} />);

    expect(await within(twentyFourHourCard()).findByRole("link", { name: "City Hospital" })).toBeInTheDocument();
    expect(
      await within(pharmacyCard()).findByText("We couldn't load this. Check your connection and try again."),
    ).toBeInTheDocument();
    expect(within(twentyFourHourCard()).queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("Retry asks again for that card only", async () => {
    let pharmacyCalls = 0;
    const { searches } = answer(
      () => (++pharmacyCalls === 1 ? json({ detail: "down" }, 500) : json({ items: [listing()], total: 1 })),
      () => json({ items: [], total: 0 }),
    );
    render(<NearbySuggestions position={POSITION} area={null} />);
    await within(pharmacyCard()).findByRole("button", { name: "Retry" });
    expect(searches()).toHaveLength(2);

    await userEvent.click(within(pharmacyCard()).getByRole("button", { name: "Retry" }));

    expect(await within(pharmacyCard()).findByRole("link", { name: "Night Pharmacy A" })).toBeInTheDocument();
    expect(searches()).toHaveLength(3);
  });

  it("shows a skeleton while loading, then the waking-up notice after 5 seconds, then an error after 45 seconds", async () => {
    vi.useFakeTimers();
    stubApi({ search: neverAnswers });
    render(<NearbySuggestions position={POSITION} area={null} />);

    expect(pharmacyCard()).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText(/waking up/)).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });
    expect(within(pharmacyCard()).getByRole("status")).toHaveTextContent(
      "The service is waking up. This can take up to a minute.",
    );
    expect(pharmacyCard()).toHaveAttribute("aria-busy", "true"); // the skeleton stays

    await act(async () => {
      vi.advanceTimersByTime(40_000);
    });
    expect(
      within(pharmacyCard()).getByText("We couldn't load this. Check your connection and try again."),
    ).toBeInTheDocument();
  });

  it("has the button 'See all open places near me', a link to /search?open_now=true", async () => {
    answer(() => json({ items: [], total: 0 }), () => json({ items: [], total: 0 }));
    render(<NearbySuggestions position={POSITION} area={null} />);

    const link = await screen.findByRole("link", { name: "See all open places near me" });
    expect(link).toHaveAttribute("href", "/search?open_now=true");
    expect(link.className).toMatch(/min-h-\[50px\]/);
  });

  it("puts the area in that link when the visitor chose an area and there is no position", async () => {
    answer(() => json({ items: [], total: 0 }), () => json({ items: [], total: 0 }));
    render(<NearbySuggestions position={null} area="Ogui" />);

    expect(await screen.findByRole("link", { name: "See all open places near me" })).toHaveAttribute(
      "href",
      "/search?area=Ogui&open_now=true",
    );
  });

  it("never writes the position into an address or the page", async () => {
    // The visitor is far from the listing (6.452, 7.51), so the visitor's numbers can be told apart from the listing's.
    const visitor = { latitude: 6.101, longitude: 7.202 };
    answer(() => json({ items: [listing()], total: 1 }), () => json({ items: [], total: 0 }));
    const { container } = render(<NearbySuggestions position={visitor} area={null} />);
    await within(pharmacyCard()).findByRole("link", { name: "Night Pharmacy A" });

    for (const link of container.querySelectorAll("a")) {
      expect(link.getAttribute("href") ?? "").not.toMatch(/lat=|lng=|6\.101|7\.202/);
    }
    expect(container.innerHTML).not.toMatch(/6\.101|7\.202/);
  });
});

describe("NearbySuggestions hours line", () => {
  it("shows the hours_note of each near-you card, and nothing for a 24-hour place", async () => {
    answer(
      () => json({ items: [listing({ hours_note: "Closes 2:00 AM tomorrow" })], total: 1 }),
      () => json({ items: [listing({ id: 2, name: "All Night Pharmacy", is_24_hours: true, hours_note: null })], total: 1 }),
    );
    render(<NearbySuggestions position={POSITION} area={null} />);

    expect(await within(pharmacyCard()).findByText("Closes 2:00 AM tomorrow")).toBeInTheDocument();
    await within(twentyFourHourCard()).findByRole("link", { name: "All Night Pharmacy" });
    // "Closest open 24-hour place" is the card's title, so the pattern needs the space after the verb.
    expect(within(twentyFourHourCard()).queryByText(/^(Closes|Opens) /)).not.toBeInTheDocument();
  });
});

/** D9 of specs/2026-10-15-find-by-type/requirements.md (the owner's point 10, 2026-10-13): the two cards never show the same place twice. */
describe("NearbySuggestions never shows the same place twice", () => {
  const PHARMACY = listing({ id: 12, slug: "always-open-pharmacy", name: "Always Open Pharmacy" });
  const OTHER_24_HOURS = listing({ id: 30, slug: "city-night-clinic", name: "City Night Clinic", distance_km: 3.2 });
  const NONE = () => json({ items: [], total: 0 });

  function twentyFourHourResult(items: ReturnType<typeof listing>[]) {
    return () => json({ items, total: items.length });
  }

  it("asks for one open pharmacy and for two 24-hour places", async () => {
    const { searches } = answer(() => json({ items: [PHARMACY], total: 1 }), twentyFourHourResult([OTHER_24_HOURS]));
    render(<NearbySuggestions position={POSITION} area={null} />);

    await within(twentyFourHourCard()).findByRole("link", { name: "City Night Clinic" });

    const limits = searches().map((url) => [url.searchParams.get("category") ?? "24-hour", url.searchParams.get("limit")]);
    expect(limits).toContainEqual(["pharmacy", "1"]);
    expect(limits).toContainEqual(["24-hour", "2"]);
  });

  it("(a) two different answers show two cards", async () => {
    answer(() => json({ items: [PHARMACY], total: 1 }), twentyFourHourResult([OTHER_24_HOURS]));
    render(<NearbySuggestions position={POSITION} area={null} />);

    expect(await within(pharmacyCard()).findByRole("link", { name: "Always Open Pharmacy" })).toBeInTheDocument();
    expect(await within(twentyFourHourCard()).findByRole("link", { name: "City Night Clinic" })).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(2);
  });

  it("(b) when the same place is first in both, the 24-hour card shows the next 24-hour place", async () => {
    answer(() => json({ items: [PHARMACY], total: 1 }), twentyFourHourResult([PHARMACY, OTHER_24_HOURS]));
    render(<NearbySuggestions position={POSITION} area={null} />);

    expect(await within(twentyFourHourCard()).findByRole("link", { name: "City Night Clinic" })).toBeInTheDocument();
    expect(within(pharmacyCard()).getByRole("link", { name: "Always Open Pharmacy" })).toBeInTheDocument();
  });

  it("(c) the same place and no other 24-hour place: one card with both labels, spanning both columns", async () => {
    answer(() => json({ items: [PHARMACY], total: 1 }), twentyFourHourResult([PHARMACY]));
    const { container } = render(<NearbySuggestions position={POSITION} area={null} />);

    const card = await screen.findByRole("region", { name: /Closest open pharmacy.*Closest open 24-hour place/ });
    expect(within(card).getByText("Closest open pharmacy")).toBeInTheDocument();
    expect(within(card).getByText("Closest open 24-hour place")).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: "Always Open Pharmacy" })).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getAllByRole("region")).toHaveLength(1);
    expect(card.className).toMatch(/\bsm:col-span-2\b/);
    expect(container.querySelectorAll('a[href="/listing/always-open-pharmacy"]').length).toBeGreaterThanOrEqual(1);
  });

  it("(d) the 24-hour card never shows the listing of the pharmacy card", async () => {
    // Even when the 24-hour answer lists the pharmacy last, the other place is the one shown.
    answer(() => json({ items: [PHARMACY], total: 1 }), twentyFourHourResult([OTHER_24_HOURS, PHARMACY]));
    render(<NearbySuggestions position={POSITION} area={null} />);

    await within(twentyFourHourCard()).findByRole("link", { name: "City Night Clinic" });

    expect(within(twentyFourHourCard()).queryByRole("link", { name: "Always Open Pharmacy" })).not.toBeInTheDocument();
  });

  it("(e) a failure or an empty answer in one card does not change the other", async () => {
    answer(() => json({ detail: "down" }, 500), twentyFourHourResult([PHARMACY, OTHER_24_HOURS]));
    const { unmount } = render(<NearbySuggestions position={POSITION} area={null} />);
    // The pharmacy failed, so nothing is compared: the 24-hour card keeps its own first result.
    expect(await within(twentyFourHourCard()).findByRole("link", { name: "Always Open Pharmacy" })).toBeInTheDocument();
    expect(await within(pharmacyCard()).findByRole("button", { name: "Retry" })).toBeInTheDocument();
    unmount();

    answer(() => json({ items: [PHARMACY], total: 1 }), () => json({ detail: "down" }, 500));
    render(<NearbySuggestions position={POSITION} area={null} />);
    expect(await within(pharmacyCard()).findByRole("link", { name: "Always Open Pharmacy" })).toBeInTheDocument();
    expect(await within(twentyFourHourCard()).findByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("(f) the 24-hour card stays a skeleton until the pharmacy answer is in, so it never shows a place and then replaces it", async () => {
    let answerPharmacy: (response: Response) => void = () => {};
    const pharmacyAnswer = new Promise<Response>((resolve) => {
      answerPharmacy = resolve;
    });
    answer(() => pharmacyAnswer, twentyFourHourResult([PHARMACY, OTHER_24_HOURS]));
    render(<NearbySuggestions position={POSITION} area={null} />);

    // The 24-hour answer is in, but the pharmacy answer is not: nothing shows yet in the 24-hour card.
    await act(async () => {});
    expect(twentyFourHourCard()).toHaveAttribute("aria-busy", "true");
    expect(within(twentyFourHourCard()).queryByRole("link")).not.toBeInTheDocument();

    await act(async () => {
      answerPharmacy(json({ items: [PHARMACY], total: 1 }));
    });
    expect(await within(twentyFourHourCard()).findByRole("link", { name: "City Night Clinic" })).toBeInTheDocument();
    expect(within(twentyFourHourCard()).queryByRole("link", { name: "Always Open Pharmacy" })).not.toBeInTheDocument();
  });

  it("(g) with an empty pharmacy answer the 24-hour card shows its first result", async () => {
    answer(NONE, twentyFourHourResult([PHARMACY, OTHER_24_HOURS]));
    render(<NearbySuggestions position={POSITION} area={null} />);

    expect(await within(twentyFourHourCard()).findByRole("link", { name: "Always Open Pharmacy" })).toBeInTheDocument();
    expect(await within(pharmacyCard()).findByText("No open pharmacy found nearby")).toBeInTheDocument();
  });

  it("(h) Retry on the pharmacy card works out the pair again", async () => {
    let pharmacyCalls = 0;
    answer(
      () => (++pharmacyCalls === 1 ? json({ detail: "down" }, 500) : json({ items: [PHARMACY], total: 1 })),
      twentyFourHourResult([PHARMACY, OTHER_24_HOURS]),
    );
    render(<NearbySuggestions position={POSITION} area={null} />);
    expect(await within(twentyFourHourCard()).findByRole("link", { name: "Always Open Pharmacy" })).toBeInTheDocument();

    await userEvent.click(await within(pharmacyCard()).findByRole("button", { name: "Retry" }));

    // The pharmacy is now the same place, so the 24-hour card moves on to the next one.
    expect(await within(twentyFourHourCard()).findByRole("link", { name: "City Night Clinic" })).toBeInTheDocument();
    expect(within(pharmacyCard()).getByRole("link", { name: "Always Open Pharmacy" })).toBeInTheDocument();
  });

  it("with an area only, the rule is the same, no distance shows, and the address holds no position", async () => {
    const { searches } = answer(
      () => json({ items: [{ ...PHARMACY, distance_km: null }], total: 1 }),
      twentyFourHourResult([{ ...PHARMACY, distance_km: null }, { ...OTHER_24_HOURS, distance_km: null }]),
    );
    const { container } = render(<NearbySuggestions position={null} area="Ogui" />);

    expect(await within(twentyFourHourCard()).findByRole("link", { name: "City Night Clinic" })).toBeInTheDocument();
    expect(screen.queryByText(/ km/)).not.toBeInTheDocument();
    for (const url of searches()) expect(url.searchParams.has("lat") || url.searchParams.has("lng")).toBe(false);
    expect(container.innerHTML).not.toMatch(/lat=|lng=/);
  });
});
