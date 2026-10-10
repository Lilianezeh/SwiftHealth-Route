/** Tests for lib/search/categoryChoices.ts: which categories the Filters sheet offers, and in which order.
 * Requirements: FR-05, FR-15, FR-01. Decisions 1 to 3 in specs/2026-10-10-hide-emergency-filters/requirements.md.
 */
import { describe, expect, it } from "vitest";

import { chooseFilterCategories } from "@/lib/search/categoryChoices";
import type { MetaCategory } from "@/types/api";

function category(slug: string, name: string, isEmergency = false): MetaCategory {
  return { slug, name, is_emergency: isEmergency };
}

const PRODUCTION: MetaCategory[] = [
  category("clinic", "Clinic"),
  category("pharmacy", "Pharmacy"),
  category("laboratory", "Laboratory"),
  category("hospital", "Hospital"),
  category("maternity", "Maternity"),
  category("ambulance", "Ambulance", true),
  category("fire", "Fire", true),
];

function slugs(choices: { value: string }[]): string[] {
  return choices.map((choice) => choice.value);
}

describe("chooseFilterCategories", () => {
  it("returns the everyday categories in the order of the Find shortcuts", () => {
    expect(slugs(chooseFilterCategories(PRODUCTION, undefined))).toEqual([
      "hospital", "clinic", "pharmacy", "maternity", "laboratory",
    ]);
  });

  it("gives the name as the label", () => {
    expect(chooseFilterCategories(PRODUCTION, undefined)[0]).toEqual({ value: "hospital", label: "Hospital" });
  });

  it("puts other everyday categories after the five, in the order /meta gives, and leaves the input untouched", () => {
    const input = [category("eye-care", "Eye care"), ...PRODUCTION, category("dental", "Dental")];
    const copy = structuredClone(input);

    expect(slugs(chooseFilterCategories(input, undefined)).slice(5)).toEqual(["eye-care", "dental"]);
    expect(input).toEqual(copy);
  });

  it("works when only some of the five exist", () => {
    expect(slugs(chooseFilterCategories([category("laboratory", "Laboratory"), category("clinic", "Clinic")], undefined)))
      .toEqual(["clinic", "laboratory"]);
  });

  it("leaves out every emergency category when nothing is selected", () => {
    expect(slugs(chooseFilterCategories(PRODUCTION, undefined))).not.toContain("ambulance");
    expect(slugs(chooseFilterCategories(PRODUCTION, ""))).not.toContain("fire");
  });

  it("adds the selected emergency category last, with its real name", () => {
    const choices = chooseFilterCategories(PRODUCTION, "ambulance");

    expect(choices.at(-1)).toEqual({ value: "ambulance", label: "Ambulance" });
    expect(slugs(choices)).not.toContain("fire");
  });

  it("does not add a selected everyday category twice", () => {
    expect(slugs(chooseFilterCategories(PRODUCTION, "pharmacy")).filter((slug) => slug === "pharmacy")).toHaveLength(1);
  });

  it("does not invent a category that /meta does not know (the caller shows the slug)", () => {
    expect(slugs(chooseFilterCategories(PRODUCTION, "mystery"))).not.toContain("mystery");
  });

  it("returns an empty list for no categories", () => {
    expect(chooseFilterCategories([], "ambulance")).toEqual([]);
  });
});
