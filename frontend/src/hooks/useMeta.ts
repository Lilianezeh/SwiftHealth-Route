"use client";

/** Loads the lists of GET /meta (areas, categories, services) in the browser. Requirements: FR-03, FR-05.
 * `getMeta` keeps the answer, so several components can call this hook and the API is asked once.
 */
import { useCallback, useEffect, useState } from "react";

import { getMeta } from "@/lib/api/meta";
import type { MetaResponse } from "@/types/api";

type MetaState = { status: "loading" | "ready" | "error"; meta: MetaResponse | null };

export function useMeta() {
  const [state, setState] = useState<MetaState>({ status: "loading", meta: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let isCurrent = true;
    getMeta()
      .then((meta) => {
        if (isCurrent) setState({ status: "ready", meta });
      })
      .catch(() => {
        if (isCurrent) setState({ status: "error", meta: null });
      });
    return () => {
      isCurrent = false;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ status: "loading", meta: null });
    setAttempt((current) => current + 1);
  }, []);

  return { ...state, retry };
}
