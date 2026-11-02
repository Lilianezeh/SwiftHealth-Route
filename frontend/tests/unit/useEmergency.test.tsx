// @vitest-environment jsdom
/** The useEmergency hook and getEmergency. Requirements: FR-14 to FR-17, FR-25, NFR-03, NFR-07.
 * Decision A5 (specs/2026-10-17-swiftrescue/requirements.md): the first request has no position and is the one that is saved; a
 * second request with the position adds the distances.
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useEmergency } from "@/hooks/useEmergency";
import { getEmergency } from "@/lib/api/emergency";
import { OFFLINE_COPY_KEY, readOfflineCopy } from "@/lib/emergency/offlineCopy";

import { emergencyResponse, json, neverAnswers, stubApi } from "../helpers/api";

const POSITION = { latitude: 6.452, longitude: 7.51 };

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("getEmergency", () => {
  it("asks GET /emergency with no query when there is no position", async () => {
    const { requests } = stubApi({});

    await getEmergency(null);

    expect(requests[0].pathname).toBe("/emergency");
    expect(requests[0].search).toBe("");
  });

  it("sends lat and lng together, in the body of a POST and not in the address, when there is a position", async () => {
    const { requests, fetchStub, emergencies } = stubApi({});

    await getEmergency(POSITION);

    expect(Object.fromEntries(emergencies()[0].searchParams)).toEqual({ lat: "6.452", lng: "7.51" });
    expect(requests[0].pathname).toBe("/emergency");
    expect(requests[0].search).toBe(""); // nothing in the address (NFR-07)
    expect(fetchStub.mock.calls[0][1]).toMatchObject({ method: "POST" });
    expect(JSON.parse(String(fetchStub.mock.calls[0][1]?.body))).toEqual({ lat: 6.452, lng: 7.51 });
  });
});

describe("useEmergency", () => {
  it("loads the list, then says ready, and saves a copy", async () => {
    stubApi({});
    const { result } = renderHook(() => useEmergency(null, true));
    expect(result.current.status).toBe("loading");

    await waitFor(() => expect(result.current.status).toBe("ready"));

    expect(result.current.response?.national_line.number).toBe("112");
    expect(result.current.savedAt).toBeNull();
    expect(readOfflineCopy()).not.toBeNull();
  });

  it("makes no request until it is enabled", async () => {
    const { fetchStub } = stubApi({});
    const { rerender } = renderHook(({ enabled }) => useEmergency(null, enabled), { initialProps: { enabled: false } });
    expect(fetchStub).not.toHaveBeenCalled();

    rerender({ enabled: true });

    await waitFor(() => expect(fetchStub).toHaveBeenCalledTimes(1));
  });

  it("with a position makes a first request without it (the one that is saved) and a second with it", async () => {
    // The clock is frozen (only Date, so waitFor still works) and the numbers are distinctive: the saved copy holds a timestamp, and a
    // short number such as 1.4 can sit inside it by chance ("…18:39:01.447Z"). Here no timestamp can hold any of the three values.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-02T12:00:00.000Z"));
    const distinctivePosition = { latitude: 9.87654321, longitude: 3.21987654 };
    const distinctiveDistance = 87.654321;
    const withDistance = emergencyResponse();
    withDistance.groups[0].contacts[0].distance_km = distinctiveDistance;
    const { emergencies } = stubApi({
      emergency: (parameters) => json(parameters.has("lat") ? withDistance : emergencyResponse()),
    });
    const { result } = renderHook(() => useEmergency(distinctivePosition, true));

    await waitFor(() => expect(result.current.response?.groups[0].contacts[0].distance_km).toBe(distinctiveDistance));

    expect(emergencies().map((url) => url.searchParams.has("lat"))).toEqual([false, true]);
    const savedCopy = window.localStorage.getItem(OFFLINE_COPY_KEY) ?? "";
    expect(savedCopy).toContain("2026-11-02T12:00:00.000Z"); // the copy was saved, with the frozen clock
    expect(savedCopy).not.toContain("9.87654321");
    expect(savedCopy).not.toContain("3.21987654");
    expect(savedCopy).not.toContain("87.654321");
    expect(result.current.status).toBe("ready");
  });

  it("shows the first answer while the answer with distances is still on its way, and keeps it if that one fails", async () => {
    stubApi({ emergency: (parameters) => (parameters.has("lat") ? json({ detail: "boom" }, 500) : json(emergencyResponse())) });
    const { result } = renderHook(() => useEmergency(POSITION, true));

    await waitFor(() => expect(result.current.status).toBe("ready"));
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(result.current.status).toBe("ready");
    expect(result.current.response?.groups[0].contacts).toHaveLength(1);
  });

  it("says 'slow' after 5 seconds and 'error' after 45 seconds, with no saved copy", async () => {
    vi.useFakeTimers();
    stubApi({ emergency: neverAnswers });
    const { result } = renderHook(() => useEmergency(null, true));

    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });
    expect(result.current.status).toBe("slow");

    await act(async () => {
      vi.advanceTimersByTime(40_000);
    });
    expect(result.current.status).toBe("error");
  });

  it("when the network fails and a saved copy exists, shows the copy and its date", async () => {
    stubApi({});
    const first = renderHook(() => useEmergency(null, true));
    await waitFor(() => expect(first.result.current.status).toBe("ready"));
    first.unmount();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));

    const { result } = renderHook(() => useEmergency(null, true));

    await waitFor(() => expect(result.current.status).toBe("offline"));
    expect(result.current.response?.groups[0].contacts[0].name).toBe("Demo Ambulance One");
    expect(result.current.savedAt).not.toBeNull();
  });

  it("an error answer of the API is an error, not 'offline', even with a saved copy", async () => {
    stubApi({});
    const first = renderHook(() => useEmergency(null, true));
    await waitFor(() => expect(first.result.current.status).toBe("ready"));
    first.unmount();
    stubApi({ emergency: () => json({ detail: "boom" }, 500) });

    const { result } = renderHook(() => useEmergency(null, true));

    await waitFor(() => expect(result.current.status).toBe("error"));
  });

  it("with a network failure and no saved copy, says error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    const { result } = renderHook(() => useEmergency(null, true));

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.response).toBeNull();
  });

  it("retry asks again", async () => {
    const { fetchStub } = stubApi({ emergency: () => json({ detail: "boom" }, 500) });
    const { result } = renderHook(() => useEmergency(null, true));
    await waitFor(() => expect(result.current.status).toBe("error"));

    result.current.retry();

    await waitFor(() => expect(fetchStub).toHaveBeenCalledTimes(2));
  });
});
