"use client";

/** Loads a list that comes in pages (the blood banks, the donation centres, the staff report queue and re-checks), with the
 * time limits of the UI spec. Requirements: US-15, US-16, US-11, US-12, FR-27, FR-28, FR-35, NFR-07. UI spec "Standard states".
 *
 * - "loading", then "slow" after 5 seconds (the page says the service is waking up), then "error" after 45 seconds.
 * - A new `key` (a new blood group, a new position) or Retry cancels the request in flight; an old answer never replaces a newer one.
 * - Load more asks for the next page and adds it. If it fails, the list stays and `loadMoreFailed` is set.
 * - `enabled` is false until the stored position has been read, so the first request already has it.
 * `fetchPage` is called with the page and the request options; it should use the values that `key` stands for.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { PAGE_SIZE } from "@/config/search";
import { RequestCancelledError, type RequestOptions } from "@/lib/api/request";
import type { Page } from "@/lib/api/search";

export type PagedListStatus = "loading" | "slow" | "ready" | "error";

type PagedAnswer<Item> = { items: Item[]; total: number };
type FetchPage<Item> = (page: Page, options: RequestOptions) => Promise<PagedAnswer<Item>>;

type ListState<Item> = {
  status: PagedListStatus;
  items: Item[];
  total: number;
  isLoadingMore: boolean;
  loadMoreFailed: boolean;
};

function loadingState<Item>(): ListState<Item> {
  return { status: "loading", items: [], total: 0, isLoadingMore: false, loadMoreFailed: false };
}

export function usePagedList<Item extends { id: number }>(key: string, fetchPage: FetchPage<Item>, enabled: boolean) {
  const [state, setState] = useState<ListState<Item>>(loadingState);
  const [attempt, setAttempt] = useState(0);
  const loadMoreController = useRef<AbortController | null>(null);
  // The latest fetchPage, so the effect only starts again when `key` changes, not on every render.
  const latestFetchPage = useRef(fetchPage);
  latestFetchPage.current = fetchPage;

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setState(loadingState);
    latestFetchPage
      .current(
        { limit: PAGE_SIZE, offset: 0 },
        {
          signal: controller.signal,
          onSlow: () => setState((current) => (current.status === "loading" ? { ...current, status: "slow" } : current)),
        },
      )
      .then((answer) => {
        if (controller.signal.aborted) return; // a newer request has started
        setState({ ...loadingState<Item>(), status: "ready", items: answer.items, total: answer.total });
      })
      .catch((error: unknown) => {
        if (error instanceof RequestCancelledError || controller.signal.aborted) return;
        setState({ ...loadingState<Item>(), status: "error" });
      });
    return () => {
      controller.abort();
      loadMoreController.current?.abort();
    };
  }, [enabled, key, attempt]);

  const retry = useCallback(() => setAttempt((current) => current + 1), []);

  /** Takes one item out of the list (a report that was just closed) without asking the API again. */
  const remove = useCallback((id: number) => {
    setState((current) => {
      if (!current.items.some((item) => item.id === id)) return current;
      return { ...current, items: current.items.filter((item) => item.id !== id), total: Math.max(0, current.total - 1) };
    });
  }, []);

  const loadedCount = state.items.length;
  const canLoadMore = state.status === "ready" && !state.isLoadingMore;
  const loadMore = useCallback(() => {
    if (!canLoadMore) return;
    const controller = new AbortController();
    loadMoreController.current = controller;
    setState((current) => ({ ...current, isLoadingMore: true, loadMoreFailed: false }));
    latestFetchPage
      .current({ limit: PAGE_SIZE, offset: loadedCount }, { signal: controller.signal })
      .then((answer) => {
        if (controller.signal.aborted) return;
        setState((current) => {
          const known = new Set(current.items.map((item) => item.id)); // the order can shift between pages
          const added = answer.items.filter((item) => !known.has(item.id));
          return { ...current, items: [...current.items, ...added], total: answer.total, isLoadingMore: false };
        });
      })
      .catch((error: unknown) => {
        if (error instanceof RequestCancelledError || controller.signal.aborted) return;
        setState((current) => ({ ...current, isLoadingMore: false, loadMoreFailed: true }));
      });
  }, [canLoadMore, loadedCount]);

  return { ...state, hasMore: state.status === "ready" && loadedCount < state.total, retry, loadMore, remove };
}
