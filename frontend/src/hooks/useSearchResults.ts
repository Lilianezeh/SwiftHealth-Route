"use client";

/** Loads the results of a search in the browser, with the time limits of the UI spec. Requirements: US-01, US-05,
 * FR-04, FR-05, FR-06, NFR-07. UI spec 2.3 and "Standard states".
 *
 * - "loading", then "slow" after 5 seconds (the page says the service is waking up), then "error" after 45 seconds.
 * - A new filter, a new position or Retry cancels the request in flight; an old answer never replaces a newer search.
 * - Load more asks for the next page and adds it. If it fails, the list stays and `loadMoreFailed` is set.
 * - `enabled` is false until the stored position has been read, so the first search already has it.
 * The position goes only to `searchListings` (as `lat` and `lng`); it is not kept anywhere else.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { PAGE_SIZE } from "@/config/search";
import { RequestCancelledError } from "@/lib/api/request";
import { searchListings, type Position } from "@/lib/api/search";
import { filtersToQuery, queryToFilters, type SearchFilters } from "@/lib/search/searchQuery";
import type { ListingSummary } from "@/types/api";

export type SearchStatusName = "loading" | "slow" | "ready" | "error";

type ResultsState = {
  status: SearchStatusName;
  items: ListingSummary[];
  total: number;
  isLoadingMore: boolean;
  loadMoreFailed: boolean;
};

const LOADING: ResultsState = { status: "loading", items: [], total: 0, isLoadingMore: false, loadMoreFailed: false };

export function useSearchResults(filters: SearchFilters, position: Position | null, enabled: boolean) {
  const [state, setState] = useState<ResultsState>(LOADING);
  const [attempt, setAttempt] = useState(0);
  const loadMoreController = useRef<AbortController | null>(null);

  // The effect depends on values that only change when the search changes, not on a new object every render.
  const query = filtersToQuery(filters);
  const stableFilters = useMemo(() => queryToFilters(query), [query]);
  const latitude = position?.latitude ?? null;
  const longitude = position?.longitude ?? null;
  const stablePosition = useMemo<Position | null>(
    () => (latitude === null || longitude === null ? null : { latitude, longitude }),
    [latitude, longitude],
  );

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setState(LOADING);
    searchListings(stableFilters, stablePosition, { limit: PAGE_SIZE, offset: 0 }, {
      signal: controller.signal,
      onSlow: () => setState((current) => (current.status === "loading" ? { ...current, status: "slow" } : current)),
    })
      .then((response) => {
        if (controller.signal.aborted) return; // a newer search has started
        setState({ ...LOADING, status: "ready", items: response.items, total: response.total });
      })
      .catch((error: unknown) => {
        if (error instanceof RequestCancelledError || controller.signal.aborted) return;
        setState({ ...LOADING, status: "error" });
      });
    return () => {
      controller.abort();
      loadMoreController.current?.abort();
    };
  }, [enabled, stableFilters, stablePosition, attempt]);

  const retry = useCallback(() => setAttempt((current) => current + 1), []);

  const loadedCount = state.items.length;
  const canLoadMore = state.status === "ready" && !state.isLoadingMore;
  const loadMore = useCallback(() => {
    if (!canLoadMore) return;
    const controller = new AbortController();
    loadMoreController.current = controller;
    setState((current) => ({ ...current, isLoadingMore: true, loadMoreFailed: false }));
    searchListings(stableFilters, stablePosition, { limit: PAGE_SIZE, offset: loadedCount }, { signal: controller.signal })
      .then((response) => {
        if (controller.signal.aborted) return;
        setState((current) => {
          const known = new Set(current.items.map((item) => item.id)); // the order can shift between pages
          const added = response.items.filter((item) => !known.has(item.id));
          return { ...current, items: [...current.items, ...added], total: response.total, isLoadingMore: false };
        });
      })
      .catch((error: unknown) => {
        if (error instanceof RequestCancelledError || controller.signal.aborted) return;
        setState((current) => ({ ...current, isLoadingMore: false, loadMoreFailed: true }));
      });
  }, [canLoadMore, stableFilters, stablePosition, loadedCount]);

  return { ...state, hasMore: state.status === "ready" && loadedCount < state.total, retry, loadMore };
}
