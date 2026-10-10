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
    expect(parametersOfCalls).toContainEqual({ is_24_hours: "true", limit: "1", offset: "0", lat: "6.452", lng: "7.51" });
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
