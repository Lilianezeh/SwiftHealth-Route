"use client";

/** Loads the staff list of listings with the token, 20 at a time. Requirements: FR-31, FR-42, NFR-06. UI spec 3.3.
 * "loading", then "ready" or "error". A new filter cancels the request in flight and starts again from the first page; Load more
 * asks for the next page and adds it (a failure keeps the list and sets `loadMoreFailed`). A 401 is handled by the gate's `call`.
 */
import { useCallback, useEffect, useMemo, useState } from "react";

import { useStaff } from "@/components/admin/StaffGate";
import { listStaffListings } from "@/lib/api/staff";
import { RequestCancelledError } from "@/lib/api/request";
import type { StaffListParams, StaffListingSummary } from "@/types/staff";

const PAGE_SIZE = 20;

type State = {
  status: "loading" | "ready" | "error";
  items: StaffListingSummary[];
  total: number;
  isLoadingMore: boolean;
  loadMoreFailed: boolean;
};

const LOADING: State = { status: "loading", items: [], total: 0, isLoadingMore: false, loadMoreFailed: false };

export function useStaffListings(filters: Omit<StaffListParams, "limit" | "offset">) {
  const { call } = useStaff();
  const [state, setState] = useState<State>(LOADING);
  const [attempt, setAttempt] = useState(0);

  const key = JSON.stringify(filters);
  const stableFilters = useMemo(() => JSON.parse(key) as Omit<StaffListParams, "limit" | "offset">, [key]);

  useEffect(() => {
    const controller = new AbortController();
    setState(LOADING);
    call((token) => listStaffListings(token, { ...stableFilters, limit: PAGE_SIZE, offset: 0 }, { signal: controller.signal }))
      .then((list) => {
        if (!controller.signal.aborted) setState({ ...LOADING, status: "ready", items: list.items, total: list.total });
      })
      .catch((error: unknown) => {
        if (error instanceof RequestCancelledError || controller.signal.aborted) return;
        setState({ ...LOADING, status: "error" });
      });
    return () => controller.abort();
  }, [call, stableFilters, attempt]);

  const loadedCount = state.items.length;
  const loadMore = useCallback(() => {
    if (state.status !== "ready" || state.isLoadingMore) return;
    setState((current) => ({ ...current, isLoadingMore: true, loadMoreFailed: false }));
    call((token) => listStaffListings(token, { ...stableFilters, limit: PAGE_SIZE, offset: loadedCount }))
      .then((list) => {
        setState((current) => {
          const known = new Set(current.items.map((item) => item.id));
          const added = list.items.filter((item) => !known.has(item.id));
          return { ...current, items: [...current.items, ...added], total: list.total, isLoadingMore: false };
        });
      })
      .catch(() => setState((current) => ({ ...current, isLoadingMore: false, loadMoreFailed: true })));
  }, [call, state.status, state.isLoadingMore, stableFilters, loadedCount]);

  const retry = useCallback(() => setAttempt((current) => current + 1), []);

  return { ...state, hasMore: state.status === "ready" && loadedCount < state.total, loadMore, retry };
}
