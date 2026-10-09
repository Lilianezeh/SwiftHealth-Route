// @vitest-environment jsdom
/** Tests for the useLocation hook in hooks/useLocation.ts. Requirements: FR-03, NFR-07.
 *
 * The browser's own permission prompt is shown only after a tap (ask()), never when the page loads, and only once per
 * tab: a refusal is remembered. A fake navigator.geolocation stands in for the phone.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useLocation } from "@/hooks/useLocation";
import { isLocationDenied, readArea, readPosition, savePosition } from "@/lib/location/locationStore";

type SuccessCallback = (position: GeolocationPosition) => void;
type ErrorCallback = (error: GeolocationPositionError) => void;

const PERMISSION_DENIED = 1;
const POSITION_UNAVAILABLE = 2;
const TIMEOUT = 3;

let getCurrentPosition: ReturnType<typeof vi.fn>;

function fakePosition(latitude: number, longitude: number): GeolocationPosition {
  return { coords: { latitude, longitude, accuracy: 20 } } as GeolocationPosition;
}

function fakeError(code: number): GeolocationPositionError {
  return { code, message: "secret detail 6.451234,7.509876" } as GeolocationPositionError;
}

/** Makes the next getCurrentPosition call answer with the given outcome. */
function geolocationAnswers(outcome: { position: GeolocationPosition } | { errorCode: number }) {
  getCurrentPosition.mockImplementation((success: SuccessCallback, failure: ErrorCallback) => {
    if ("position" in outcome) success(outcome.position);
    else failure(fakeError(outcome.errorCode));
  });
}

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
  getCurrentPosition = vi.fn();
  Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition }, configurable: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useLocation", () => {
  it("does not ask the browser until a button calls ask()", () => {
    const { result } = renderHook(() => useLocation());

    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
    expect(result.current.position).toBeNull();
  });

  it("moves from idle to asking to granted, with a position rounded to 3 decimals", () => {
    let answer: SuccessCallback = () => {};
    getCurrentPosition.mockImplementation((success: SuccessCallback) => {
      answer = success;
    });
    const { result } = renderHook(() => useLocation());

    act(() => result.current.ask());
    expect(result.current.status).toBe("asking");

    act(() => answer(fakePosition(6.451234, 7.509876)));
    expect(result.current.status).toBe("granted");
    expect(result.current.position).toEqual({ latitude: 6.451, longitude: 7.51 });
  });

  it("saves the rounded position for the tab", () => {
    geolocationAnswers({ position: fakePosition(6.451234, 7.509876) });
    const { result } = renderHook(() => useLocation());

    act(() => result.current.ask());

    expect(readPosition()).toEqual({ latitude: 6.451, longitude: 7.51 });
  });

  it("asks for an approximate, cached-for-5-minutes position with a 10 second limit", () => {
    geolocationAnswers({ position: fakePosition(6.45, 7.5) });
    const { result } = renderHook(() => useLocation());

    act(() => result.current.ask());

    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(getCurrentPosition.mock.calls[0][2]).toEqual({
      enableHighAccuracy: false,
      timeout: 10_000,
      maximumAge: 300_000,
    });
  });

  it("reports a refusal as denied, remembers it, and does not ask the browser again", () => {
    geolocationAnswers({ errorCode: PERMISSION_DENIED });
    const { result } = renderHook(() => useLocation());

    act(() => result.current.ask());
    expect(result.current.status).toBe("denied");
    expect(isLocationDenied()).toBe(true);

    act(() => result.current.ask());
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it("starts as denied in the same tab after a refusal (the site asks once)", () => {
    geolocationAnswers({ errorCode: PERMISSION_DENIED });
    const first = renderHook(() => useLocation());
    act(() => first.result.current.ask());
    first.unmount();

    const second = renderHook(() => useLocation());

    expect(second.result.current.status).toBe("denied");
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it("reports an unavailable position and a timeout as separate states that are not a refusal", () => {
    geolocationAnswers({ errorCode: POSITION_UNAVAILABLE });
    const { result } = renderHook(() => useLocation());
    act(() => result.current.ask());
    expect(result.current.status).toBe("unavailable");
    expect(isLocationDenied()).toBe(false);

    geolocationAnswers({ errorCode: TIMEOUT });
    act(() => result.current.ask()); // the visitor may try again
    expect(result.current.status).toBe("timeout");
    expect(getCurrentPosition).toHaveBeenCalledTimes(2);
  });

  it("reports unavailable when the browser has no geolocation at all", () => {
    Object.defineProperty(navigator, "geolocation", { value: undefined, configurable: true });
    const { result } = renderHook(() => useLocation());

    act(() => result.current.ask());

    expect(result.current.status).toBe("unavailable");
  });

  it("reads a saved position without asking again", () => {
    savePosition({ latitude: 6.451, longitude: 7.51 });

    const { result } = renderHook(() => useLocation());

    expect(result.current.status).toBe("granted");
    expect(result.current.position).toEqual({ latitude: 6.451, longitude: 7.51 });
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it("reads and saves the chosen area", () => {
    const { result } = renderHook(() => useLocation());
    expect(result.current.area).toBeNull();

    act(() => result.current.chooseArea("New Haven"));

    expect(result.current.area).toBe("New Haven");
    expect(readArea()).toBe("New Haven");
    expect(renderHook(() => useLocation()).result.current.area).toBe("New Haven");
  });

  it("says when it has finished reading the tab's saved values (so a page can wait before it shows a prompt)", () => {
    const { result } = renderHook(() => useLocation());
    expect(result.current.ready).toBe(true);
  });

  it("leaves a granted position and a chosen area both available", () => {
    savePosition({ latitude: 6.451, longitude: 7.51 });
    const { result } = renderHook(() => useLocation());
    act(() => result.current.chooseArea("GRA"));

    expect(result.current.position).not.toBeNull();
    expect(result.current.area).toBe("GRA");
  });

  it("does nothing, and does not complain, if the answer arrives after the page is gone", () => {
    let answer: SuccessCallback = () => {};
    getCurrentPosition.mockImplementation((success: SuccessCallback) => {
      answer = success;
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result, unmount } = renderHook(() => useLocation());
    act(() => result.current.ask());

    unmount();
    expect(() => answer(fakePosition(6.45, 7.5))).not.toThrow();

    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("never logs, and never puts the position in the address, a cookie or localStorage", () => {
    const spies = (["log", "info", "debug", "warn", "error"] as const).map((method) =>
      vi.spyOn(console, method).mockImplementation(() => {}),
    );
    const addressBefore = window.location.href;
    geolocationAnswers({ position: fakePosition(6.451234, 7.509876) });
    const { result } = renderHook(() => useLocation());

    act(() => result.current.ask());
    geolocationAnswers({ errorCode: PERMISSION_DENIED });
    act(() => result.current.ask());

    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    expect(window.location.href).toBe(addressBefore);
    expect(document.cookie).toBe("");
    expect(window.localStorage.length).toBe(0);
  });
});
