/** Where the visitor's position, refusal and chosen area are kept. Requirements: FR-03, NFR-07.
 *
 * Decision 3 in specs/2026-10-09-search-frontend/requirements.md: `sessionStorage` only, so everything is gone when
 * the tab closes. Never in the page address, a cookie or `localStorage`, never logged. The position is rounded to
 * 3 decimals (about 110 m): enough for "nearest first", and less than the phone gave us.
 * Every function copes with a storage that throws (private mode, blocked site data): the page then simply forgets.
 */
import type { Position } from "@/lib/api/search";

const POSITION_KEY = "swifthealth.position";
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

export function savePosition(position: Position): void {
  const { latitude, longitude } = roundPosition(position);
  writeItem(POSITION_KEY, JSON.stringify({ latitude, longitude }));
}

/** The saved position, or null if there is none or the saved value is damaged. */
export function readPosition(): Position | null {
  const stored = readItem(POSITION_KEY);
  if (stored === null) return null;
  try {
    const value: unknown = JSON.parse(stored);
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    const { latitude, longitude } = value as Record<string, unknown>;
    if (!isNumberInRange(latitude, 90) || !isNumberInRange(longitude, 180)) return null;
    return { latitude, longitude };
  } catch {
    return null;
  }
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

/** Forgets the position, the refusal and the area. */
export function clearLocation(): void {
  removeItem(POSITION_KEY);
  removeItem(AREA_KEY);
  removeItem(DENIED_KEY);
}
