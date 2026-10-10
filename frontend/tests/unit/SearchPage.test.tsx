// @vitest-environment jsdom
/** Tests for the /search page. Requirements: US-01, US-05, FR-04 to FR-08, NFR-04, NFR-07. UI spec 2.3. */
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SearchPage from "@/app/(public)/search/page";
import { resetMetaCache } from "@/lib/api/meta";
import { savePosition } from "@/lib/location/locationStore";

import { json, listing, manyListings, neverAnswers, stubApi } from "../helpers/api";
import { installDialogSupport } from "../helpers/dialog";
import { stubGeolocationPermission } from "../helpers/permission";
import { readSource } from "../helpers/source";

const navigation = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn(), query: "" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: navigation.replace, push: navigation.push }),
  useSearchParams: () => new URLSearchParams(navigation.query),
}));

beforeEach(() => {
  installDialogSupport();
  window.sessionStorage.clear();
  resetMetaCache();
  navigation.replace.mockReset();
  navigation.push.mockReset();
  navigation.query = "";
  stubGeolocationPermission("unsupported"); // like jsdom itself, unless a test adds a permission check
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("the /search page", () => {
  it("is a server page that puts the results in a Suspense part (they load in the browser)", () => {
    const source = readSource("app/(public)/search/page.tsx");

    expect(source).not.toMatch(/["']use client["']/);
    expect(source).toMatch(/<Suspense/);
  });

  it("has one h1, a search box and a Filters button", async () => {
    stubApi({});
    render(<SearchPage />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(await screen.findByRole("searchbox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filters" })).toBeInTheDocument();
  });

  it("reads its filters from the address (a shared link)", async () => {
    navigation.query = "category=pharmacy&open_now=true&q=nigt&service=X-ray&area=Ogui&is_24_hours=true";
    const { searches } = stubApi({ search: () => json({ items: [listing()], total: 1 }) });
    render(<SearchPage />);

    await screen.findByRole("article");

    expect(Object.fromEntries(searches()[0].searchParams)).toEqual({
      q: "nigt", category: "pharmacy", service: "X-ray", area: "Ogui", open_now: "true", is_24_hours: "true",
      limit: "20", offset: "0",
    });
  });

  it("ignores lat and lng in the address (a shared link holds no position)", async () => {
    navigation.query = "category=pharmacy&lat=6.1&lng=7.2";
    const { searches } = stubApi({ search: () => json({ items: [], total: 0 }) });
    render(<SearchPage />);

    await screen.findByText(/No matches/);

    expect(searches()[0].searchParams.has("lat")).toBe(false);
    expect(searches()[0].searchParams.has("lng")).toBe(false);
  });

  it("sends lat and lng from the session store to the API, and does not put them in the address or the page", async () => {
    savePosition({ latitude: 6.101, longitude: 7.202 });
    const { searches } = stubApi({ search: () => json({ items: [listing()], total: 1 }) });
    const { container } = render(<SearchPage />);

    expect(await screen.findByText("1 place, nearest first")).toBeInTheDocument();

    expect(searches()).toHaveLength(1); // it waited for the stored position, so no first search without it
    expect(searches()[0].searchParams.get("lat")).toBe("6.101");
    expect(searches()[0].searchParams.get("lng")).toBe("7.202");
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(navigation.push).not.toHaveBeenCalled();
    expect(container.innerHTML).not.toMatch(/6\.101|7\.202/);
  });

  it("does not use a stored position when the browser says the site is blocked: one search, without lat or lng, A to Z", async () => {
    savePosition({ latitude: 6.101, longitude: 7.202 });
    stubGeolocationPermission("denied");
    const { searches } = stubApi({ search: () => json({ items: [listing({ distance_km: null })], total: 1 }) });
    render(<SearchPage />);

    expect(await screen.findByText("1 place, A to Z")).toBeInTheDocument();

    expect(searches()).toHaveLength(1); // it waited for the permission check, so no first search with the old position
    expect(searches()[0].searchParams.has("lat")).toBe(false);
    expect(searches()[0].searchParams.has("lng")).toBe(false);
  });

  it("without a position, shows 'A to Z' and the distance is not available", async () => {
    stubApi({ search: () => json({ items: manyListings(3), total: 3 }) });
    render(<SearchPage />);

    expect(await screen.findByText("3 places, A to Z")).toBeInTheDocument();
  });

  it("pre-fills the main search box from q, and keeps the other filters when searching again", async () => {
    navigation.query = "q=nigt&category=pharmacy&open_now=true";
    stubApi({});
    render(<SearchPage />);

    const box = await screen.findByRole("searchbox");
    expect(box).toHaveValue("nigt");

    const form = screen.getByRole("search");
    const hidden = [...form.querySelectorAll("input[type=hidden]")].map((input) => [
      input.getAttribute("name"), input.getAttribute("value"),
    ]);
    expect(hidden).toEqual([["category", "pharmacy"], ["open_now", "true"]]);
  });

  it("shows skeleton cards while loading, then the waking-up sentence after 5 seconds", async () => {
    vi.useFakeTimers();
    stubApi({ search: neverAnswers });
    const { container } = render(<SearchPage />);
    await act(async () => {}); // the stored position is read

    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText(/waking up/)).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });
    expect(screen.getByRole("status")).toHaveTextContent("The service is waking up. This can take up to a minute.");
  });

  it("shows the error with Retry for a server error, and Retry searches again", async () => {
    let attempts = 0;
    const { searches } = stubApi({
      search: () => (++attempts === 1 ? json({ detail: "down" }, 500) : json({ items: [listing()], total: 1 })),
    });
    render(<SearchPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Retry" }));

    expect(await screen.findByRole("article")).toBeInTheDocument();
    expect(searches()).toHaveLength(2);
  });

  it("shows the empty state", async () => {
    stubApi({ search: () => json({ items: [], total: 0 }) });
    render(<SearchPage />);

    expect(await screen.findByText("No matches. Try removing a filter or widening the distance.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });

  it("Load more asks for the next 20 and adds them; the button goes when everything is shown", async () => {
    const { searches } = stubApi({
      search: (parameters) =>
        parameters.get("offset") === "0"
          ? json({ items: manyListings(20), total: 25 })
          : json({ items: manyListings(5, 21), total: 25 }),
    });
    const { container } = render(<SearchPage />);
    // Counting by tag name (not by role) keeps this test fast: 25 cards are many elements for jsdom to inspect.
    const cardCount = () => container.querySelectorAll("article").length;
    await screen.findByText("Place 20");
    expect(cardCount()).toBe(20);
    expect(screen.getByText("25 places, A to Z")).toBeInTheDocument();

    await userEvent.click(screen.getByText("Load more"));

    await screen.findByText("Place 25");
    expect(cardCount()).toBe(25);
    expect(searches()[1].searchParams.get("offset")).toBe("20");
    expect(screen.queryByText("Load more")).not.toBeInTheDocument();
    expect(navigation.replace).not.toHaveBeenCalled(); // page state, not in the address
  });

  it("says so, and keeps the list, when Load more fails", async () => {
    stubApi({
      search: (parameters) =>
        parameters.get("offset") === "0" ? json({ items: manyListings(20), total: 25 }) : json({ detail: "down" }, 500),
    });
    render(<SearchPage />);
    await screen.findAllByRole("article");

    await userEvent.click(screen.getByRole("button", { name: "Load more" }));

    expect(await screen.findByText("We couldn't load more. Check your connection and try again.")).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(20);
    expect(screen.getByRole("button", { name: "Load more" })).toBeInTheDocument();
  });

  it("shows the amber 'Verification due' label on an overdue listing (FR-08)", async () => {
    stubApi({ search: () => json({ items: [listing({ verification_due: true })], total: 1 }) });
    render(<SearchPage />);

    expect(within(await screen.findByRole("article")).getByText("Verification due")).toBeInTheDocument();
  });

  it("applying filters from the dialog replaces the address (no lat or lng)", async () => {
    savePosition({ latitude: 6.101, longitude: 7.202 });
    stubApi({ search: () => json({ items: [listing()], total: 1 }) });
    render(<SearchPage />);
    await screen.findByRole("article");

    await userEvent.click(screen.getByRole("button", { name: "Filters" }));
    const dialog = screen.getByRole("dialog", { hidden: true });
    await within(dialog).findByRole("option", { name: "Pharmacy" });
    await userEvent.click(within(dialog).getByRole("checkbox", { name: "Open now" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Apply" }));

    expect(navigation.replace).toHaveBeenCalledWith("/search?open_now=true");
  });
});
