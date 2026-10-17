/** Type words typed in the search box. Requirements: FR-04, US-05. Spec: specs/2026-10-15-find-by-type/requirements.md D5 (the owner's words, approved 2026-10-15). */
import { describe, expect, it } from "vitest";

import { TYPE_WORDS } from "@/config/typeWords";
import { resolveTypeWord } from "@/lib/search/typeWords";

const OWNER_LIST = {
  pharmacy: ["pharmacy", "pharmacies", "chemist", "chemists", "chemist shop", "drug store", "drugstore", "patent medicine", "PPMV"],
  hospital: ["hospital", "hospitals", "general hospital", "teaching hospital", "medical centre", "medical center"],
  clinic: ["clinic", "clinics", "health centre", "health center", "PHC", "primary health centre", "dispensary"],
  maternity: [
    "maternity", "maternity home", "maternity centre", "maternity center", "midwife", "antenatal", "birth centre", "birth center",
  ],
  laboratory: [
    "lab", "labs", "laboratory", "laboratories", "medical lab", "diagnostic", "diagnostics", "diagnostic centre", "diagnostic center",
  ],
} as const;

describe("resolveTypeWord", () => {
  it("applies the type of every word the owner approved", () => {
    for (const [slug, words] of Object.entries(OWNER_LIST)) {
      for (const word of words) expect(resolveTypeWord(word), `${word} -> ${slug}`).toBe(slug);
    }
  });

  it("keeps its words in one config file that holds the owner's list", () => {
    for (const [slug, words] of Object.entries(OWNER_LIST)) {
      const configured = TYPE_WORDS[slug as keyof typeof TYPE_WORDS].map((word) => word.toLowerCase().replace(/[^a-z0-9]/g, ""));
      for (const word of words) expect(configured, `${word} in config`).toContain(word.toLowerCase().replace(/[^a-z0-9]/g, ""));
    }
  });

  it("ignores capitals, spaces, hyphens and dots", () => {
    expect(resolveTypeWord("Drug-Store")).toBe("pharmacy");
    expect(resolveTypeWord("DRUGSTORE")).toBe("pharmacy");
    expect(resolveTypeWord("  drug   store ")).toBe("pharmacy");
    expect(resolveTypeWord("chemist  shop")).toBe("pharmacy");
    expect(resolveTypeWord("P.P.M.V")).toBe("pharmacy");
    expect(resolveTypeWord("Birth Center")).toBe("maternity");
    expect(resolveTypeWord("Medical-Lab")).toBe("laboratory");
  });

  it("accepts a plural, even for a word the list only holds in the singular", () => {
    expect(resolveTypeWord("chemist shops")).toBe("pharmacy");
    expect(resolveTypeWord("drug stores")).toBe("pharmacy");
    expect(resolveTypeWord("midwives")).toBeNull(); // not a plain plural: not guessed
    expect(resolveTypeWord("dispensaries")).toBe("clinic");
    expect(resolveTypeWord("birth centres")).toBe("maternity");
    expect(resolveTypeWord("medical labs")).toBe("laboratory");
  });

  it("applies nothing when the text is more than a type word", () => {
    expect(resolveTypeWord("pharmacy ogui")).toBeNull();
    expect(resolveTypeWord("night pharmacy")).toBeNull();
    expect(resolveTypeWord("hospital near enugu")).toBeNull();
    expect(resolveTypeWord("St Mary's hospital")).toBeNull();
  });

  it("leaves emergency words to SwiftRescue and Blood: ambulance, police, fire, blood", () => {
    for (const word of ["ambulance", "police", "fire", "blood", "blood bank", "emergency"]) {
      expect(resolveTypeWord(word), word).toBeNull();
    }
  });

  it("applies nothing for an empty text or a typing mistake (the fuzzy text search handles those)", () => {
    expect(resolveTypeWord("")).toBeNull();
    expect(resolveTypeWord("   ")).toBeNull();
    expect(resolveTypeWord("farmacy")).toBeNull();
    expect(resolveTypeWord("hospitl")).toBeNull();
    expect(resolveTypeWord(undefined)).toBeNull();
  });
});
