"use client";

/** Asking for the visitor's position, and remembering the answer for the tab. Requirements: FR-03, NFR-07.
 *
 * The browser's permission prompt is shown only when `ask()` is called (from a button), never when the page loads, and
 * only once per tab: a refusal is remembered. If the visitor refuses, they can pick an area instead (`chooseArea`).
 * Nothing here logs, and the position is never put in an address (see lib/location/locationStore.ts).
 */
import { useCallback, useEffect, useRef, useState } from "react";

import type { Position } from "@/lib/api/search";
import {
  isLocationDenied,
  markLocationDenied,
  readArea,
  readPosition,
  roundPosition,
  saveArea,
  savePosition,
} from "@/lib/location/locationStore";

export type LocationStatus = "idle" | "asking" | "granted" | "denied" | "unavailable" | "timeout";

type LocationState = { status: LocationStatus; position: Position | null; area: string | null; ready: boolean };

// An approximate position is enough, and a recent one is fine: it is quicker and uses less battery on a cheap phone.
const GEOLOCATION_OPTIONS: PositionOptions = { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 };

const PERMISSION_DENIED = 1;
const TIMEOUT = 3;

export function useLocation() {
  const [state, setState] = useState<LocationState>({ status: "idle", position: null, area: null, ready: false });
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    const position = readPosition(); // read after the first render, so the server and the browser render the same page
    const status: LocationStatus = position ? "granted" : isLocationDenied() ? "denied" : "idle";
    setState({ status, position, area: readArea(), ready: true });
    return () => {
      isMounted.current = false;
    };
  }, []);

  const ask = useCallback(() => {
    if (isLocationDenied()) {
      setState((current) => ({ ...current, status: "denied" })); // the site asks once per tab
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState((current) => ({ ...current, status: "unavailable" }));
      return;
    }
    setState((current) => ({ ...current, status: "asking" }));
    navigator.geolocation.getCurrentPosition(
      (result) => {
        const position = roundPosition({ latitude: result.coords.latitude, longitude: result.coords.longitude });
        savePosition(position);
        if (isMounted.current) setState((current) => ({ ...current, status: "granted", position }));
      },
      (error) => {
        if (error.code === PERMISSION_DENIED) markLocationDenied();
        const status: LocationStatus =
          error.code === PERMISSION_DENIED ? "denied" : error.code === TIMEOUT ? "timeout" : "unavailable";
        if (isMounted.current) setState((current) => ({ ...current, status }));
      },
      GEOLOCATION_OPTIONS,
    );
  }, []);

  const chooseArea = useCallback((area: string) => {
    saveArea(area);
    setState((current) => ({ ...current, area: readArea() }));
  }, []);

  return { ...state, ask, chooseArea };
}
