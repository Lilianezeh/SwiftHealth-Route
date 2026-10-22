// @vitest-environment jsdom
/** The saved copy of the blood banks for offline use. Requirements: US-15, FR-27, NFR-03, NFR-07.
 * Decisions N2 to N5 in specs/2026-10-22-blood-offline/requirements.md. Like SwiftRescue's copy (decision A5 there): no distance and no position.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BLOOD_COPY_KEY, MAX_SAVED_BANKS, readBloodCopy, saveBloodCopy } from "@/lib/blood/offlineCopy";

import { bloodBank } from "../helpers/blood";

const SAVED_AT = new Date("2026-10-22T10:00:00Z");

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("the saved blood banks", () => {
  it("are saved under one key and read back with the date they were saved", () => {
    saveBloodCopy([bloodBank()], SAVED_AT);

    expect(window.localStorage.getItem(BLOOD_COPY_KEY)).not.toBeNull();
    const copy = readBloodCopy();
    expect(copy?.savedAt).toBe("2026-10-22T10:00:00.000Z");
    expect(copy?.banks).toHaveLength(1);
    expect(copy?.banks[0]).toMatchObject({
      id: 28,
      slug: "demo-blood-bank-central",
      name: "Demo Blood Bank Central",
      area: "Ogui",
      primary_phone: "+2340000000012",
      blood_groups: ["A+", "O+"],
      blood_groups_confirmed_at: "2026-10-01",
      stock_note: "Stock changes daily; call to confirm before you go.",
    });
  });

  it("hold no distance, whatever the answer held, and no 'open now' or hours line that would be out of date", () => {
    saveBloodCopy([bloodBank({ distance_km: 1.4, is_open_now: true, hours_note: "Closes 9:00 PM" })], SAVED_AT);

    const stored = window.localStorage.getItem(BLOOD_COPY_KEY) ?? "";
    expect(stored).not.toContain("distance_km");
    expect(stored).not.toContain("is_open_now");
    expect(stored).not.toContain("hours_note");
    expect(stored).not.toContain("Closes 9:00 PM");
    expect(stored).not.toMatch(/\blat\b|\blng\b|position/i);
  });

  it("are put in the order of a request without a position: by name, then id", () => {
    saveBloodCopy(
      [
        bloodBank({ id: 3, name: "Zeta Blood Bank" }),
        bloodBank({ id: 5, name: "Alpha Blood Bank" }),
        bloodBank({ id: 2, name: "Alpha Blood Bank" }),
      ],
      SAVED_AT,
    );

    expect(readBloodCopy()?.banks.map((bank) => [bank.name, bank.id])).toEqual([
      ["Alpha Blood Bank", 2],
      ["Alpha Blood Bank", 5],
      ["Zeta Blood Bank", 3],
    ]);
  });

  it("are at most 100, the most the API gives in one answer", () => {
    const many = Array.from({ length: 130 }, (_unused, index) => bloodBank({ id: index + 1, name: `Bank ${String(index).padStart(3, "0")}` }));

    saveBloodCopy(many, SAVED_AT);

    expect(MAX_SAVED_BANKS).toBe(100);
    expect(readBloodCopy()?.banks).toHaveLength(100);
  });

  it("keep the groups and the date they were confirmed, and a bank with no groups", () => {
    saveBloodCopy([bloodBank({ id: 1, blood_groups: [], blood_groups_confirmed_at: null })], SAVED_AT);

    expect(readBloodCopy()?.banks[0].blood_groups).toEqual([]);
    expect(readBloodCopy()?.banks[0].blood_groups_confirmed_at).toBeNull();
  });

  it("are saved again on every visit: the newest copy replaces the old one", () => {
    saveBloodCopy([bloodBank({ name: "Old Bank" })], SAVED_AT);
    saveBloodCopy([bloodBank({ name: "New Bank" })], new Date("2026-10-23T08:00:00Z"));

    expect(readBloodCopy()?.banks.map((bank) => bank.name)).toEqual(["New Bank"]);
    expect(readBloodCopy()?.savedAt).toBe("2026-10-23T08:00:00.000Z");
  });

  it("are never saved when the list is empty: an empty list would hide a good copy", () => {
    saveBloodCopy([bloodBank()], SAVED_AT);

    saveBloodCopy([], new Date("2026-10-23T08:00:00Z"));

    expect(readBloodCopy()?.banks).toHaveLength(1);
  });

  it("return null when there is no copy, or the copy is damaged or has the wrong shape", () => {
    expect(readBloodCopy()).toBeNull();
    window.localStorage.setItem(BLOOD_COPY_KEY, "{not json");
    expect(readBloodCopy()).toBeNull();
    window.localStorage.setItem(BLOOD_COPY_KEY, JSON.stringify({ savedAt: "x", banks: 5 }));
    expect(readBloodCopy()).toBeNull();
    window.localStorage.setItem(BLOOD_COPY_KEY, JSON.stringify({ savedAt: "2026-10-22T10:00:00.000Z", banks: [{ name: "Only a name" }] }));
    expect(readBloodCopy()).toBeNull();
    window.localStorage.setItem(BLOOD_COPY_KEY, JSON.stringify({ banks: [] }));
    expect(readBloodCopy()).toBeNull();
  });

  it("cope with a storage that throws (private mode): nothing is saved and nothing is read", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(() => saveBloodCopy([bloodBank()], SAVED_AT)).not.toThrow();
    expect(readBloodCopy()).toBeNull();
  });

  it("are never put in sessionStorage, and use their own key, apart from SwiftRescue's copy", () => {
    saveBloodCopy([bloodBank()], SAVED_AT);

    expect(window.sessionStorage.length).toBe(0);
    expect(BLOOD_COPY_KEY).not.toBe("swiftrescue-saved-contacts");
  });
});
