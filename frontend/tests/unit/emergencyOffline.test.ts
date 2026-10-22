// @vitest-environment jsdom
/** The saved copy of the contacts for offline use. Requirements: FR-17, NFR-03, NFR-07.
 * Decision A5 in specs/2026-10-17-swiftrescue/requirements.md: the copy holds no distance and no position.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OFFLINE_COPY_KEY, readOfflineCopy, saveOfflineCopy } from "@/lib/emergency/offlineCopy";

import { emergencyResponse, listing, oldEmergencyResponse } from "../helpers/api";

const SAVED_AT = new Date("2026-10-17T10:00:00Z");

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("the offline copy", () => {
  it("is saved under one key and read back with the date it was saved", () => {
    saveOfflineCopy(emergencyResponse(), SAVED_AT);

    expect(window.localStorage.getItem(OFFLINE_COPY_KEY)).not.toBeNull();
    const copy = readOfflineCopy();
    expect(copy?.savedAt).toBe("2026-10-17T10:00:00.000Z");
    expect(copy?.response.national_line.number).toBe("112");
    expect(copy?.response.groups[0].contacts[0].name).toBe("Demo Ambulance One");
  });

  it("holds no distance, whatever the answer held", () => {
    const withDistances = emergencyResponse();
    withDistances.groups[0].contacts[0].distance_km = 1.4;
    withDistances.groups[2].contacts[0].distance_km = 0.3;

    saveOfflineCopy(withDistances, SAVED_AT);

    const stored = window.localStorage.getItem(OFFLINE_COPY_KEY) ?? "";
    expect(stored).not.toMatch(/"distance_km":\s*[0-9]/);
    expect(readOfflineCopy()?.response.groups[0].contacts[0].distance_km).toBeNull();
    expect(readOfflineCopy()?.response.groups[2].contacts[0].distance_km).toBeNull();
  });

  it("holds no pharmacies: not from a new answer, and not from an old API's answer that still has the list (K6)", () => {
    const oldAnswer = {
      ...emergencyResponse(),
      pharmacies_24h: [listing({ id: 201, name: "Demo Night Pharmacy", distance_km: 0.3 })],
    };

    saveOfflineCopy(oldAnswer, SAVED_AT);

    const stored = window.localStorage.getItem(OFFLINE_COPY_KEY) ?? "";
    expect(stored).not.toContain("pharmacies_24h");
    expect(stored).not.toContain("Demo Night Pharmacy");
    expect(readOfflineCopy()?.response.groups[0].contacts[0].name).toBe("Demo Ambulance One");
  });

  it("holds no blood bank group: not from an older API's answer (decision M1)", () => {
    saveOfflineCopy(oldEmergencyResponse(), SAVED_AT);

    const stored = window.localStorage.getItem(OFFLINE_COPY_KEY) ?? "";
    expect(stored).not.toContain("blood-bank");
    expect(stored).not.toContain("Demo Blood Bank");
    expect(readOfflineCopy()?.response.groups.map((group) => group.category.slug)).toEqual([
      "ambulance", "fire", "police", "emergency-unit", "roadside-assistance", "security",
    ]);
  });

  it("still reads a copy saved before that, which has a Blood banks group, and hands on no blood bank", () => {
    const savedBefore = { savedAt: "2026-10-17T10:00:00.000Z", response: oldEmergencyResponse() };
    window.localStorage.setItem(OFFLINE_COPY_KEY, JSON.stringify(savedBefore));

    const copy = readOfflineCopy();

    expect(copy?.savedAt).toBe("2026-10-17T10:00:00.000Z");
    expect(copy?.response.groups.map((group) => group.category.slug)).not.toContain("blood-bank");
    expect(JSON.stringify(copy)).not.toContain("Demo Blood Bank");
    expect(copy?.response.groups[0].contacts[0].name).toBe("Demo Ambulance One");
  });

  it("still reads a copy saved before the change, which has the pharmacy list, and hands on no pharmacies", () => {
    const savedBefore = {
      savedAt: "2026-10-17T10:00:00.000Z",
      response: { ...emergencyResponse(), pharmacies_24h: [listing({ id: 201, name: "Demo Night Pharmacy" })] },
    };
    window.localStorage.setItem(OFFLINE_COPY_KEY, JSON.stringify(savedBefore));

    const copy = readOfflineCopy();

    expect(copy?.savedAt).toBe("2026-10-17T10:00:00.000Z");
    expect(copy?.response.groups[0].contacts[0].name).toBe("Demo Ambulance One");
    expect(copy?.response).not.toHaveProperty("pharmacies_24h");
  });

  it("puts the contacts in the order of a request without a position: by name, then id", () => {
    const response = emergencyResponse();
    response.groups[0].contacts = [
      listing({ id: 3, name: "Zeta Ambulance" }),
      listing({ id: 2, name: "Alpha Ambulance" }),
    ];

    saveOfflineCopy(response, SAVED_AT);

    expect(readOfflineCopy()?.response.groups[0].contacts.map((contact) => contact.name)).toEqual([
      "Alpha Ambulance",
      "Zeta Ambulance",
    ]);
  });

  it("returns null when there is no copy, or the copy is damaged or has the wrong shape", () => {
    expect(readOfflineCopy()).toBeNull();
    window.localStorage.setItem(OFFLINE_COPY_KEY, "{not json");
    expect(readOfflineCopy()).toBeNull();
    window.localStorage.setItem(OFFLINE_COPY_KEY, JSON.stringify({ savedAt: "x", response: { groups: 5 } }));
    expect(readOfflineCopy()).toBeNull();
  });

  it("copes with a storage that throws (private mode): nothing is saved and nothing is read", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(() => saveOfflineCopy(emergencyResponse(), SAVED_AT)).not.toThrow();
    expect(readOfflineCopy()).toBeNull();
  });

  it("never puts the copy in sessionStorage", () => {
    saveOfflineCopy(emergencyResponse(), SAVED_AT);

    expect(window.sessionStorage.length).toBe(0);
  });
});
