"use client";

/** Loads SwiftRescue's contacts in the browser. Requirements: FR-14 to FR-17, NFR-03, NFR-07. UI spec 2.5.
 *
 * - The first request has no position. Its answer is saved for offline use and shown at once (decision A5).
 * - If there is a position, a second request adds the distances and replaces the list on screen. If it fails, the first answer stays.
 * - "loading", "slow" after 5 seconds, "error" after 45 seconds (UI spec, standard states).
 * - When the network fails (or times out) and a saved copy exists, the status is "offline" and the copy is shown with its date.
 *   An error answer of the API is an "error", never "offline".
 */
import { useCallback, useEffect, useMemo, useState } from "react";

import { getEmergency } from "@/lib/api/emergency";
import { ApiNetworkError, ApiTimeoutError, RequestCancelledError } from "@/lib/api/request";
import type { Position } from "@/lib/api/search";
import { readOfflineCopy, saveOfflineCopy } from "@/lib/emergency/offlineCopy";
import type { EmergencyResponse } from "@/types/api";

export type EmergencyStatus = "loading" | "slow" | "ready" | "offline" | "error";

type BaseState = { status: EmergencyStatus; response: EmergencyResponse | null; savedAt: string | null };

const LOADING: BaseState = { status: "loading", response: null, savedAt: null };

export function useEmergency(position: Position | null, enabled: boolean) {
  const [base, setBase] = useState<BaseState>(LOADING);
  const [withDistances, setWithDistances] = useState<EmergencyResponse | null>(null);
  const [attempt, setAttempt] = useState(0);

  const latitude = position?.latitude ?? null;
  const longitude = position?.longitude ?? null;
  const stablePosition = useMemo<Position | null>(
    () => (latitude === null || longitude === null ? null : { latitude, longitude }),
    [latitude, longitude],
  );

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setBase(LOADING);
    setWithDistances(null);
    getEmergency(null, {
      signal: controller.signal,
      onSlow: () => setBase((current) => (current.status === "loading" ? { ...current, status: "slow" } : current)),
    })
      .then((response) => {
        if (controller.signal.aborted) return;
        saveOfflineCopy(response);
        setBase({ status: "ready", response, savedAt: null });
      })
      .catch((error: unknown) => {
        if (error instanceof RequestCancelledError || controller.signal.aborted) return;
        const networkFailed = error instanceof ApiNetworkError || error instanceof ApiTimeoutError;
        const copy = networkFailed ? readOfflineCopy() : null;
        setBase(
          copy
            ? { status: "offline", response: copy.response, savedAt: copy.savedAt }
            : { status: "error", response: null, savedAt: null },
        );
      });
    return () => controller.abort();
  }, [enabled, attempt]);

  const baseIsReady = base.status === "ready";
  useEffect(() => {
    setWithDistances(null);
    if (!baseIsReady || !stablePosition) return;
    const controller = new AbortController();
    getEmergency(stablePosition, { signal: controller.signal })
      .then((response) => {
        if (!controller.signal.aborted) setWithDistances(response);
      })
      .catch(() => {
        // the first answer stays on screen: distances are an extra
      });
    return () => controller.abort();
  }, [baseIsReady, stablePosition]);

  const retry = useCallback(() => setAttempt((current) => current + 1), []);

  return { ...base, response: withDistances ?? base.response, retry };
}
