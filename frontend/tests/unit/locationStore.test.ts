// @vitest-environment jsdom
/** Tests for the location store in lib/location/locationStore.ts. Requirements: FR-03, NFR-07.
 *
 * Decision 3 in specs/2026-10-09-search-frontend/requirements.md kept the position in sessionStorage for the tab; the owner's rule of
 * 2026-11-01 ("never stored") moved it to MEMORY ONLY (specs/2026-11-01-maps-near-me/): rounded to 3 decimals (about 110 m), gone when the
 * page is reloaded, never in the address, a cookie, localStorage or sessionStorage. The chosen area and the refusal are not a position and
 * stay in sessionStorage.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearLocation,
  clearPosition,
  isLocationDenied,
  markLocationDenied,
  readArea,
  readPosition,
  roundPosition,
  saveArea,
  savePosition,
} from "@/lib/location/locationStore";

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("roundPosition", () => {
  it("rounds to 3 decimals", () => {
    expect(roundPosition({ latitude: 6.451234, longitude: 7.509876 })).toEqual({ latitude: 6.451, longitude: 7.51 });
  });

  it("rounds negative numbers the same way", () => {
    expect(roundPosition({ latitude: -6.4516, longitude: -7.5004 })).toEqual({ latitude: -6.452, longitude: -7.5 });
  });

  it("leaves a number with 3 decimals or fewer as it is", () => {
    expect(roundPosition({ latitude: 6.5, longitude: 7.123 })).toEqual({ latitude: 6.5, longitude: 7.123 });
  });
});

describe("the position", () => {
  it("is saved rounded and read back", () => {
    savePosition({ latitude: 6.451234, longitude: 7.509876 });

    expect(readPosition()).toEqual({ latitude: 6.451, longitude: 7.51 });
  });

  it("is kept in memory ONLY: not in sessionStorage, localStorage, a cookie or IndexedDB (owner, 2026-11-01)", () => {
    savePosition({ latitude: 6.451234, longitude: 7.509876 });

    expect(readPosition()).toEqual({ latitude: 6.451, longitude: 7.51 });
    expect(window.sessionStorage.length).toBe(0);
    expect(window.localStorage.length).toBe(0);
    expect(document.cookie).toBe("");
    expect(JSON.stringify({ ...window.sessionStorage, ...window.localStorage })).not.toMatch(/6\.45|7\.5/);
  });

  it("is forgotten when the page is reloaded (a new load of the code starts with nothing)", async () => {
    savePosition({ latitude: 6.451234, longitude: 7.509876 });
    vi.resetModules();

    const fresh = await import("@/lib/location/locationStore");

    expect(fresh.readPosition()).toBeNull();
  });

  it("wipes a position that an older version left in sessionStorage when the file loads", async () => {
    window.sessionStorage.setItem("swifthealth.position", JSON.stringify({ latitude: 6.451, longitude: 7.51 }));
    vi.resetModules();

    const fresh = await import("@/lib/location/locationStore");

    expect(window.sessionStorage.getItem("swifthealth.position")).toBeNull();
    expect(fresh.readPosition()).toBeNull();
  });

  it("is not logged", () => {
    const logs = [vi.spyOn(console, "log"), vi.spyOn(console, "info"), vi.spyOn(console, "warn"), vi.spyOn(console, "error")];

    savePosition({ latitude: 6.451234, longitude: 7.509876 });
    readPosition();

    for (const log of logs) expect(log).not.toHaveBeenCalled();
  });

  it("is not in the page address", () => {
    savePosition({ latitude: 6.451234, longitude: 7.509876 });

    expect(window.location.href).not.toMatch(/6\.45|7\.5|lat|lng/);
  });

  it("is null when nothing was saved", () => {
    clearPosition();

    expect(readPosition()).toBeNull();
  });

  it.each([
    ["latitude out of range", { latitude: 91, longitude: 7.5 }],
    ["longitude out of range", { latitude: 6.45, longitude: -181 }],
    ["not finite", { latitude: Number.NaN, longitude: 7.5 }],
    ["infinite", { latitude: 6.45, longitude: Number.POSITIVE_INFINITY }],
  ])("refuses a position that is not on the earth (%s) and keeps what it had", (_name, position) => {
    savePosition({ latitude: 6.45, longitude: 7.5 });

    savePosition(position);

    expect(readPosition()).toEqual({ latitude: 6.45, longitude: 7.5 });
  });

  it("is removed alone by clearPosition: the chosen area stays, and the refusal is not set by it", () => {
    savePosition({ latitude: 6.451, longitude: 7.51 });
    saveArea("Ogui");

    clearPosition();

    expect(readPosition()).toBeNull();
    expect(readArea()).toBe("Ogui");
    expect(isLocationDenied()).toBe(false);
  });

  it("is removed by clearLocation, together with the area and the refusal", () => {
    savePosition({ latitude: 6.45, longitude: 7.5 });
    saveArea("GRA");
    markLocationDenied();

    clearLocation();

    expect(readPosition()).toBeNull();
    expect(readArea()).toBeNull();
    expect(isLocationDenied()).toBe(false);
    expect(window.sessionStorage.length).toBe(0);
  });
});

describe("the refusal", () => {
  it("is remembered for the tab", () => {
    expect(isLocationDenied()).toBe(false);
    markLocationDenied();
    expect(isLocationDenied()).toBe(true);
  });

  it("is kept in sessionStorage only", () => {
    markLocationDenied();
    expect(window.localStorage.length).toBe(0);
    expect(document.cookie).toBe("");
  });
});

describe("the chosen area", () => {
  it("is saved and read back", () => {
    saveArea("New Haven");
    expect(readArea()).toBe("New Haven");
  });

  it("is null when nothing was chosen, and ignores a blank value", () => {
    expect(readArea()).toBeNull();
    saveArea("   ");
    expect(readArea()).toBeNull();
  });

  it("is independent of the position", () => {
    saveArea("GRA");
    expect(readPosition()).toBeNull();
    savePosition({ latitude: 6.45, longitude: 7.5 });
    expect(readArea()).toBe("GRA");
  });
});

describe("when sessionStorage is not available (private mode, blocked site data)", () => {
  it("does not throw when saving, and reads nothing back except the position, which never needed it", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Access denied.", "SecurityError");
    });

    expect(() => savePosition({ latitude: 6.45, longitude: 7.5 })).not.toThrow();
    expect(() => saveArea("GRA")).not.toThrow();
    expect(() => markLocationDenied()).not.toThrow();
    expect(readPosition()).toEqual({ latitude: 6.45, longitude: 7.5 }); // in memory: no storage involved
    expect(readArea()).toBeNull();
    expect(isLocationDenied()).toBe(false);
  });

  it("does not throw when clearing", () => {
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("Access denied.", "SecurityError");
    });

    expect(() => clearLocation()).not.toThrow();
  });
});
