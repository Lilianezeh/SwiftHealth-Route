/** The saved copy of the blood banks, for when there is no network. Requirements: US-15, FR-27, NFR-03, NFR-07.
 *
 * Decisions N2 to N5 in specs/2026-10-22-blood-offline/requirements.md, the same way as SwiftRescue's copy (lib/emergency/offlineCopy.ts,
 * decision A5 there): it comes from a request made without a position, so it holds no distance and says nothing about where the visitor
 * is. It holds only what stays true for a while: no "open now" and no hours line (they would be out of date). It is in `localStorage`
 * (it must outlive the tab, unlike the position) under its own key. Every function copes with a storage that throws (private mode):
 * the page then simply has no copy.
 */
import type { BloodBank } from "@/types/api";

export const BLOOD_COPY_KEY = "swiftrescue-saved-blood-banks";
export const MAX_SAVED_BANKS = 100; // the most that GET /blood/banks gives in one answer

/** What is kept of a blood bank. */
export type SavedBloodBank = Pick<
  BloodBank,
  | "id"
  | "slug"
  | "name"
  | "category"
  | "area"
  | "address"
  | "latitude"
  | "longitude"
  | "primary_phone"
  | "last_verified_at"
  | "verification_due"
  | "blood_groups"
  | "blood_groups_confirmed_at"
  | "stock_note"
>;

export type BloodCopy = { savedAt: string; banks: SavedBloodBank[] };

/** The order of a request without a position: by name, then id (api-spec, "GET /blood/banks"). */
function byNameThenId(first: SavedBloodBank, second: SavedBloodBank): number {
  return first.name.localeCompare(second.name) || first.id - second.id;
}

function forTheCopy(bank: BloodBank): SavedBloodBank {
  return {
    id: bank.id,
    slug: bank.slug,
    name: bank.name,
    category: bank.category,
    area: bank.area,
    address: bank.address,
    latitude: bank.latitude,
    longitude: bank.longitude,
    primary_phone: bank.primary_phone,
    last_verified_at: bank.last_verified_at,
    verification_due: bank.verification_due,
    blood_groups: bank.blood_groups,
    blood_groups_confirmed_at: bank.blood_groups_confirmed_at,
    stock_note: bank.stock_note,
  };
}

/** Saves the banks (the first 100, A to Z) with the date. An empty list is not saved, so it never hides a good copy. */
export function saveBloodCopy(banks: BloodBank[], savedAt: Date = new Date()): void {
  if (banks.length === 0) return;
  const copy: BloodCopy = {
    savedAt: savedAt.toISOString(),
    banks: banks.map(forTheCopy).sort(byNameThenId).slice(0, MAX_SAVED_BANKS),
  };
  try {
    window.localStorage.setItem(BLOOD_COPY_KEY, JSON.stringify(copy));
  } catch {
    // no storage: the page works, it just cannot show the list offline
  }
}

function looksLikeASavedBank(value: unknown): value is SavedBloodBank {
  if (typeof value !== "object" || value === null) return false;
  const bank = value as Partial<SavedBloodBank>;
  return (
    typeof bank.id === "number" &&
    typeof bank.slug === "string" &&
    typeof bank.name === "string" &&
    typeof bank.area === "string" &&
    typeof bank.address === "string" &&
    typeof bank.category?.name === "string" &&
    Array.isArray(bank.blood_groups) &&
    typeof bank.stock_note === "string"
  );
}

/** The saved copy, or null if there is none or it is damaged. */
export function readBloodCopy(): BloodCopy | null {
  try {
    const stored = window.localStorage.getItem(BLOOD_COPY_KEY);
    if (stored === null) return null;
    const value: unknown = JSON.parse(stored);
    if (typeof value !== "object" || value === null) return null;
    const { savedAt, banks } = value as Partial<BloodCopy>;
    if (typeof savedAt !== "string" || !Array.isArray(banks) || !banks.every(looksLikeASavedBank)) return null;
    return { savedAt, banks };
  } catch {
    return null;
  }
}
