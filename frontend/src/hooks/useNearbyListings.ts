"use client";

/** Loads the closest listings for one "near you" card, up to `limit`. Requirements: FR-03, US-01, FR-04. UI spec 2.2, item 6.
 *
 * Each card has its own hook, so the two cards load independently: one can fail or wait while the other is shown. The 24-hour card asks for
 * two results so that it can move on when its first one is the pharmacy card's place (D9 of specs/2026-10-15-find-by-type/).
 * With a position the API sorts by distance; with only an area it is sent as `area` and there is no distance.
 * The caller gives the cards a `key` that changes with the position and the area, so a new place starts a new load.
 */
import { useCallback, useEffect, useMemo, useState } from "react";

import { RequestCancelledError } from "@/lib/api/request";
import { searchListings, type Position } from "@/lib/api/search";
import type { SearchFilters } from "@/lib/search/searchQuery";
import type { ListingSummary } from "@/types/api";

export type NearbyState = {
  status: "loading" | "slow" | "ready" | "error"; // "slow": no answer after 5 seconds, the skeleton stays
  listings: ListingSummary[]; // empty when ready with no result
};

export function useNearbyListings(baseFilters: SearchFilters, position: Position | null, area: string | null, limit: number) {
  const [state, setState] = useState<NearbyState>({ status: "loading", listings: [] });
  const [attempt, setAttempt] = useState(0);
  const filters = useMemo<SearchFilters>(
    () => (position || !area ? baseFilters : { ...baseFilters, area }),
    [baseFilters, position, area],
  );

  useEffect(() => {
    const controller = new AbortController();
    searchListings(filters, position, { limit, offset: 0 }, {
      signal: controller.signal,
      onSlow: () => setState((current) => (current.status === "loading" ? { ...current, status: "slow" } : current)),
    })
      .then((response) => setState({ status: "ready", listings: response.items }))
      .catch((error: unknown) => {
        if (error instanceof RequestCancelledError) return; // replaced or left the page: not a failure
        setState({ status: "error", listings: [] });
      });
    return () => controller.abort();
  }, [filters, position, limit, attempt]);

  const retry = useCallback(() => {
    setState({ status: "loading", listings: [] });
    setAttempt((current) => current + 1);
  }, []);

  return { ...state, retry };
}
