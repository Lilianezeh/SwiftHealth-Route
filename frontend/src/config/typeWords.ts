/** The words that apply a type when they are typed in the search box, in one file. Requirements: FR-04, US-05.
 * Spec: specs/2026-10-15-find-by-type/requirements.md D5. Words for Nigerian usage, approved by the owner on 2026-10-15.
 * Read for people: capitals, spaces, hyphens and dots do not matter (lib/search/typeWords.ts), so "Drug-Store" and "drugstore" are the same.
 * Not mapped on purpose: ambulance, police, fire and blood belong to SwiftRescue and the Blood page.
 */
import type { TypeSlug } from "@/config/types";

export const TYPE_WORDS: Record<TypeSlug, readonly string[]> = {
  pharmacy: [
    "pharmacy", "pharmacies", "chemist", "chemists", "chemist shop", "drug store", "drugstore", "patent medicine", "PPMV",
  ],
  hospital: ["hospital", "hospitals", "general hospital", "teaching hospital", "medical centre", "medical center"],
  clinic: ["clinic", "clinics", "health centre", "health center", "PHC", "primary health centre", "dispensary"],
  maternity: [
    "maternity", "maternity home", "maternity centre", "maternity center", "midwife", "antenatal", "birth centre", "birth center",
  ],
  laboratory: [
    "lab", "labs", "laboratory", "laboratories", "medical lab", "diagnostic", "diagnostics", "diagnostic centre", "diagnostic center",
  ],
};
