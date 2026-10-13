"use client";

/** Loads one listing in the browser, with the time limits of the UI spec. Requirements: FR-09, US-06, NFR-07. UI spec 2.4 and "Standard states".
 * Spec: specs/2026-10-13-listing-page/requirements.md D8.
 *
 * - "loading", then "slow" after 5 seconds (the page says the service is waking up), then "error" after 45 seconds.
 * - "not-found" when the API answers 404 (an unknown slug, or a listing that is not published).
 * - A new slug or Retry cancels the request in flight; an old answer never replaces a newer one.
 * The request is `GET /listings/<slug>` with no query string: the visitor's position is not read or sent here (NFR-07).
 */
import { useCallback, useEffect, useState } from "react";

import { getListing } from "@/lib/api/listing";
import { RequestCancelledError } from "@/lib/api/request";
import type { ListingDetail } from "@/types/api";

export type ListingStatusName = "loading" | "slow" | "ready" | "not-found" | "error";

type ListingState = { status: ListingStatusName; listing: ListingDetail | null };

const LOADING: ListingState = { status: "loading", listing: null };

export function useListing(slug: string) {
  const [state, setState] = useState<ListingState>(LOADING);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState(LOADING);
    getListing(slug, {
      signal: controller.signal,
      onSlow: () => setState((current) => (current.status === "loading" ? { ...current, status: "slow" } : current)),
    })
      .then((listing) => {
        if (controller.signal.aborted) return; // a newer request has started
        setState(listing ? { status: "ready", listing } : { status: "not-found", listing: null });
      })
      .catch((error: unknown) => {
        if (error instanceof RequestCancelledError || controller.signal.aborted) return;
        setState({ status: "error", listing: null });
      });
    return () => controller.abort();
  }, [slug, attempt]);

  const retry = useCallback(() => setAttempt((current) => current + 1), []);

  return { ...state, retry };
}
