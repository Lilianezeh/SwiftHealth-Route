/** Where the visitor's position, refusal and chosen area are kept. Requirements: FR-03, NFR-07.
 *
 * The POSITION is kept in memory only (owner's rule, specs/2026-11-01-maps-near-me/): never in storage, the page address, a cookie
 * or a log; gone when the page is reloaded. It is rounded to 3 decimals (about 110 m): enough for "nearest first", and less than the
 * phone gave us. The chosen area and the refusal are not a position: they stay in `sessionStorage` (decision 3 in
 * specs/2026-10-09-search-frontend/requirements.md), gone when the tab closes.
 * Every storage function copes with a storage that throws (private mode, blocked site data): the page then simply forgets.
 */
import type { Position } from "@/lib/api/search";

const LEGACY_POSITION_KEY = "swifthealth.position"; // an older version kept the position here; it is wiped when this file loads
const AREA_KEY = "swifthealth.area";
const DENIED_KEY = "swifthealth.location-denied";

function readItem(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeItem(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // nothing to do: without storage the page just does not remember
  }
}

function removeItem(key: string): void {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // nothing to do
  }
}

if (typeof window !== "undefined") removeItem(LEGACY_POSITION_KEY);

function roundToThreeDecimals(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function roundPosition(position: Position): Position {
  return {
    latitude: roundToThreeDecimals(position.latitude),
    longitude: roundToThreeDecimals(position.longitude),
  };
}

function isNumberInRange(value: unknown, limit: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= limit;
}

// The visitor's position lives HERE, in this variable, and nowhere else (owner's rule of 2026-11-01, specs/2026-11-01-maps-near-me/):
// not in sessionStorage, localStorage, a cookie, the address, a log or analytics. It survives moving between pages of the site (the
// code stays loaded) and is gone when the page is reloaded or closed.
let positionInMemory: Position | null = null;

/** Remembers the position (rounded) for this page load only. A position that is not on the earth is ignored. */
export function savePosition(position: Position): void {
  const { latitude, longitude } = roundPosition(position);
  if (!isNumberInRange(latitude, 90) || !isNumberInRange(longitude, 180)) return;
  positionInMemory = { latitude, longitude };
}

/** The remembered position, or null if there is none (nothing asked yet, or the page was reloaded). */
export function readPosition(): Position | null {
  return positionInMemory === null ? null : { ...positionInMemory };
}

/** A refusal is remembered for the tab, so the site asks only once (FR-03). */
export function markLocationDenied(): void {
  writeItem(DENIED_KEY, "1");
}

export function isLocationDenied(): boolean {
  return readItem(DENIED_KEY) === "1";
}

export function saveArea(area: string): void {
  const name = area.trim();
  if (name) writeItem(AREA_KEY, name);
}

export function readArea(): string | null {
  const stored = readItem(AREA_KEY)?.trim();
  return stored ? stored : null;
}

/** Forgets the position only (the chosen area and the refusal stay). */
export function clearPosition(): void {
  positionInMemory = null;
}

/** Forgets the position, the refusal and the area. */
export function clearLocation(): void {
  positionInMemory = null;
  removeItem(AREA_KEY);
  removeItem(DENIED_KEY);
}
