/** Helpers for component tests: a fake API behind `fetch`, a fake phone position, and sample listings. */
import { vi } from "vitest";

import type { EmergencyResponse, ListingSummary, MetaResponse } from "@/types/api";

export const AREAS = ["GRA", "New Haven", "Ogui"];

export const META: MetaResponse = {
  areas: AREAS,
  // The 12 categories of production, in the order GET /meta gives them there (sorted by id): the three that the demo
  // listings needed come first, then the ones the categories migration added.
  categories: [
    { slug: "clinic", name: "Clinic", is_emergency: false },
    { slug: "pharmacy", name: "Pharmacy", is_emergency: false },
    { slug: "laboratory", name: "Laboratory", is_emergency: false },
    { slug: "hospital", name: "Hospital", is_emergency: false },
    { slug: "maternity", name: "Maternity", is_emergency: false },
    { slug: "ambulance", name: "Ambulance", is_emergency: true },
    { slug: "fire", name: "Fire", is_emergency: true },
    { slug: "police", name: "Police", is_emergency: true },
    { slug: "emergency-unit", name: "24-hour emergency unit", is_emergency: true },
    { slug: "roadside-assistance", name: "Roadside assistance", is_emergency: true },
    { slug: "security", name: "Security", is_emergency: true },
    { slug: "blood-bank", name: "Blood bank", is_emergency: true },
  ],
  services: ["Consultation", "X-ray"],
  blood_groups: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
  report_reasons: ["not_working", "wrong_number", "closed", "moved", "wrong_hours", "other"],
  service_catalogue: ["Blood bank", "Consultation", "Malaria test", "X-ray"],
};

export function listing(overrides: Partial<ListingSummary> = {}): ListingSummary {
  return {
    id: 12,
    slug: "night-pharmacy-a",
    name: "Night Pharmacy A",
    category: { slug: "pharmacy", name: "Pharmacy" },
    area: "New Haven",
    address: "12 Example Road",
    latitude: 6.452,
    longitude: 7.51,
    distance_km: 1.4,
    is_open_now: true,
    is_24_hours: false,
    primary_phone: "+2340000000012",
    last_verified_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    verification_due: false,
    sponsored: false,
    hours_note: "Closes 9:00 PM",
    ...overrides,
  };
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

type SearchHandler = (parameters: URLSearchParams, signal?: AbortSignal) => Response | Promise<Response>;

/** Puts a fake API behind fetch. Returns the list of addresses that were asked for. */
export function stubApi(handlers: {
  meta?: () => Response | Promise<Response>;
  search?: SearchHandler;
  emergency?: SearchHandler;
}) {
  const requests: URL[] = [];
  const fetchStub = vi.fn(async (address: string, init?: RequestInit) => {
    const url = new URL(address);
    requests.push(url);
    if (url.pathname === "/meta") return (handlers.meta ?? (() => json(META)))();
    if (url.pathname === "/emergency") {
      return (handlers.emergency ?? (() => json(emergencyResponse())))(url.searchParams, init?.signal ?? undefined);
    }
    if (url.pathname === "/search") {
      return (handlers.search ?? (() => json({ items: [], total: 0 })))(url.searchParams, init?.signal ?? undefined);
    }
    return json({ detail: "Not found" }, 404);
  });
  vi.stubGlobal("fetch", fetchStub);
  return { requests, fetchStub, searches: () => requests.filter((url) => url.pathname === "/search") };
}

/** A fetch answer that never comes. Like a real fetch, it fails when the request is cancelled (the 45 second limit). */
export function neverAnswers(_parameters?: URLSearchParams, signal?: AbortSignal): Promise<Response> {
  return new Promise<Response>((_resolve, reject) => {
    signal?.addEventListener("abort", () => reject(new DOMException("The operation was aborted.", "AbortError")));
  });
}

type SuccessCallback = (position: GeolocationPosition) => void;
type ErrorCallback = (error: GeolocationPositionError) => void;

/** Puts a fake phone position behind navigator.geolocation. */
export function stubGeolocation(outcome: { latitude: number; longitude: number } | { errorCode: number }) {
  const getCurrentPosition = vi.fn((success: SuccessCallback, failure: ErrorCallback) => {
    if ("errorCode" in outcome) failure({ code: outcome.errorCode, message: "" } as GeolocationPositionError);
    else success({ coords: { latitude: outcome.latitude, longitude: outcome.longitude } } as GeolocationPosition);
  });
  Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition }, configurable: true });
  return getCurrentPosition;
}

/** A run of different listings (ids firstId, firstId + 1, ...), named "Place 1", "Place 2"... */
export function manyListings(count: number, firstId = 1): ListingSummary[] {
  return Array.from({ length: count }, (_unused, index) => {
    const id = firstId + index;
    return listing({ id, slug: `place-${id}`, name: `Place ${id}` });
  });
}

/** The answer of GET /emergency (api-spec): the seven groups in order, two with a contact. (No pharmacy list: FR-25 was removed on 2026-10-22.) */
export function emergencyResponse(overrides: Partial<EmergencyResponse> = {}): EmergencyResponse {
  const contact = (id: number, name: string, categorySlug: string, categoryName: string, phone: string | null) =>
    listing({
      id, slug: `contact-${id}`, name, category: { slug: categorySlug, name: categoryName }, primary_phone: phone,
      is_24_hours: true, hours_note: null, distance_km: null,
    });
  const groupNames: [string, string][] = [
    ["ambulance", "Ambulance"], ["fire", "Fire"], ["police", "Police"], ["emergency-unit", "24-hour emergency units"],
    ["roadside-assistance", "Roadside assistance"], ["security", "Security"], ["blood-bank", "Blood banks"],
  ];
  const contacts: Record<string, ListingSummary[]> = {
    ambulance: [contact(101, "Demo Ambulance One", "ambulance", "Ambulance", "+2340000000101")],
    police: [contact(102, "Demo Police Post", "police", "Police", "+2340000000102")],
  };
  return {
    national_line: { name: "National emergency number", number: "112" },
    groups: groupNames.map(([slug, name]) => ({ category: { slug, name }, contacts: contacts[slug] ?? [] })),
    disclaimer:
      "SwiftRescue connects you to emergency contacts; it does not dispatch or guarantee an emergency response. In danger, call 112.",
    ...overrides,
  };
}
