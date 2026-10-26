"use client";

/** Loads the provider's own listing with the token, with the time limits of the UI spec. Requirements: FR-43, NFR-07.
 * UI spec 4.1 and "Standard states". "loading", then "slow" after 5 seconds (the page says the service is waking up), then
 * "error" after 45 seconds; "none" when no listing is linked to the account (answer 404). A 401 is handled by the gate's `call`.
 */
import { useCallback, useEffect, useState } from "react";

import { useStaff } from "@/components/admin/StaffGate";
import { ApiError, RequestCancelledError } from "@/lib/api/request";
import { getProviderListing } from "@/lib/api/provider";
import type { ProviderListing } from "@/types/staff";

type ProviderListingState = { status: "loading" | "slow" | "ready" | "error" | "none"; listing: ProviderListing | null };

export function useProviderListing(listingId?: number) {
  const { call } = useStaff();
  const [state, setState] = useState<ProviderListingState>({ status: "loading", listing: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading", listing: null });
    call((token) =>
      getProviderListing(
        token,
        {
          signal: controller.signal,
          onSlow: () => setState((current) => (current.status === "loading" ? { ...current, status: "slow" } : current)),
        },
        listingId,
      ),
    )
      .then((listing) => {
        if (!controller.signal.aborted) setState({ status: "ready", listing });
      })
      .catch((error: unknown) => {
        if (error instanceof RequestCancelledError || controller.signal.aborted) return;
        setState({ status: error instanceof ApiError && error.status === 404 ? "none" : "error", listing: null });
      });
    return () => controller.abort();
  }, [call, attempt, listingId]);

  const retry = useCallback(() => setAttempt((current) => current + 1), []);

  return { ...state, retry };
}
