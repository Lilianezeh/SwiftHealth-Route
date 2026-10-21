"use client";

/** Loads the numbers of the staff dashboard with the token, with the time limits of the UI spec. Requirements: US-11, FR-34,
 * NFR-07. UI spec 3.2 and "Standard states".
 * "loading", then "slow" after 5 seconds (the page says the service is waking up), then "error" after 45 seconds. Retry asks again.
 * A 401 is handled by the gate's `call`.
 */
import { useCallback, useEffect, useState } from "react";

import { useStaff } from "@/components/admin/StaffGate";
import { RequestCancelledError } from "@/lib/api/request";
import { getDashboardStats } from "@/lib/api/staff";
import type { DashboardStats } from "@/types/staff";

type StatsState = { status: "loading" | "slow" | "ready" | "error"; stats: DashboardStats | null };

export function useDashboardStats() {
  const { call } = useStaff();
  const [state, setState] = useState<StatsState>({ status: "loading", stats: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading", stats: null });
    call((token) =>
      getDashboardStats(token, {
        signal: controller.signal,
        onSlow: () => setState((current) => (current.status === "loading" ? { ...current, status: "slow" } : current)),
      }),
    )
      .then((stats) => {
        if (!controller.signal.aborted) setState({ status: "ready", stats });
      })
      .catch((error: unknown) => {
        if (error instanceof RequestCancelledError || controller.signal.aborted) return;
        setState({ status: "error", stats: null });
      });
    return () => controller.abort();
  }, [call, attempt]);

  const retry = useCallback(() => setAttempt((current) => current + 1), []);

  return { ...state, retry };
}
