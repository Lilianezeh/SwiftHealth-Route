/** The five types, their chip labels and their headings. Requirements: US-01, FR-05, NFR-10. Spec: specs/2026-10-15-find-by-type/requirements.md D2 and D3. */
import { describe, expect, it } from "vitest";

import { HOME_CATEGORIES } from "@/config/home";
import { CATEGORY_SHORTCUTS } from "@/config/search";
import { findTypeChoice, TYPE_CHOICES } from "@/config/types";
import { searchHeading } from "@/lib/search/searchHeading";

describe("config/types.ts (D2)", () => {
  it("has the same five slugs as the home tiles and the Find shortcuts, in the tiles' order", () => {
    const slugs = TYPE_CHOICES.map((choice) => choice.slug);

    expect(slugs).toEqual(HOME_CATEGORIES.map((tile) => tile.slug));
    expect([...slugs].sort()).toEqual(CATEGORY_SHORTCUTS.map((shortcut) => shortcut.slug).sort());
  });

  it("gives each type the chip label and the plural heading of the owner (2026-10-15)", () => {
    expect(TYPE_CHOICES.map((choice) => [choice.slug, choice.chipLabel, choice.plural])).toEqual([
      ["hospital", "Hospital", "Hospitals"],
      ["clinic", "Clinic", "Clinics"],
      ["maternity", "Maternity", "Maternity homes"],
      ["pharmacy", "Pharmacy", "Pharmacies"],
      ["laboratory", "Laboratory", "Laboratories"],
    ]);
  });

  it("finds a type by its slug, and nothing for another category or no category", () => {
    expect(findTypeChoice("pharmacy")?.chipLabel).toBe("Pharmacy");
    expect(findTypeChoice("ambulance")).toBeUndefined();
    expect(findTypeChoice("")).toBeUndefined();
    expect(findTypeChoice(undefined)).toBeUndefined();
  });
});

describe("searchHeading (D3)", () => {
  it("is 'Search results' with no type, and with a category that is not one of the five", () => {
    expect(searchHeading(undefined, { area: undefined, hasPosition: true })).toBe("Search results");
    expect(searchHeading("ambulance", { area: "Ogui", hasPosition: true })).toBe("Search results");
  });

  it("says 'near you' only when the results are sorted from the visitor's position", () => {
    const expected = {
      hospital: "Hospitals near you",
      clinic: "Clinics near you",
      maternity: "Maternity homes near you",
      pharmacy: "Pharmacies near you",
      laboratory: "Laboratories near you",
    };
    for (const [slug, heading] of Object.entries(expected)) {
      expect(searchHeading(slug, { area: undefined, hasPosition: true }), slug).toBe(heading);
    }
  });

  it("says just the plural when there is no position and no area", () => {
    expect(searchHeading("pharmacy", { area: undefined, hasPosition: false })).toBe("Pharmacies");
    expect(searchHeading("maternity", { area: undefined, hasPosition: false })).toBe("Maternity homes");
  });

  it("says 'in <Area>' for a chosen area, and an area wins over a position", () => {
    expect(searchHeading("pharmacy", { area: "Ogui", hasPosition: false })).toBe("Pharmacies in Ogui");
    expect(searchHeading("pharmacy", { area: "Ogui", hasPosition: true })).toBe("Pharmacies in Ogui");
    expect(searchHeading("laboratory", { area: "New Haven", hasPosition: true })).toBe("Laboratories in New Haven");
  });
});
