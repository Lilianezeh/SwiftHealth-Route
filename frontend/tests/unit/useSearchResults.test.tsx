// @vitest-environment jsdom
/** Tests for the useSearchResults hook. Requirements: US-01, US-05, FR-04, FR-05, FR-06, NFR-07.
 * UI spec 2.3 and "Standard states": skeleton, "waking up" after 5 s, error after 45 s, Load more, a new search cancels the old.
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useSearchResults } from "@/hooks/useSearchResults";
import type { SearchFilters } from "@/lib/search/searchQuery";

import { json, listing, manyListings, neverAnswers, stubApi } from "../helpers/api";

const POSITION = { latitude: 6.452, longitude: 7.51 };
const NO_FILTERS: SearchFilters = {};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useSearchResults", () => {
  it("starts in the loading state with nothing to show", () => {
    stubApi({ search: neverAnswers });
    const { result } = renderHook(() => useSearchResults(NO_FILTERS, null, true));

    expect(result.current.status).toBe("loading");
    expect(result.current.items).toEqual([]);
  });

  it("asks for the first 20 with the filters and the position, and returns the items and the total", async () => {
    const { searches } = stubApi({ search: () => json({ items: [listing()], total: 1 }) });
    const { result } = renderHook(() =>
      useSearchResults({ q: "nigt", category: "pharmacy", open_now: true }, POSITION, true),
    );

    await waitFor(() => expect(result.current.status).toBe("ready"));

    expect(result.current.items).toHaveLength(1);
    expect(result.current.total).toBe(1);
    expect(Object.fromEntries(searches()[0].searchParams)).toEqual({
      q: "nigt", category: "pharmacy", open_now: "true", lat: "6.452", lng: "7.51", limit: "20", offset: "0",
    });
  });

  it("makes no request until it is enabled (the position has been read)", async () => {
    const { fetchStub } = stubApi({ search: () => json({ items: [], total: 0 }) });
    const { rerender } = renderHook(({ enabled }) => useSearchResults(NO_FILTERS, null, enabled), {
      initialProps: { enabled: false },
    });
    expect(fetchStub).not.toHaveBeenCalled();

    rerender({ enabled: true });

    await waitFor(() => expect(fetchStub).toHaveBeenCalledTimes(1));
  });

  it("says 'slow' after 5 seconds and 'error' after 45 seconds without an answer", async () => {
    vi.useFakeTimers();
    stubApi({ search: neverAnswers });
    const { result } = renderHook(() => useSearchResults(NO_FILTERS, null, true));

    await act(async () => {
      vi.advanceTimersByTime(4_999);
    });
    expect(result.current.status).toBe("loading");

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.status).toBe("slow");

    await act(async () => {
      vi.advanceTimersByTime(40_000);
    });
    expect(result.current.status).toBe("error");
  });

  it("is an error for a server error, and retry() asks again", async () => {
    let attempts = 0;
    const { searches } = stubApi({
      search: () => (++attempts === 1 ? json({ detail: "down" }, 500) : json({ items: [listing()], total: 1 })),
    });
    const { result } = renderHook(() => useSearchResults(NO_FILTERS, null, true));
    await waitFor(() => expect(result.current.status).toBe("error"));

    act(() => result.current.retry());
    expect(result.current.status).toBe("loading");

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(searches()).toHaveLength(2);
  });

  it("Load more asks for the next 20 (offset 20), adds them, and hasMore goes when all are shown", async () => {
    const { searches } = stubApi({
      search: (parameters) =>
        json({ items: manyListings(parameters.get("offset") === "0" ? 20 : 5, parameters.get("offset") === "0" ? 1 : 21), total: 25 }),
    });
    const { result } = renderHook(() => useSearchResults(NO_FILTERS, null, true));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.items).toHaveLength(20);
    expect(result.current.hasMore).toBe(true);

    act(() => result.current.loadMore());
    expect(result.current.isLoadingMore).toBe(true);
    await waitFor(() => expect(result.current.items).toHaveLength(25));

    expect(searches()[1].searchParams.get("offset")).toBe("20");
    expect(searches()[1].searchParams.get("limit")).toBe("20");
    expect(result.current.hasMore).toBe(false);
    expect(result.current.isLoadingMore).toBe(false);
  });

  it("keeps the items and says so when Load more fails, and works when tried again", async () => {
    let loadMoreAttempts = 0;
    stubApi({
      search: (parameters) => {
        if (parameters.get("offset") === "0") return json({ items: manyListings(20), total: 25 });
        return ++loadMoreAttempts === 1 ? json({ detail: "down" }, 500) : json({ items: manyListings(5, 21), total: 25 });
      },
    });
    const { result } = renderHook(() => useSearchResults(NO_FILTERS, null, true));
    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.loadMoreFailed).toBe(true));
    expect(result.current.items).toHaveLength(20);
    expect(result.current.status).toBe("ready");

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.items).toHaveLength(25));
    expect(result.current.loadMoreFailed).toBe(false);
  });

  it("does not show the same listing twice if the order shifted between pages", async () => {
    stubApi({
      search: (parameters) =>
        parameters.get("offset") === "0"
          ? json({ items: manyListings(20), total: 22 })
          : json({ items: manyListings(3, 20), total: 22 }), // id 20 is repeated
    });
    const { result } = renderHook(() => useSearchResults(NO_FILTERS, null, true));
    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.items).toHaveLength(22));

    expect(new Set(result.current.items.map((item) => item.id)).size).toBe(22);
  });

  it("a new filter cancels the request in flight, and the old answer never replaces the new one", async () => {
    const answers: Array<{ signal?: AbortSignal; respond: (response: Response) => void }> = [];
    stubApi({
      search: (_parameters, signal) =>
        new Promise<Response>((respond) => {
          answers.push({ signal, respond });
        }),
    });
    const { result, rerender } = renderHook(({ filters }) => useSearchResults(filters, null, true), {
      initialProps: { filters: { category: "pharmacy" } as SearchFilters },
    });
    await waitFor(() => expect(answers).toHaveLength(1));

    rerender({ filters: { category: "hospital" } });
    await waitFor(() => expect(answers).toHaveLength(2));
    expect(answers[0].signal?.aborted).toBe(true);

    await act(async () => {
      answers[1].respond(json({ items: [listing({ id: 2, name: "City Hospital" })], total: 1 }));
    });
    await waitFor(() => expect(result.current.status).toBe("ready"));

    await act(async () => {
      answers[0].respond(json({ items: [listing({ id: 1, name: "Late Pharmacy" })], total: 1 })); // too late
    });
    expect(result.current.items.map((item) => item.name)).toEqual(["City Hospital"]);
  });

  it("asks again, with lat and lng, when the position arrives", async () => {
    const { searches } = stubApi({ search: () => json({ items: [], total: 0 }) });
    const { rerender } = renderHook(({ position }) => useSearchResults(NO_FILTERS, position, true), {
      initialProps: { position: null as typeof POSITION | null },
    });
    await waitFor(() => expect(searches()).toHaveLength(1));
    expect(searches()[0].searchParams.has("lat")).toBe(false);

    rerender({ position: POSITION });

    await waitFor(() => expect(searches()).toHaveLength(2));
    expect(searches()[1].searchParams.get("lat")).toBe("6.452");
  });
});
