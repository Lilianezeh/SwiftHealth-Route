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
  clearPosition,
  isLocationDenied,
  markLocationDenied,
  readArea,
  readPosition,
  roundPosition,
  saveArea,
  savePosition,
} from "@/lib/location/locationStore";
import { isPermissionCheckSupported, readGeolocationPermission } from "@/lib/location/permission";

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
    let isCurrent = true;
    const position = readPosition(); // read after the first render, so the server and the browser render the same page
    const area = readArea();

    if (position && isPermissionCheckSupported()) {
      // A stored position is used only while the browser still allows it: a tab can get a copy of another tab's
      // sessionStorage, and the visitor may have blocked the site since. Until the browser answers we are not ready,
      // so a page makes one search, not two.
      readGeolocationPermission().then((permission) => {
        if (!isCurrent) return;
        if (permission === "denied") {
          clearPosition();
          markLocationDenied(); // the refusal is remembered for the tab, as for any refusal
          setState({ status: "denied", position: null, area, ready: true });
        } else {
          setState({ status: "granted", position, area, ready: true }); // granted, prompt, or the browser cannot say
        }
      });
    } else {
      const status: LocationStatus = position ? "granted" : isLocationDenied() ? "denied" : "idle";
      setState({ status, position, area, ready: true });
    }
    return () => {
      isMounted.current = false;
      isCurrent = false;
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
