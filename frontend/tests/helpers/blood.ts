/** Sample answers of the blood endpoints for tests (api-spec, "Phase 8 rules for both blood endpoints"). Everything is fictional. */
import type { BloodBank, DonationCentre } from "@/types/api";

import { listing } from "./api";

const WEEK = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
  day_of_week: day,
  opens_at: day < 5 ? "08:00" : null,
  closes_at: day < 5 ? "17:00" : null,
  is_closed: day >= 5,
}));

export function bloodBank(overrides: Partial<BloodBank> = {}): BloodBank {
  return {
    ...listing({ id: 28, slug: "demo-blood-bank-central", name: "Demo Blood Bank Central", category: { slug: "blood-bank", name: "Blood bank" }, area: "Ogui", distance_km: null }),
    blood_groups: ["A+", "O+"],
    blood_groups_confirmed_at: "2026-10-01",
    stock_note: "Stock changes daily; call to confirm before you go.",
    ...overrides,
  };
}

export function donationCentre(overrides: Partial<DonationCentre> = {}): DonationCentre {
  return {
    ...listing({ id: 29, slug: "demo-blood-bank-north", name: "Demo Blood Bank North", category: { slug: "blood-bank", name: "Blood bank" }, area: "Abakpa Nike", distance_km: null }),
    donation_hours: WEEK,
    ...overrides,
  };
}
