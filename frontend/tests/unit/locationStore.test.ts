// @vitest-environment jsdom
/** Tests for the location store in lib/location/locationStore.ts. Requirements: FR-03, NFR-07.
 *
 * Decision 3 in specs/2026-10-09-search-frontend/requirements.md: the position lives in sessionStorage for the tab only,
 * rounded to 3 decimals (about 110 m). Never in the address, a cookie or localStorage.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearLocation,
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

  it("is kept in sessionStorage and never in localStorage or a cookie", () => {
    savePosition({ latitude: 6.451234, longitude: 7.509876 });

    expect(window.sessionStorage.length).toBe(1);
    expect(window.localStorage.length).toBe(0);
    expect(document.cookie).toBe("");
  });

  it("is stored with the two numbers and nothing else", () => {
    savePosition({ latitude: 6.451234, longitude: 7.509876 });

    const stored = JSON.parse(window.sessionStorage.getItem(window.sessionStorage.key(0) as string) as string);
    expect(Object.keys(stored).sort()).toEqual(["latitude", "longitude"]);
  });

  it("is not in the page address", () => {
    savePosition({ latitude: 6.451234, longitude: 7.509876 });

    expect(window.location.href).not.toMatch(/6\.45|7\.5|lat|lng/);
  });

  it("is null when nothing was saved", () => {
    expect(readPosition()).toBeNull();
  });

  it.each([
    ["not JSON", "{{{"],
    ["a string", JSON.stringify("6.45,7.5")],
    ["a number as text", JSON.stringify({ latitude: "6.45", longitude: "7.5" })],
    ["latitude out of range", JSON.stringify({ latitude: 91, longitude: 7.5 })],
    ["longitude out of range", JSON.stringify({ latitude: 6.45, longitude: -181 })],
    ["missing longitude", JSON.stringify({ latitude: 6.45 })],
    ["not finite", JSON.stringify({ latitude: null, longitude: null })],
    ["an array", JSON.stringify([6.45, 7.5])],
  ])("is null when the saved value is damaged (%s)", (_name, stored) => {
    savePosition({ latitude: 6.45, longitude: 7.5 });
    window.sessionStorage.setItem(window.sessionStorage.key(0) as string, stored);

    expect(readPosition()).toBeNull();
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
  it("does not throw when saving, and reads nothing back", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Access denied.", "SecurityError");
    });

    expect(() => savePosition({ latitude: 6.45, longitude: 7.5 })).not.toThrow();
    expect(() => saveArea("GRA")).not.toThrow();
    expect(() => markLocationDenied()).not.toThrow();
    expect(readPosition()).toBeNull();
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
