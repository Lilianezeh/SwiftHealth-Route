/** The saved copy of the emergency contacts, for when there is no network. Requirements: FR-17, NFR-03, NFR-07.
 *
 * Decision A5 in specs/2026-10-17-swiftrescue/requirements.md: the copy comes from a request made without a position and holds no
 * distance, so it says nothing about where the visitor is. It is in `localStorage` (it must outlive the tab, unlike the position)
 * under one key. Every function copes with a storage that throws (private mode): the page then simply has no copy.
 */
import type { EmergencyResponse, ListingSummary } from "@/types/api";

export const OFFLINE_COPY_KEY = "swiftrescue-saved-contacts";

export type OfflineCopy = { savedAt: string; response: EmergencyResponse };

/** The order of a request without a position: by name, then id (api-spec, "GET /emergency"). */
function byNameThenId(first: ListingSummary, second: ListingSummary): number {
  return first.name.localeCompare(second.name) || first.id - second.id;
}

function withoutDistance(contacts: ListingSummary[]): ListingSummary[] {
  return contacts.map((contact) => ({ ...contact, distance_km: null })).sort(byNameThenId);
}

export function saveOfflineCopy(response: EmergencyResponse, savedAt: Date = new Date()): void {
  // The fields are named one by one, so a field this page does not use (the pharmacy list of an older API, FR-25) is never kept.
  const copy: OfflineCopy = {
    savedAt: savedAt.toISOString(),
    response: {
      national_line: response.national_line,
      groups: response.groups.map((group) => ({ ...group, contacts: withoutDistance(group.contacts) })),
      disclaimer: response.disclaimer,
    },
  };
  try {
    window.localStorage.setItem(OFFLINE_COPY_KEY, JSON.stringify(copy));
  } catch {
    // no storage: the page works, it just cannot be shown offline
  }
}

function looksLikeAnEmergencyResponse(value: unknown): value is EmergencyResponse {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<EmergencyResponse>;
  return typeof candidate.national_line?.number === "string" && Array.isArray(candidate.groups);
}

/** The saved copy, or null if there is none or it is damaged. */
export function readOfflineCopy(): OfflineCopy | null {
  try {
    const stored = window.localStorage.getItem(OFFLINE_COPY_KEY);
    if (stored === null) return null;
    const value: unknown = JSON.parse(stored);
    if (typeof value !== "object" || value === null) return null;
    const { savedAt, response } = value as Partial<OfflineCopy>;
    if (typeof savedAt !== "string" || !looksLikeAnEmergencyResponse(response)) return null;
    // A copy saved before FR-25 was removed still holds the pharmacy list: only the known fields are handed on.
    return {
      savedAt,
      response: { national_line: response.national_line, groups: response.groups, disclaimer: response.disclaimer },
    };
  } catch {
    return null;
  }
}
